import { getSocketDispatcher } from '../common/config.js';

export async function runWsCommand({ path, message, timeout }) {
  // Workaround: some tools escape ! as \\! in arguments
  const normalizedMessage = message.replaceAll('\\!', '!');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost${path}`, {
      dispatcher: getSocketDispatcher(),
    });

    let settled = false;
    let timer;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch {}
      fn(value);
    };

    timer = setTimeout(() => finish(reject, new Error('Timeout')), timeout);

    ws.onopen = () => ws.send(normalizedMessage);
    ws.onmessage = (e) => {
      const text = e.data;
      if (wsResponseHasError(text)) {
        finish(reject, new Error(text));
        return;
      }
      finish(resolve, text);
    };
    ws.onerror = (e) => finish(reject, new Error(e?.message ?? 'WebSocket error'));
  });
}

function wsResponseHasError(text) {
  try {
    const parsed = JSON.parse(text);
    return Boolean(parsed.error) || Boolean(parsed.result?.exceptionDetails);
  } catch {
    return false;
  }
}
