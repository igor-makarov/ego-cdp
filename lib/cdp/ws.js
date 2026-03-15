import net from 'net';
import { getWsDaemonSocketPath } from '../common/config.js';

/**
 * Send a CDP message over the persistent browser WebSocket via the daemon.
 * The daemon keeps the connection open between CLI invocations.
 */
export async function runWsCommand({ message, timeout = 60000 }) {
  const socketPath = getWsDaemonSocketPath();

  return new Promise((resolve, reject) => {
    const conn = net.createConnection(socketPath);
    let buffer = '';
    let settled = false;

    const finish = (fn, val) => {
      if (settled) return;
      settled = true;
      conn.destroy();
      fn(val);
    };

    // Give the daemon a little extra headroom beyond the inner timeout
    const outerTimer = setTimeout(
      () => finish(reject, new Error('Daemon timeout')),
      timeout + 5000,
    );

    conn.on('connect', () => {
      conn.write(JSON.stringify({ message, timeout }) + '\n');
    });

    conn.on('data', (chunk) => {
      buffer += chunk.toString();
      const idx = buffer.indexOf('\n');
      if (idx === -1) return;

      clearTimeout(outerTimer);
      const line = buffer.slice(0, idx);
      try {
        const response = JSON.parse(line);
        if (response.ok) {
          if (wsResponseHasError(response.data)) {
            finish(reject, new Error(response.data));
          } else {
            finish(resolve, response.data);
          }
        } else {
          finish(reject, new Error(response.error || 'Daemon error'));
        }
      } catch {
        finish(reject, new Error('Invalid daemon response'));
      }
    });

    conn.on('error', (e) => {
      clearTimeout(outerTimer);
      finish(reject, e);
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

function wsResponseHasError(text) {
  try {
    const parsed = JSON.parse(text);
    return Boolean(parsed.error) || Boolean(parsed.result?.exceptionDetails);
  } catch {
    return false;
  }
}
