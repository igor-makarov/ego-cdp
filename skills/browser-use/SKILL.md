---
name: browser-use
description: Use Chrome CDP via ego-cdp for tab listing, navigation, JS evaluation, and UI automation
---

# Browser Use

## Overview

`ego-cdp` is a CLI plus a pi extension custom tool for using a browser via CDP from within a sandboxed environment. It runs a persistent WebSocket daemon that keeps a connection to Chrome's browser endpoint open between calls. All CDP commands go through a single Unix socket.

Use the `ego_cdp_ws` custom tool for CDP traffic. Use the CLI through bash only for lifecycle management (`start`, `status`, `stop`).

| Interface | Runs in sandbox? | Reason |
| --------- | ---------------- | ------ |
| `../../bin/ego-cdp status` | ✅ Yes | Checks daemon/browser state and probes CDP through the socket |
| `../../bin/ego-cdp start` | ❌ No | Launches Chrome and WS daemon; needs to run unsandboxed |
| `../../bin/ego-cdp stop` | ❌ No | Kills Chrome and WS daemon; needs to run unsandboxed |
| `ego_cdp_ws` tool | ✅ Yes | Calls `runWsCommand()` directly over the Unix socket |

## Lifecycle

- `../../bin/ego-cdp status` - check if Chrome and WS daemon are running - allowed by sandbox, no escalation needed
- `../../bin/ego-cdp start` - start Chrome and WS daemon (detects partial state and restarts if needed) - needs sandbox escalation
- `../../bin/ego-cdp stop` - stop Chrome and WS daemon - needs sandbox escalation

## CDP Access - via custom tool, allowed by sandbox

All commands use the flattened session model on the browser endpoint. Use `sessionId` to target specific pages.

- `ego_cdp_ws` with `{ message, timeout? }` - allowed by sandbox, no escalation needed

### Examples (non-exhaustive)

Using the custom tool:

- `ego_cdp_ws` with `{"message":"{\"id\":1,\"method\":\"Browser.getVersion\"}"}` - browser version
- `ego_cdp_ws` with `{"message":"{\"id\":1,\"method\":\"Target.getTargets\"}"}` - list all tabs
- `ego_cdp_ws` with `{"message":"{\"id\":1,\"method\":\"Target.createTarget\",\"params\":{\"url\":\"<url>\",\"background\":true}}"}` - create tab in background (no focus steal)
- `ego_cdp_ws` with `{"message":"{\"id\":1,\"method\":\"Target.closeTarget\",\"params\":{\"targetId\":\"<id>\"}}"}` - close a tab
- `ego_cdp_ws` with `{"message":"{\"id\":1,\"method\":\"Target.attachToTarget\",\"params\":{\"targetId\":\"<id>\",\"flatten\":true}}"}` - attach to tab and get `sessionId`
- `ego_cdp_ws` with `{"message":"{\"id\":2,\"sessionId\":\"<sessionId>\",\"method\":\"Page.navigate\",\"params\":{\"url\":\"<url>\"}}"}` - send target-scoped command using `sessionId`
- `ego_cdp_ws` with `{"message":"{\"id\":3,\"sessionId\":\"<sessionId>\",\"method\":\"Runtime.evaluate\",\"params\":{\"expression\":\"document.title\"}}"}` - evaluate JS in a tab


## General instructions

- DO NOT reuse an open tab unless explicitly asked - these may be in use by another agent
- Prefer not to take screenshots - it is slower
- YOU MUST Use `Input.*` commands to interact with UI elements - other ways are a waste of time
  - Prefer: synthesized commands such as `synthesizeTapGesture`, `insertText`, `synthesizeScrollGesture`
  - Prefer: `dispatchKeyEvent` with `commands` property
  - Last resort: raw events such as `dispatchKeyEvent`, `dispatchMouseEvent`
  - Check input/checkbox values before interaction - otherwise you might clobber or make incorrect changes
- DO NOT use arbitrary network calls - they will be blocked by sandbox
- large responses are truncated like pi's bash tool and the full output path is shown in the tool result
- Prefer in-page data extraction (`Runtime.evaluate` + `fetch`/DOM/script parsing) for massive tasks.
  - Rationale: in-page requests run in the site context (same cookies/session/origin/CORS behavior), so they are usually more reliable than external HTTP calls.
  - Use this for pagination, bulk extraction, hidden metadata (`script` blobs / JSON), and export-style endpoints.
  - Build deterministic loops (e.g. vary `pn=1..N`), extract stable IDs/URLs, and dedupe in a set/map.
  - Stop on empty pages or repeated page signatures; do not trust a single visible UI count.
  - Return compact structured output (counts + IDs/URLs) and compare against local tracked data.
