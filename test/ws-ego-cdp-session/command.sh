#!/usr/bin/env bash
set -euo pipefail

printf 'testing multiple ws calls: create target, attach, evaluate via session\n'

# 1. Create a new target (blank page)
CREATE_RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws '{"id":1,"method":"Target.createTarget","params":{"url":"about:blank"}}')"
TARGET_ID="$(printf '%s' "$CREATE_RESPONSE" | jq -er '.result.targetId')"
printf 'created target: %s\n' "$TARGET_ID"

# 2. Attach to the target to get a session id
ATTACH_RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws "{\"id\":2,\"method\":\"Target.attachToTarget\",\"params\":{\"targetId\":\"$TARGET_ID\",\"flatten\":true}}")"
SESSION_ID="$(printf '%s' "$ATTACH_RESPONSE" | jq -er '.result.sessionId')"
printf 'attached session: %s\n' "$SESSION_ID"

# 3. Use the session id to evaluate an expression on the page
EVAL_RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws "{\"id\":3,\"method\":\"Runtime.evaluate\",\"params\":{\"expression\":\"1+1\"},\"sessionId\":\"$SESSION_ID\"}")"
EVAL_VALUE="$(printf '%s' "$EVAL_RESPONSE" | jq -er '.result.result.value')"
[ "$EVAL_VALUE" = '2' ] || {
  printf 'expected 2, got %s\n' "$EVAL_VALUE" >&2
  exit 1
}
printf 'evaluated 1+1 = %s\n' "$EVAL_VALUE"

# 4. Clean up: close the target
CLOSE_RESPONSE="$("$ROOT_DIR/bin/ego-cdp" ws "{\"id\":4,\"method\":\"Target.closeTarget\",\"params\":{\"targetId\":\"$TARGET_ID\"}}")"
printf '%s' "$CLOSE_RESPONSE" | jq -e '.result.success == true' >/dev/null || {
  printf 'closeTarget failed\n' >&2
  exit 1
}
printf 'closed target\n'

printf 'multi-step ws session test passed\n'
