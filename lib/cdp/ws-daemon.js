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

// ── Single persistent WebSocket to Chrome browser endpoint ───────────

let ws = null;
let wsReady = null; // Promise that resolves when ws is OPEN

function ensureWs() {
  if (ws && ws.readyState === WebSocket.OPEN) return wsReady;
  if (ws && ws.readyState === WebSocket.CONNECTING) return wsReady;

  ws = new WebSocket(`ws://localhost:${cdpPort}${browserContextPath}`);

  wsReady = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve(), { once: true });
    ws.addEventListener('close', () => {
      ws = null;
      wsReady = null;
      reject(new Error('WebSocket closed before open'));
    }, { once: true });
  });

  return wsReady;
}

// ── Serialized request queue ─────────────────────────────────────────
// One request at a time: send message, wait for the first response with
// a matching id, then process the next request.

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

  await ensureWs();

  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.removeEventListener('message', onMessage);
      reject(new Error('Timeout'));
    }, timeout);

    function onMessage(e) {
      if (settled) return;
      const text = typeof e.data === 'string' ? e.data : e.data.toString();
      // Accept the first response that has an id field (skip events)
      try {
        const parsed = JSON.parse(text);
        if (parsed.id === undefined) return; // event, keep waiting
      } catch {
        // non-JSON, keep waiting
        return;
      }
      settled = true;
      clearTimeout(timer);
      ws.removeEventListener('message', onMessage);
      resolve(text);
    }

    ws.addEventListener('message', onMessage);
    ws.send(normalizedMessage);
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
