import fs from 'fs';
import path from 'path';

const DEFAULT_CONFIG = {
  headless: false,
  user: false,
  port: 9222,
};

export function getUserDataDir() {
  return process.env.USER_DATA_DIR || path.join(process.env.HOME, '.chrome');
}

export function getConfigPath() {
  return path.join(getUserDataDir(), 'config.json');
}

export function getChromeConfig() {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  return {
    ...DEFAULT_CONFIG,
    ...JSON.parse(fs.readFileSync(configPath, 'utf8')),
  };
}

export function getWsDaemonSocketPath() {
  return path.join(getUserDataDir(), 'ego-cdp.sock');
}

export function getWsDaemonPidFile() {
  return path.join(getUserDataDir(), 'ws-daemon.pid');
}
