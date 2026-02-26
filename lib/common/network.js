import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

// Must be called before any fetch/WebSocket usage.
// Sets up `fetch()` to use the sandbox proxy, including for *.localhost domains.
export function setupProxy() {
  setGlobalDispatcher(new EnvHttpProxyAgent({ noProxy: '' }));
}
