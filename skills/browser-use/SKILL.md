---
name: browser-use
description: Use Chrome CDP via ego-cdp for tab listing, navigation, JS evaluation, and UI automation
---

# Browser Use

## Overview

`ego-cdp` is a CLI that allows using a browser via CDP from within a sandboxed environment. It does so by creating a Caddy reverse-proxy and allowing a specific domain. This means that most operations do not require breaking out of the sandbox:

| Subcommand | Runs in sandbox? | Reason                                                                  |
| ---------- | ---------------- | ----------------------------------------------------------------------- |
| `status`   | ✅ Yes           | Routes through Caddy on allowed domain                                  |
| `start`    | ❌ No            | Launches Chrome & Caddy; needs to run unsandboxed (`bin/ego-cdp start`) |
| `stop`     | ❌ No            | Kills Chrome & Caddy; needs to run unsandboxed (`bin/ego-cdp stop`)     |
| `http`     | ✅ Yes           | Routes through Caddy on allowed domain                                  |
| `ws`       | ✅ Yes           | Routes through Caddy on allowed domain                                  |

## Lifecycle

- `../../bin/ego-cdp status` - check if Chrome and Caddy are running - allowed by sandbox, no escalation needed
- `../../bin/ego-cdp start` - start Chrome and Caddy reverse proxy (detects partial state and restarts if needed) - needs sandbox escalation
- `../../bin/ego-cdp stop` - stop both Chrome and Caddy - needs sandbox escalation

## CDP Direct Access - allowed by sandbox, no escalation

Use `../../bin/ego-cdp http <path> [--method=METHOD] [--output=FILE]` for HTTP endpoints (default GET) - allowed by sandbox, no escalation needed
Use `../../bin/ego-cdp ws <path> '<message>' [--timeout=ms] [--output=FILE]` for WebSocket commands (default timeout 60000) - allowed by sandbox, no escalation needed

### Browser-level examples (non-exhaustive)

- `../../bin/ego-cdp http /json/version` - browser version (includes `webSocketDebuggerUrl` with browser GUID)
- `../../bin/ego-cdp ws /devtools/browser/<guid> '{"id":1,"method":"Target.getTargets"}'` - list all tabs
- `../../bin/ego-cdp ws /devtools/browser/<guid> '{"id":1,"method":"Target.createTarget","params":{"url":"<url>","background":true}}'` - create tab in background (no focus steal)
- `../../bin/ego-cdp ws /devtools/browser/<guid> '{"id":1,"method":"Target.closeTarget","params":{"targetId":"<id>"}}'` - close a tab

### Tab-level examples (non-exhaustive)

- `../../bin/ego-cdp ws /devtools/page/<id> '{"id":1,"method":"Runtime.evaluate","params":{"expression":"document.title"}}'` - run JS
- `../../bin/ego-cdp ws /devtools/page/<id> '{"id":1,"method":"Page.navigate","params":{"url":"https://example.com"}}'` - navigate

## General instructions

- DO NOT reuse an open tab unless explicitly asked - these may be in use by another agent
- Prefer not to take screenshots - it is slower
- YOU MUST Use `Input.*` commands to interact with UI elements - other ways are a waste of time
  - Prefer: synthesized commands such as `synthesizeTapGesture`, `insertText`, `synthesizeScrollGesture`
  - Last resort: raw events such as `dispatchKeyEvent`, `dispatchMouseEvent`
  - Check input/checkbox values before interaction - otherwise you might clobber or make incorrect changes
- DO NOT use arbitrary network calls - they will be blocked by sandbox
- `--output=FILE` outputs raw CDP JSON and does not perform any conversions
- Prefer in-page data extraction (`Runtime.evaluate` + `fetch`/DOM/script parsing) for massive tasks.
  - Rationale: in-page requests run in the site context (same cookies/session/origin/CORS behavior), so they are usually more reliable than external HTTP calls.
  - Use this for pagination, bulk extraction, hidden metadata (`script` blobs / JSON), and export-style endpoints.
  - Build deterministic loops (e.g. vary `pn=1..N`), extract stable IDs/URLs, and dedupe in a set/map.
  - Stop on empty pages or repeated page signatures; do not trust a single visible UI count.
  - Return compact structured output (counts + IDs/URLs) and compare against local tracked data.
