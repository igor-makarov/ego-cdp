---
name: browser-use
description: Use Chrome CDP via ego-cdp for tab listing, navigation, JS evaluation, and UI automation
---

# Browser Use

## Lifecycle

- `../../bin/ego-cdp status` - check if Chrome and Caddy are running - allowed by sandbox
- `../../bin/ego-cdp start` - start Chrome and Caddy reverse proxy (detects partial state and restarts if needed) - needs sandbox escalation
- `../../bin/ego-cdp stop` - stop both Chrome and Caddy - needs sandbox escalation

## CDP Direct Access - allowed by sandbox

Use `../../bin/ego-cdp http [--method=METHOD] [--output=FILE] <path>` for HTTP endpoints (default GET):

- `../../bin/ego-cdp http /json/list` - list all tabs
- `../../bin/ego-cdp http /json/version` - browser version (includes `webSocketDebuggerUrl` with browser WS path)
- `../../bin/ego-cdp http --method=PUT /json/close/<targetId>` - close a tab

Use `../../bin/ego-cdp ws <path> '<message>' [--timeout=ms] [--output=FILE]` for WebSocket commands (default 60000).
The `<path>` is a raw WebSocket path: `/devtools/page/<targetId>` for a tab, or `/devtools/browser/<guid>` for browser-level commands (get the guid from `/json/version`).

- `../../bin/ego-cdp ws /devtools/page/<id> '{"id":1,"method":"Runtime.evaluate","params":{"expression":"document.title"}}'` - run JS
- `../../bin/ego-cdp ws /devtools/page/<id> '{"id":1,"method":"Page.navigate","params":{"url":"https://example.com"}}'` - navigate
- `../../bin/ego-cdp ws /devtools/browser/<guid> '{"id":1,"method":"Target.createTarget","params":{"url":"about:blank","background":true}}'` - create blank tab in background (no focus steal)

## General instructions

- DO NOT reuse an open tab unless explicitly asked - these may be in use by another agent
- Prefer not to take screenshots - it is slower
- YOU MUST Use `Input.*` commands to interact with UI elements - other ways are a waste of time
  - Prefer: synthesized commands such as `synthesizeTapGesture`, `insertText`, `synthesizeScrollGesture`
  - Last resort: raw events such as `dispatchKeyEvent`, `dispatchMouseEvent`
  - Check input/checkbox values before interaction - otherwise you might clobber or make incorrect changes
- **CDP COMMAND FORMAT IS SACRED**: The Bash command string MUST start with `../../bin/ego-cdp` (relative to this skill directory) — NOTHING before it. No shell comments (`#`), no variable assignments, no `echo`, no chaining with `&&`. Anything prepended = command rejected.
- DO NOT use arbitrary network calls - they will be blocked by sandbox
- `--output=FILE` outputs raw CDP JSON and does not perform any conversions
- Prefer in-page data extraction (`Runtime.evaluate` + `fetch`/DOM/script parsing) for massive tasks.
  - Rationale: in-page requests run in the site context (same cookies/session/origin/CORS behavior), so they are usually more reliable than external HTTP calls.
  - Use this for pagination, bulk extraction, hidden metadata (`script` blobs / JSON), and export-style endpoints.
  - Build deterministic loops (e.g. vary `pn=1..N`), extract stable IDs/URLs, and dedupe in a set/map.
  - Stop on empty pages or repeated page signatures; do not trust a single visible UI count.
  - Return compact structured output (counts + IDs/URLs) and compare against local tracked data.
