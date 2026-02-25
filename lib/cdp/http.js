import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { getProxyPort } from '../launch/common.js';

setGlobalDispatcher(new EnvHttpProxyAgent());

export async function runHttpCommand({ method = 'GET', path } = {}) {
  const res = await fetch(`http://cdp.test:${getProxyPort()}${path}`, { method });
  return res.text();
}
