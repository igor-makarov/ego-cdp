import fs from 'fs';
import path from 'path';

export const USER_DATA_DIR = path.join(process.env.HOME, '.chrome');

export function isRunning(pid) {
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
