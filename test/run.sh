#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

TOTAL_TESTS=0
FAILURES=0

printf 'Running tests from %s\n' "$SCRIPT_DIR"
for dir in "$SCRIPT_DIR"/*/; do
  [ -d "$dir" ] || continue
  CONFIG="$dir/srt-settings.json"
  COMMAND_NAME=""
  EXPECT_FAILURE=0
  if [ -f "$dir/command-fail.sh" ]; then
    COMMAND_NAME="command-fail.sh"
    EXPECT_FAILURE=1
  elif [ -f "$dir/command.sh" ]; then
    COMMAND_NAME="command.sh"
  else
    printf 'No command script found in %s\n' "$(basename "$dir")" >&2
    exit 1
  fi
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if [ ! -f "$CONFIG" ]; then
    printf '%s\n' '{}' > "$CONFIG"
  fi
  printf '\n=== Running test: %s ===\n' "$(basename "$dir")"
  printf 'Using settings: %s\n' "$CONFIG"
  set +e
  (
    cd "$dir"
    srt --settings "$CONFIG" bash "./$COMMAND_NAME"
  )
  STATUS=$?
  set -e
  if [ "$EXPECT_FAILURE" -eq 1 ]; then
    if [ "$STATUS" -eq 0 ]; then
      printf 'Expected %s to fail but it succeeded\n' "$COMMAND_NAME" >&2
      FAILURES=$((FAILURES + 1))
    else
      printf 'Command %s failed as expected\n' "$COMMAND_NAME"
    fi
  else
    if [ "$STATUS" -ne 0 ]; then
      printf 'Command %s failed unexpectedly\n' "$COMMAND_NAME" >&2
      FAILURES=$((FAILURES + 1))
    fi
  fi
done

PASSED=$((TOTAL_TESTS - FAILURES))
printf '\nSummary: total %d passed %d failed %d\n' "$TOTAL_TESTS" "$PASSED" "$FAILURES"

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi
