import fs from 'fs';
import path from 'path';

export const USER_DATA_DIR = path.join(process.env.HOME, '.chrome');

function assertNotSandboxed() {
  try {
    process.kill(process.ppid, 0);
  } catch {
    throw new Error('Cannot run inside sandbox (process signals blocked)');
  }
}

export function isRunning(pid) {
  assertNotSandboxed();
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function readPid(pidFile) {
  try {
    return parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
  } catch {
    return null;
  }
}

export function stopProcess(name, pidFile) {
  assertNotSandboxed();
  const pid = readPid(pidFile);
  if (!pid || !isRunning(pid)) {
    console.log(`${name} not running.`);
    try { fs.unlinkSync(pidFile); } catch {}
    return;
  }

  process.kill(pid, 'SIGTERM');
  try { fs.unlinkSync(pidFile); } catch {}
  console.log(`${name} stopped (pid ${pid}).`);
}

export function getProxyPort() {
  return parseInt(process.env.PORT, 10) || 9222;
}
