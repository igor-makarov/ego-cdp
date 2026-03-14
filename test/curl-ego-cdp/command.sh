#!/usr/bin/env bash
set -euo pipefail

SOCK_PATH="${USER_DATA_DIR}/ego-cdp.sock"

printf 'checking ego-cdp json/version endpoint via unix socket (%s)\n' "$SOCK_PATH"
curl -f -v --unix-socket "$SOCK_PATH" "http://localhost/json/version" >/dev/null
printf 'ego-cdp endpoint reachable\n'
