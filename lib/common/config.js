import path from 'path';
import { Agent } from 'undici';

export function getUserDataDir() {
  return process.env.USER_DATA_DIR || path.join(process.env.HOME, '.chrome');
}

export function getProxySocketPath() {
  return path.join(getUserDataDir(), 'ego-cdp.sock');
}

export function getWsDaemonSocketPath() {
  return path.join(getUserDataDir(), 'ego-cdp-ws-daemon.sock');
}

export function getWsDaemonPidFile() {
  return path.join(getUserDataDir(), 'ws-daemon.pid');
}

export function getSocketDispatcher() {
  return new Agent({
    connect: { socketPath: getProxySocketPath() },
  });
}
