#!/usr/bin/env bash
set -euo pipefail

printf 'checking ego-cdp websocket browser endpoint via unix socket\n'

RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws '{"id":1,"method":"Browser.getVersion"}')"
printf '%s' "$RESPONSE" | node -e "const fs=require('node:fs'); const input=fs.readFileSync(0,'utf8'); const parsed=JSON.parse(input); if(!parsed.result?.product){process.exit(1)}"

printf 'ego-cdp websocket reachable\n'
