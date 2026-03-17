#!/usr/bin/env bash
set -euo pipefail

printf 'checking ego-cdp websocket browser endpoint via unix socket\n'

RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws '{"id":1,"method":"Browser.getVersion"}')"
printf '%s' "$RESPONSE" | jq -e '.result.product | startswith("Chrome/")' >/dev/null

printf 'ego-cdp websocket reachable\n'
