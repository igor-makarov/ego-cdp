import path from 'path';

export function getUserDataDir() {
  return process.env.USER_DATA_DIR || path.join(process.env.HOME, '.chrome');
}

export function getWsDaemonSocketPath() {
  return path.join(getUserDataDir(), 'ego-cdp.sock');
}

export function getWsDaemonPidFile() {
  return path.join(getUserDataDir(), 'ws-daemon.pid');
}
