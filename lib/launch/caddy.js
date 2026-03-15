import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getUserDataDir, getProxySocketPath } from '../common/config.js';
import { isRunning, readPid, stopProcess } from '../common/pid.js';

const PID_FILE = path.join(getUserDataDir(), 'caddy.pid');
const CONFIG_FILE = path.join(getUserDataDir(), 'caddy.json');

function buildReverseProxyHandle(port) {
  return {
    handler: 'reverse_proxy',
    upstreams: [{ dial: `localhost:${port}` }],
  };
}

function buildConfig(cdpInfo) {
  const { port, browserContextPath } = cdpInfo;

  return {
    admin: { disabled: true },
    apps: {
      http: {
        servers: {
          cdp: {
            listen: [`unix/${getProxySocketPath()}`],
            automatic_https: { disable: true },
            routes: [
              {
                match: [{ host: ["localhost"], path: ['/devtools/browser'] }],
                handle: [
                  { handler: 'rewrite', uri: browserContextPath },
                  buildReverseProxyHandle(port),
                ],
              },
              {
                match: [{ host: ["localhost"] }],
                handle: [buildReverseProxyHandle(port)],
              },
            ]
          }
        }
      }
    }
  };
}

export function start(cdpInfo) {
  const pid = readPid(PID_FILE);
  if (pid && isRunning(pid)) {
    console.log(`Caddy already running (pid ${pid}).`);
    return;
  }

  const { port, browserContextPath } = cdpInfo ?? {};
  if (!Number.isInteger(port) || port <= 0 || !browserContextPath) {
    throw new Error(`Invalid cdpInfo: ${JSON.stringify(cdpInfo)}`);
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(buildConfig(cdpInfo), null, 2));

  const child = spawn('caddy', ['start', '--config', CONFIG_FILE, '--pidfile', PID_FILE], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const configDisplay = CONFIG_FILE.replace(process.env.HOME, '~');
  const socketDisplay = getProxySocketPath().replace(process.env.HOME, '~');
  console.log(`Caddy starting (${socketDisplay} → localhost:${port}), config: ${configDisplay}`);
}

export function stop() {
  stopProcess('Caddy', PID_FILE);
}

export function getPid() {
  return readPid(PID_FILE);
}
