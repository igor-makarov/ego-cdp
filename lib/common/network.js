import { EnvHttpProxyAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

// Subclass that forces noProxy: '' so .localhost domains go through the proxy.
// Used as a marker type for assertProxyConfigured().
class SandboxProxyAgent extends EnvHttpProxyAgent {
  constructor() {
    super({ noProxy: '' });
  }
}

// Must be called before any fetch/WebSocket usage.
// Sets up all network calls to use the sandbox proxy, including for *.localhost domains.
export function setupProxy() {
  setGlobalDispatcher(new SandboxProxyAgent());
}

// Throws if setupProxy() was not called.
export function assertProxyConfigured() {
  if (!(getGlobalDispatcher() instanceof SandboxProxyAgent)) {
    throw new Error('Proxy not configured — call setupProxy() before making network requests');
  }
}
