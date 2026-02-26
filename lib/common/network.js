import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

// Force .localhost domains through the proxy instead of bypassing it.
// Without noProxy: '', undici (and curl) skip the proxy for .localhost,
// which breaks sandbox networking that relies on proxy-based domain filtering.
setGlobalDispatcher(new EnvHttpProxyAgent({ noProxy: '' }));
