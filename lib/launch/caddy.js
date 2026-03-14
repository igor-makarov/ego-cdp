import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getUserDataDir, getProxySocketPath } from '../common/config.js';
import { isRunning, readPid, stopProcess } from '../common/pid.js';

const PID_FILE = path.join(getUserDataDir(), 'caddy.pid');
const CONFIG_FILE = path.join(getUserDataDir(), 'caddy.json');

function buildConfig(cdpPort) {
  return {
    admin: { disabled: true },
    apps: {
      http: {
        servers: {
          cdp: {
            listen: [`unix/${getProxySocketPath()}`],
            automatic_https: { disable: true },
            routes: [{
              match: [{ host: ["localhost"] }],
              handle: [{
                handler: 'reverse_proxy',
                upstreams: [{ dial: `localhost:${cdpPort}` }],
                headers: {
                  request: {
                    set: { Host: ['localhost'] }
                  }
                }
              }]
            }]
          }
        }
      }
    }
  };
}

export function start(cdpPort) {
  const pid = readPid(PID_FILE);
  if (pid && isRunning(pid)) {
    console.log(`Caddy already running (pid ${pid}).`);
    return;
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(buildConfig(cdpPort), null, 2));

  const child = spawn('caddy', ['start', '--config', CONFIG_FILE, '--pidfile', PID_FILE], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const configDisplay = CONFIG_FILE.replace(process.env.HOME, '~');
  const socketDisplay = getProxySocketPath().replace(process.env.HOME, '~');
  console.log(`Caddy starting (${socketDisplay} → localhost:${cdpPort}), config: ${configDisplay}`);
}

export function stop() {
  stopProcess('Caddy', PID_FILE);
}

export function getPid() {
  return readPid(PID_FILE);
}
