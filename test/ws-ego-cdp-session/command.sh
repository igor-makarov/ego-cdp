#!/usr/bin/env bash
set -euo pipefail

printf 'testing multiple ws calls: create target, attach, evaluate via session\n'

# 1. Create a new target (blank page)
CREATE_RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws '{"id":1,"method":"Target.createTarget","params":{"url":"about:blank"}}')"
TARGET_ID="$(printf '%s' "$CREATE_RESPONSE" | node -e "
  const input = require('node:fs').readFileSync(0,'utf8');
  const parsed = JSON.parse(input);
  if (!parsed.result?.targetId) { console.error('no targetId'); process.exit(1); }
  process.stdout.write(parsed.result.targetId);
")"
printf 'created target: %s\n' "$TARGET_ID"

# 2. Attach to the target to get a session id
ATTACH_RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws "{\"id\":2,\"method\":\"Target.attachToTarget\",\"params\":{\"targetId\":\"$TARGET_ID\",\"flatten\":true}}")"
SESSION_ID="$(printf '%s' "$ATTACH_RESPONSE" | node -e "
  const input = require('node:fs').readFileSync(0,'utf8');
  const parsed = JSON.parse(input);
  if (!parsed.result?.sessionId) { console.error('no sessionId'); process.exit(1); }
  process.stdout.write(parsed.result.sessionId);
")"
printf 'attached session: %s\n' "$SESSION_ID"

# 3. Use the session id to evaluate an expression on the page
EVAL_RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws "{\"id\":3,\"method\":\"Runtime.evaluate\",\"params\":{\"expression\":\"1+1\"},\"sessionId\":\"$SESSION_ID\"}")"
EVAL_VALUE="$(printf '%s' "$EVAL_RESPONSE" | node -e "
  const input = require('node:fs').readFileSync(0,'utf8');
  const parsed = JSON.parse(input);
  const val = parsed.result?.result?.value;
  if (val !== 2) { console.error('expected 2, got ' + val); process.exit(1); }
  process.stdout.write(String(val));
")"
printf 'evaluated 1+1 = %s\n' "$EVAL_VALUE"

# 4. Clean up: close the target
CLOSE_RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws "{\"id\":4,\"method\":\"Target.closeTarget\",\"params\":{\"targetId\":\"$TARGET_ID\"}}")"
printf '%s' "$CLOSE_RESPONSE" | node -e "
  const input = require('node:fs').readFileSync(0,'utf8');
  const parsed = JSON.parse(input);
  if (!parsed.result?.success) { console.error('closeTarget failed'); process.exit(1); }
"
printf 'closed target\n'

printf 'multi-step ws session test passed\n'
