import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getUserDataDir } from '../common/config.js';
import { isRunning, readPid, stopProcess } from '../common/pid.js';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PID_FILE = path.join(getUserDataDir(), 'cdp.pid');
const CDP_PORT = parseInt(process.env.PORT, 10) || 9222;
const DEFAULT_CHROME_USER_DIR = path.join(
  process.env.HOME,
  'Library/Application Support/Google/Chrome',
);

function buildArgs(userDataDir, headless) {
  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
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

/**
 * Use curl with --retry to wait for Chrome's CDP endpoint, then extract
 * the browser WebSocket path from /json/version.
 */
function fetchBrowserSocketPath() {
  const url = `http://localhost:${CDP_PORT}/json/version`;
  const out = execSync(
    `curl -s --retry 3 --retry-all-errors "${url}"`,
  ).toString();

  const json = JSON.parse(out);
  const wsUrl = json.webSocketDebuggerUrl;
  if (!wsUrl) {
    throw new Error(`No webSocketDebuggerUrl in /json/version response`);
  }

  const browserContextPath = new URL(wsUrl).pathname;
  return { port: CDP_PORT, browserContextPath };
}

/**
 * Read Chrome's DevToolsActivePort file from the given user data directory.
 * The file contains the port on line 1 and the browser path on line 2.
 */
function readDevToolsActivePort(userDataDir) {
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  const content = fs.readFileSync(portFile, 'utf8').trim();
  const lines = content.split('\n');
  const port = parseInt(lines[0], 10);
  const browserContextPath = lines[1];
  if (!port || !browserContextPath) {
    throw new Error(`Invalid DevToolsActivePort file at ${portFile}`);
  }
  return { port, browserContextPath };
}

export async function start({ headless = false, user = false } = {}) {
  const userDataDir = getUserDataDir();
  fs.mkdirSync(userDataDir, { recursive: true });

  let cdpInfo;
  if (user) {
    cdpInfo = readDevToolsActivePort(DEFAULT_CHROME_USER_DIR);
    fs.writeFileSync(PID_FILE, '0');
    console.log(`Using user Chrome (CDP port ${cdpInfo.port}).`);
  } else {
    const pid = readPid(PID_FILE);
    if (pid && isRunning(pid)) {
      console.log(`Chrome already running (pid ${pid}).`);
      return null;
    }

    const child = spawn(CHROME, buildArgs(userDataDir, headless), {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    fs.writeFileSync(PID_FILE, String(child.pid));
    cdpInfo = fetchBrowserSocketPath();
    console.log(`Chrome started (pid ${child.pid}, CDP port ${cdpInfo.port}).`);
  }

  return cdpInfo;
}

export function stop() {
  stopProcess('Chrome', PID_FILE);
}

export function getPid() {
  return readPid(PID_FILE);
}
