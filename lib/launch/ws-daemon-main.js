import net from 'net';
import fs from 'fs';
import { parseArgs } from 'util';
import { getWsDaemonSocketPath, getWsDaemonPidFile } from '../common/config.js';

// ── CLI arguments ────────────────────────────────────────────────────

const { values: args } = parseArgs({
  options: {
    port:                   { type: 'string' },
    'browser-context-path': { type: 'string' },
  },
});

const cdpPort = parseInt(args.port, 10);
const browserContextPath = args['browser-context-path'];

if (!Number.isInteger(cdpPort) || cdpPort <= 0 || !browserContextPath) {
  console.error('Usage: ws-daemon --port=PORT --browser-context-path=PATH');
  process.exit(1);
}

// ── Persistent WebSocket to Chrome browser endpoint ──────────────────

let ws = null;
let wsReady = null; // Promise that resolves when ws is OPEN

function getExpectedResponse(message) {
  try {
    const parsed = JSON.parse(message);
    return {
      id: parsed.id,
      sessionId: parsed.sessionId,
    };
  } catch {
    return {
      id: undefined,
      sessionId: undefined,
    };
  }
}

function sendOverCurrentWs(message, { timeout = 60000, expectedId = undefined, expectedSessionId = undefined } = {}) {
  const currentWs = ws;
  if (!currentWs || currentWs.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('WebSocket is not open'));
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      currentWs.removeEventListener('message', onMessage);
      currentWs.removeEventListener('close', onClose);
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error('Timeout'));
    }, timeout);

    function onClose() {
      finish(reject, new Error('WebSocket closed'));
    }

    function onMessage(e) {
      if (settled) return;
      const text = typeof e.data === 'string' ? e.data : e.data.toString();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }

      if (parsed.id === undefined) return; // event, keep waiting
      if (expectedId !== undefined && parsed.id !== expectedId) return;
      if (expectedSessionId !== undefined && parsed.sessionId !== expectedSessionId) return;

      finish(resolve, text);
    }

    currentWs.addEventListener('message', onMessage);
    currentWs.addEventListener('close', onClose, { once: true });
    currentWs.send(message);
  });
}

function ensureWs() {
  if (ws && ws.readyState === WebSocket.OPEN) return wsReady;
  if (ws && ws.readyState === WebSocket.CONNECTING) return wsReady;

  // When ego-cdp is started with --user, establishing the first DevTools
  // WebSocket connection may trigger a Chrome permission dialog that the
  // user has to approve.
  ws = new WebSocket(`ws://localhost:${cdpPort}${browserContextPath}`);
  const currentWs = ws;

  currentWs.addEventListener('close', () => {
    if (ws === currentWs) {
      ws = null;
      wsReady = null;
    }
  }, { once: true });

  wsReady = new Promise((resolve, reject) => {
    function onOpen() {
      currentWs.removeEventListener('close', onCloseBeforeOpen);
      resolve();
    }

    function onCloseBeforeOpen() {
      reject(new Error('WebSocket closed before open'));
    }

    currentWs.addEventListener('open', onOpen, { once: true });
    currentWs.addEventListener('close', onCloseBeforeOpen, { once: true });
  });

  return wsReady;
}

// ── Serialized request queue ─────────────────────────────────────────
// One request at a time: send message, wait for the matching response,
// then process the next request.

const queue = [];
let processing = false;

function enqueue(request) {
  return new Promise((resolve, reject) => {
    queue.push({ request, resolve, reject });
    drain();
  });
}

async function drain() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const { request, resolve, reject } = queue.shift();
    try {
      const result = await executeRequest(request);
      resolve(result);
    } catch (err) {
      reject(err);
    }
  }

  processing = false;
}

async function executeRequest({ message, timeout = 60000 }) {
  const normalizedMessage = message.replaceAll('\\!', '!');
  const expectedResponse = getExpectedResponse(normalizedMessage);

  await ensureWs();

  return sendOverCurrentWs(normalizedMessage, {
    timeout,
    expectedId: expectedResponse.id,
    expectedSessionId: expectedResponse.sessionId,
  });
}

// ── IPC server on a Unix socket ──────────────────────────────────────
//
// Protocol (newline-delimited JSON):
//   → { "message": "{...}", "timeout": 60000 }
//   ← { "ok": true,  "data": "..." }
//   ← { "ok": false, "error": "..." }

const socketPath = getWsDaemonSocketPath();
try { fs.unlinkSync(socketPath); } catch {}

const server = net.createServer((conn) => {
  let buffer = '';

  conn.on('data', (chunk) => {
    buffer += chunk.toString();
    const idx = buffer.indexOf('\n');
    if (idx === -1) return;

    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);

    let request;
    try {
      request = JSON.parse(line);
    } catch {
      conn.end(JSON.stringify({ ok: false, error: 'Invalid JSON request' }) + '\n');
      return;
    }

    enqueue(request)
      .then((data) => conn.end(JSON.stringify({ ok: true, data }) + '\n'))
      .catch((err) => conn.end(JSON.stringify({ ok: false, error: err.message }) + '\n'));
  });

  conn.on('error', () => {}); // ignore client disconnects
});

server.listen(socketPath, () => {
  fs.writeFileSync(getWsDaemonPidFile(), String(process.pid));
  if (process.send) process.send('ready');
});

// ── Graceful shutdown ────────────────────────────────────────────────

function shutdown() {
  if (ws) try { ws.close(); } catch {}
  server.close();
  try { fs.unlinkSync(socketPath); } catch {}
  try { fs.unlinkSync(getWsDaemonPidFile()); } catch {}
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
