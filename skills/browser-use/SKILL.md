---
name: browser-use
description: Use Chrome CDP via ego-cdp for tab listing, navigation, JS evaluation, and UI automation
---

# Browser Use

## Overview

`ego-cdp` is a CLI that allows using a browser via CDP from within a sandboxed environment. It runs a persistent WebSocket daemon that keeps a connection to Chrome's browser endpoint open between calls. All CDP commands go through a single Unix socket.

| Subcommand | Runs in sandbox? | Reason                                                                     |
| ---------- | ---------------- | -------------------------------------------------------------------------- |
| `status`   | ✅ Yes           | Routes through daemon on socket                                            |
| `start`    | ❌ No            | Launches Chrome & WS daemon; needs to run unsandboxed (`bin/ego-cdp start`) |
| `stop`     | ❌ No            | Kills Chrome & WS daemon; needs to run unsandboxed (`bin/ego-cdp stop`)     |
| `ws`       | ✅ Yes           | Routes through daemon on socket                                            |

## Lifecycle

- `../../bin/ego-cdp status` - check if Chrome and WS daemon are running - allowed by sandbox, no escalation needed
- `../../bin/ego-cdp start` - start Chrome and WS daemon (detects partial state and restarts if needed) - needs sandbox escalation
- `../../bin/ego-cdp stop` - stop Chrome and WS daemon - needs sandbox escalation

## CDP Access - allowed by sandbox, no escalation

All commands use the flattened session model on the browser endpoint. Use `sessionId` to target specific pages.

`../../bin/ego-cdp ws '<message>' [--timeout=ms] [--output=FILE]` - allowed by sandbox, no escalation needed

### Examples (non-exhaustive)

- `../../bin/ego-cdp ws '{"id":1,"method":"Browser.getVersion"}'` - browser version
- `../../bin/ego-cdp ws '{"id":1,"method":"Target.getTargets"}'` - list all tabs
- `../../bin/ego-cdp ws '{"id":1,"method":"Target.createTarget","params":{"url":"<url>","background":true}}'` - create tab in background (no focus steal)
- `../../bin/ego-cdp ws '{"id":1,"method":"Target.closeTarget","params":{"targetId":"<id>"}}'` - close a tab
- `../../bin/ego-cdp ws '{"id":1,"method":"Target.attachToTarget","params":{"targetId":"<id>","flatten":true}}'` - attach to tab and get `sessionId`
- `../../bin/ego-cdp ws '{"id":2,"sessionId":"<sessionId>","method":"Page.navigate","params":{"url":"<url>"}}'` - send target-scoped command using `sessionId`
- `../../bin/ego-cdp ws '{"id":3,"sessionId":"<sessionId>","method":"Runtime.evaluate","params":{"expression":"document.title"}}'` - evaluate JS in a tab

## General instructions

- DO NOT reuse an open tab unless explicitly asked - these may be in use by another agent
- Prefer not to take screenshots - it is slower
- YOU MUST Use `Input.*` commands to interact with UI elements - other ways are a waste of time
  - Prefer: synthesized commands such as `synthesizeTapGesture`, `insertText`, `synthesizeScrollGesture`
  - Prefer: `dispatchKeyEvent` with `commands` property
  - Last resort: raw events such as `dispatchKeyEvent`, `dispatchMouseEvent`
  - Check input/checkbox values before interaction - otherwise you might clobber or make incorrect changes
- Prefer AX-first UI automation when possible.
  - Use AX tree APIs to find controls by semantic role/name instead of guessing selectors.
  - AX retrieval commands include: `Accessibility.getFullAXTree`, `Accessibility.getPartialAXTree`, `Accessibility.getRootAXNode`, `Accessibility.getAXNodeAndAncestors`, `Accessibility.getChildAXNodes`, and `Accessibility.queryAXTree`.
  - Start with `Accessibility.getFullAXTree` unless you have a reason to request a smaller subset.
  - AX `nodeId` identifies the accessibility node; use `backendDOMNodeId` from that AX node for `DOM.*` calls such as `DOM.resolveNode`, `DOM.focus`, and `DOM.getBoxModel`.
  - AX roles may differ from visual appearance or raw HTML (`button` vs `textbox`/`combobox`), so trust the AX tree.
  - After any interaction that changes UI state, get a fresh AX snapshot and re-find the relevant nodes.
- DO NOT use arbitrary network calls - they will be blocked by sandbox
- `--output=FILE` outputs raw CDP JSON and does not perform any conversions
- Prefer in-page data extraction (`Runtime.evaluate` + `fetch`/DOM/script parsing) for massive tasks.
  - Rationale: in-page requests run in the site context (same cookies/session/origin/CORS behavior), so they are usually more reliable than external HTTP calls.
  - Use this for pagination, bulk extraction, hidden metadata (`script` blobs / JSON), and export-style endpoints.
  - Build deterministic loops (e.g. vary `pn=1..N`), extract stable IDs/URLs, and dedupe in a set/map.
  - Stop on empty pages or repeated page signatures; do not trust a single visible UI count.
  - Return compact structured output (counts + IDs/URLs) and compare against local tracked data.
