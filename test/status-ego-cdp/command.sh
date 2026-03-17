#!/usr/bin/env bash
set -euo pipefail

printf 'checking ego-cdp status command\n'

STATUS_OUTPUT="$("$ROOT_DIR/bin/ego-cdp" status)"
printf '%s\n' "$STATUS_OUTPUT"

[[ "$STATUS_OUTPUT" =~ Chrome:\ pid\ [0-9]+ ]] || exit 1
[[ "$STATUS_OUTPUT" =~ WS\ daemon:\ pid\ [0-9]+ ]] || exit 1
[[ "$STATUS_OUTPUT" =~ Browser:\ Chrome/[^[:space:]]+ ]] || exit 1

printf 'ego-cdp status command reachable\n'
