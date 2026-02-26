import { assertProxyConfigured } from '../common/network.js';
import { getProxyHost, getProxyPort } from '../common/config.js';

export async function runHttpCommand({ method = 'GET', path } = {}) {
  assertProxyConfigured();
  const res = await fetch(`http://${getProxyHost()}:${getProxyPort()}${path}`, { method });
  return res.text();
}
