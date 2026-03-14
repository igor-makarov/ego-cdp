#!/usr/bin/env bash
set -euo pipefail

SOCK_PATH="${USER_DATA_DIR}/ego-cdp.sock"

printf 'curl ego-cdp via unix socket (socket path blocked)\n'
curl -f -v --unix-socket "$SOCK_PATH" "http://localhost/json/version" > /dev/null
