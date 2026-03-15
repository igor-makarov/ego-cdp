#!/usr/bin/env bash
set -euo pipefail

printf 'checking ego-cdp websocket /devtools/browser route via unix socket\n'

RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws "/devtools/browser" '{"id":1,"method":"Browser.getVersion"}')"
printf '%s' "$RESPONSE" | node -e "const fs=require('node:fs'); const input=fs.readFileSync(0,'utf8'); const parsed=JSON.parse(input); if(!parsed.result?.product){process.exit(1)}"

printf 'ego-cdp /devtools/browser websocket route reachable\n'
