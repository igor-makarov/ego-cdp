import { assertProxyConfigured } from '../common/network.js';
import { getProxyPort } from '../common/config.js';

export async function runHttpCommand({ method = 'GET', path } = {}) {
  assertProxyConfigured();
  const res = await fetch(`http://ego-cdp.localhost:${getProxyPort()}${path}`, { method });
  return res.text();
}
