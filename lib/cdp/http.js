const { EnvHttpProxyAgent, setGlobalDispatcher } = require('undici');
const { getProxyPort } = require('../launch/common');

setGlobalDispatcher(new EnvHttpProxyAgent());

async function runHttpCommand({ method = 'GET', path } = {}) {
  const res = await fetch(`http://cdp.test:${getProxyPort()}${path}`, { method });
  return res.text();
}

module.exports = { runHttpCommand };
