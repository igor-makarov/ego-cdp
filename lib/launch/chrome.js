import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { USER_DATA_DIR } from '../common/config.js';
import { isRunning, readPid, stopProcess } from '../common/pid.js';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PID_FILE = path.join(USER_DATA_DIR, 'cdp.pid');

function getRandomPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function buildArgs(cdpPort) {
  return [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--profile-directory=Ego',
    '--restore-last-session',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-update',
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
  ];
}

export async function start() {
  const pid = readPid(PID_FILE);
  if (pid && isRunning(pid)) {
    console.log(`Chrome already running (pid ${pid}).`);
    return null;
  }

  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  const cdpPort = await getRandomPort();

  const child = spawn(CHROME, buildArgs(cdpPort), {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  fs.writeFileSync(PID_FILE, String(child.pid));
  console.log(`Chrome started (pid ${child.pid}, CDP port ${cdpPort}).`);

  return cdpPort;
}

export function stop() {
  stopProcess('Chrome', PID_FILE);
}

export function getPid() {
  return readPid(PID_FILE);
}
