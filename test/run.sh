#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
export ROOT_DIR
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

SELECTED_TESTS=("$@")

test_is_selected() {
  local test_name="$1"
  local selected_test

  if [ "${#SELECTED_TESTS[@]}" -eq 0 ]; then
    return 0
  fi

  for selected_test in "${SELECTED_TESTS[@]}"; do
    if [ "$selected_test" = "$test_name" ]; then
      return 0
    fi
  done

  return 1
}

test_was_requested() {
  local requested_test="$1"
  local found_test

  for found_test in "${FOUND_TESTS[@]}"; do
    if [ "$found_test" = "$requested_test" ]; then
      return 0
    fi
  done

  return 1
}

TOTAL_TESTS=0
FAILURES=0
declare -a TEST_RESULTS=()
declare -a FOUND_TESTS=()

printf 'Running tests from %s\n' "$SCRIPT_DIR"
for dir in "$SCRIPT_DIR"/*/; do
  [ -d "$dir" ] || continue
  TEST_NAME="$(basename "$dir")"
  if ! test_is_selected "$TEST_NAME"; then
    continue
  fi
  FOUND_TESTS+=("$TEST_NAME")
  CONFIG="$dir/srt-settings.json"
  COMMAND_NAME=""
  EXPECT_FAILURE=0
  if [ -f "$dir/command-fail.sh" ]; then
    COMMAND_NAME="command-fail.sh"
    EXPECT_FAILURE=1
  elif [ -f "$dir/command.sh" ]; then
    COMMAND_NAME="command.sh"
  else
    printf 'No command script found in %s\n' "$TEST_NAME" >&2
    exit 1
  fi
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if [ ! -f "$CONFIG" ]; then
    printf '%s\n' '{}' > "$CONFIG"
  fi
  printf '\n=== Running test: %s ===\n' "$TEST_NAME"
  TEST_USER_DATA_DIR=$(mktemp -d)
  TEST_CONFIG="$TEST_USER_DATA_DIR/srt-settings.json"
  TEST_COMMAND="$TEST_USER_DATA_DIR/command.sh"
  cp "$CONFIG" "$TEST_CONFIG"
  cp "$dir/$COMMAND_NAME" "$TEST_COMMAND"
  chmod +x "$TEST_COMMAND"
  printf 'Using settings: %s\n' "$TEST_CONFIG"

  export USER_DATA_DIR="$TEST_USER_DATA_DIR"
  export PORT=$(( (RANDOM % 10000) + 20000 ))
  printf 'Starting ego-cdp headless using %s\n' "$USER_DATA_DIR"
  "$ROOT_DIR/bin/ego-cdp" start --headless
  sleep 1

  set +e
  (
    cd "$TEST_USER_DATA_DIR"
    srt --settings "$TEST_CONFIG" bash "./command.sh"
  )
  STATUS=$?
  set -e

  "$ROOT_DIR/bin/ego-cdp" stop
  unset USER_DATA_DIR PORT
  SYMBOL='✓'
  if [ "$EXPECT_FAILURE" -eq 1 ]; then
    if [ "$STATUS" -eq 0 ]; then
      printf 'Expected %s to fail but it succeeded\n' "$COMMAND_NAME" >&2
      FAILURES=$((FAILURES + 1))
      SYMBOL='✗'
    else
      printf 'Command %s failed as expected\n' "$COMMAND_NAME"
    fi
  else
    if [ "$STATUS" -ne 0 ]; then
      printf 'Command %s failed unexpectedly\n' "$COMMAND_NAME" >&2
      FAILURES=$((FAILURES + 1))
      SYMBOL='✗'
    fi
  fi
  TEST_RESULTS+=("$SYMBOL $TEST_NAME")
done

MISSING_TESTS=0
if [ "${#SELECTED_TESTS[@]}" -gt 0 ]; then
  for selected_test in "${SELECTED_TESTS[@]}"; do
    if ! test_was_requested "$selected_test"; then
      printf '\nNo test named %s found\n' "$selected_test" >&2
      MISSING_TESTS=1
    fi
  done
fi

printf '\nTest results:\n'
for result in "${TEST_RESULTS[@]}"; do
  printf ' %s\n' "$result"
done

PASSED=$((TOTAL_TESTS - FAILURES))
printf '\nSummary: total %d passed %d failed %d\n' "$TOTAL_TESTS" "$PASSED" "$FAILURES"

if [ "$FAILURES" -gt 0 ] || [ "$MISSING_TESTS" -gt 0 ]; then
  exit 1
fi
