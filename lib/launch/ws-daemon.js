import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import waitOn from 'wait-on';
import { getWsDaemonSocketPath, getWsDaemonPidFile } from '../common/config.js';
import { isRunning, readPid, stopProcess } from '../common/pid.js';

const PID_FILE = getWsDaemonPidFile();
const SOCKET_PATH = getWsDaemonSocketPath();
const SOCKET_TIMEOUT_MS = 3000;

const DAEMON_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'ws-daemon-main.js',
);

export async function start(cdpInfo) {
  const { port, browserContextPath } = cdpInfo ?? {};
  if (!Number.isInteger(port) || port <= 0 || !browserContextPath) {
    throw new Error(`Invalid cdpInfo: ${JSON.stringify(cdpInfo)}`);
  }

  const pid = readPid(PID_FILE);
  if (pid && isRunning(pid)) {
    console.log(`WS daemon already running (pid ${pid}).`);
    return;
  }

  // Clean stale socket
  try { fs.unlinkSync(SOCKET_PATH); } catch {}

  const child = spawn(process.execPath, [
    DAEMON_SCRIPT,
    '--port', String(port),
    '--browser-context-path', browserContextPath,
  ], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // Wait for the Unix socket to appear (means the daemon is listening)
  await waitOn({
    resources: [SOCKET_PATH],
    timeout: SOCKET_TIMEOUT_MS,
  });

  console.log(`WS daemon started (pid ${child.pid}, CDP port ${port}).`);
}

export function stop() {
  stopProcess('WS daemon', PID_FILE);
  try { fs.unlinkSync(SOCKET_PATH); } catch {}
}

export function getPid() {
  return readPid(PID_FILE);
}
