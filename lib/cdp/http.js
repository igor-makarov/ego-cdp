import { getSocketDispatcher } from '../common/config.js';

export async function runHttpCommand({ method = 'GET', path } = {}) {
  const res = await fetch(`http://localhost${path}`, {
    method,
    dispatcher: getSocketDispatcher(),
  });
  return res.text();
}
