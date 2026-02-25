import path from 'path';

export const USER_DATA_DIR = path.join(process.env.HOME, '.chrome');

export function getProxyPort() {
  return parseInt(process.env.PORT, 10) || 9222;
}
