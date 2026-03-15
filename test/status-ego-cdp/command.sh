#!/usr/bin/env bash
set -euo pipefail

printf 'checking ego-cdp status command\n'

STATUS_OUTPUT="$("$ROOT_DIR/bin/ego-cdp" status)"
printf '%s\n' "$STATUS_OUTPUT"

printf '%s' "$STATUS_OUTPUT" | node -e "const fs=require('node:fs'); const input=fs.readFileSync(0,'utf8'); const lines=input.trim().split(/\n/); if(lines.length < 2) process.exit(1); if(!/^Chrome: pid [0-9]+ — .+/.test(lines[0])) process.exit(1); if(!/^Caddy: pid [0-9]+, proxy socket /.test(lines[1])) process.exit(1);"

printf 'ego-cdp status command reachable\n'
