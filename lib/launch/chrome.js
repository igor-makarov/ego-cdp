import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import waitOn from 'wait-on';
import { getUserDataDir } from '../common/config.js';
import { isRunning, readPid, stopProcess } from '../common/pid.js';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PID_FILE = path.join(getUserDataDir(), 'cdp.pid');
const DEVTOOLS_ACTIVE_PORT_FILE = path.join(getUserDataDir(), 'DevToolsActivePort');
const PORT_FILE_TIMEOUT_MS = 3000;

function buildArgs(userDataDir, headless) {
  const args = [
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--profile-directory=Ego',
    '--restore-last-session',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-update',
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
  ];

  if (headless) {
    args.push('--headless');
    args.push('--disable-gpu');
  }

  return args;
}

function readDevToolsActivePortInfo(portFile) {
  try {
    const lines = fs.readFileSync(portFile, 'utf8').split('\n');
    const port = Number.parseInt(lines[0]?.trim(), 10);
    const browserContextPath = lines[1]?.trim();

    if (!Number.isInteger(port) || port <= 0 || !browserContextPath) {
      return null;
    }

    return { port, browserContextPath };
  } catch {
    return null;
  }
}

export async function start({ headless = false } = {}) {
  const pid = readPid(PID_FILE);
  if (pid && isRunning(pid)) {
    console.log(`Chrome already running (pid ${pid}).`);
    return null;
  }

  const userDataDir = getUserDataDir();
  fs.mkdirSync(userDataDir, { recursive: true });

  const child = spawn(CHROME, buildArgs(userDataDir, headless), {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  fs.writeFileSync(PID_FILE, String(child.pid));

  await waitOn({
    resources: [DEVTOOLS_ACTIVE_PORT_FILE],
    timeout: PORT_FILE_TIMEOUT_MS,
  });

  const cdpInfo = readDevToolsActivePortInfo(DEVTOOLS_ACTIVE_PORT_FILE);
  if (!cdpInfo) {
    throw new Error(`Invalid DevToolsActivePort contents in ${DEVTOOLS_ACTIVE_PORT_FILE}`);
  }

  console.log(`Chrome started (pid ${child.pid}, CDP port ${cdpInfo.port}).`);

  return cdpInfo;
}

export function stop() {
  stopProcess('Chrome', PID_FILE);
  try { fs.unlinkSync(DEVTOOLS_ACTIVE_PORT_FILE); } catch {}
}

export function getPid() {
  return readPid(PID_FILE);
}
