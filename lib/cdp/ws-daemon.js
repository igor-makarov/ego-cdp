import net from 'net';
import fs from 'fs';
import { getSocketDispatcher, getWsDaemonSocketPath, getWsDaemonPidFile } from '../common/config.js';

// ── WebSocket connection pool keyed by path ──────────────────────────

const pool = new Map(); // path → { ws, pending, readyPromise }

function getOrCreateWs(wsPath) {
  let entry = pool.get(wsPath);
  if (entry) {
    const { readyState } = entry.ws;
    if (readyState === WebSocket.OPEN || readyState === WebSocket.CONNECTING) {
      return entry;
    }
    pool.delete(wsPath);
  }

  const ws = new WebSocket(`ws://localhost${wsPath}`, {
    dispatcher: getSocketDispatcher(),
  });
  const pending = new Map();

  let readyResolve, readyReject, connected = false;
  const readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  ws.addEventListener('open', () => {
    connected = true;
    readyResolve();
  });

  ws.addEventListener('message', (e) => {
    const text = typeof e.data === 'string' ? e.data : e.data.toString();
    try {
      const parsed = JSON.parse(text);
      if (parsed.id !== undefined && pending.has(parsed.id)) {
        const cb = pending.get(parsed.id);
        pending.delete(parsed.id);
        cb.resolve(text);
      }
      // Events (no id) are silently ignored
    } catch {
      // Non-JSON messages are ignored
    }
  });

  ws.addEventListener('close', () => {
    if (!connected) readyReject(new Error('WebSocket failed to connect'));
    for (const [, cb] of pending) cb.reject(new Error('WebSocket closed'));
    pending.clear();
    pool.delete(wsPath);
  });

  const newEntry = { ws, pending, readyPromise };
  pool.set(wsPath, newEntry);
  return newEntry;
}

// ── Request handling ─────────────────────────────────────────────────

async function handleRequest({ path: wsPath, message, timeout = 60000 }) {
  const normalizedMessage = message.replaceAll('\\!', '!');

  let msgId;
  try {
    msgId = JSON.parse(normalizedMessage).id;
  } catch {
    throw new Error('Message must be valid JSON');
  }
  if (msgId === undefined) {
    throw new Error('Message must have an "id" field for response routing');
  }

  const entry = getOrCreateWs(wsPath);
  await entry.readyPromise;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      entry.pending.delete(msgId);
      reject(new Error('Timeout'));
    }, timeout);

    entry.pending.set(msgId, {
      resolve: (text) => { clearTimeout(timer); resolve(text); },
      reject:  (err)  => { clearTimeout(timer); reject(err); },
    });

    entry.ws.send(normalizedMessage);
  });
}

// ── IPC server on a Unix socket ──────────────────────────────────────
//
// Protocol (newline-delimited JSON):
//   → { "path": "/devtools/browser", "message": "{...}", "timeout": 60000 }
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

    handleRequest(request)
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
  for (const [, entry] of pool) {
    try { entry.ws.close(); } catch {}
  }
  pool.clear();
  server.close();
  try { fs.unlinkSync(socketPath); } catch {}
  try { fs.unlinkSync(getWsDaemonPidFile()); } catch {}
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
