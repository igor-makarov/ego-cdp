import path from 'path';

export const USER_DATA_DIR = path.join(process.env.HOME, '.chrome');

export function getProxyHost() {
  const host = process.env.HOST || 'ego-cdp.localhost';
  if (!host.endsWith('.localhost')) {
    throw new Error(`HOST must be a .localhost domain, got: ${host}`);
  }
  return host;
}

export function getProxyPort() {
  return parseInt(process.env.PORT, 10) || 9222;
}
