#!/usr/bin/env bash
set -euo pipefail

printf 'checking ego-cdp websocket endpoint via unix socket\n'

VERSION_JSON="$("$ROOT_DIR/bin/ego-cdp" http /json/version)"
BROWSER_PATH="$(printf '%s' "$VERSION_JSON" | node -e "const fs=require('node:fs'); const input=fs.readFileSync(0,'utf8'); const ws=JSON.parse(input).webSocketDebuggerUrl || ''; if(!ws){process.exit(1)}; process.stdout.write(new URL(ws).pathname);")"

RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws "$BROWSER_PATH" '{"id":1,"method":"Browser.getVersion"}')"
printf '%s' "$RESPONSE" | node -e "const fs=require('node:fs'); const input=fs.readFileSync(0,'utf8'); const parsed=JSON.parse(input); if(!parsed.result?.product){process.exit(1)}"

printf 'ego-cdp websocket reachable\n'
