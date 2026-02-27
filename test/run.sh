#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"
readonly TEST_HOST='ego-cdp-testing.localhost'
readonly TEST_PORT=9223

SELECTED_TEST=""
if [ "$#" -gt 1 ]; then
  printf 'Usage: %s [test-name]\n' "$0" >&2
  exit 1
elif [ "$#" -eq 1 ]; then
  SELECTED_TEST="$1"
fi

TOTAL_TESTS=0
FAILURES=0
declare -a TEST_RESULTS=()

printf 'Running tests from %s\n' "$SCRIPT_DIR"
for dir in "$SCRIPT_DIR"/*/; do
  [ -d "$dir" ] || continue
  TEST_NAME="$(basename "$dir")"
  if [ -n "$SELECTED_TEST" ] && [ "$TEST_NAME" != "$SELECTED_TEST" ]; then
    continue
  fi
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
  printf 'Using settings: %s\n' "$CONFIG"
  TEST_USER_DATA_DIR=$(mktemp -d)
  export HOST="$TEST_HOST"
  export PORT="$TEST_PORT"
  export USER_DATA_DIR="$TEST_USER_DATA_DIR"
  printf 'Starting ego-cdp headless (host=%s port=%s) using %s\n' "$HOST" "$PORT" "$USER_DATA_DIR"
  "$ROOT_DIR/bin/ego-cdp" start --headless
  sleep 1

  set +e
  (
    cd "$dir"
    srt --settings "$CONFIG" bash "./$COMMAND_NAME"
  )
  STATUS=$?
  set -e

  "$ROOT_DIR/bin/ego-cdp" stop
  unset USER_DATA_DIR HOST PORT
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

if [ "$TOTAL_TESTS" -eq 0 ] && [ -n "$SELECTED_TEST" ]; then
  printf '\nNo test named %s found\n' "$SELECTED_TEST" >&2
  exit 1
fi

printf '\nTest results:\n'
for result in "${TEST_RESULTS[@]}"; do
  printf ' %s\n' "$result"
done

PASSED=$((TOTAL_TESTS - FAILURES))
printf '\nSummary: total %d passed %d failed %d\n' "$TOTAL_TESTS" "$PASSED" "$FAILURES"

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi
