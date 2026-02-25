const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { USER_DATA_DIR, isRunning, readPid, stopProcess } = require('./common');

const PID_FILE = path.join(USER_DATA_DIR, 'caddy.pid');
const CONFIG_FILE = path.join(USER_DATA_DIR, 'caddy.json');

function buildConfig(proxyPort, cdpPort) {
  return {
    admin: { disabled: true },
    apps: {
      http: {
        servers: {
          cdp: {
            listen: [`:${proxyPort}`],
            automatic_https: { disable: true },
            routes: [{
              match: [{ host: ['cdp.test'] }],
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

function start(proxyPort, cdpPort) {
  const pid = readPid(PID_FILE);
  if (pid && isRunning(pid)) {
    console.log(`Caddy already running (pid ${pid}).`);
    return;
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(buildConfig(proxyPort, cdpPort), null, 2));

  const child = spawn('caddy', ['start', '--config', CONFIG_FILE, '--pidfile', PID_FILE], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const configDisplay = CONFIG_FILE.replace(process.env.HOME, '~');
  console.log(`Caddy starting (cdp.test:${proxyPort} → localhost:${cdpPort}), config: ${configDisplay}`);
}

function stop() {
  stopProcess('Caddy', PID_FILE);
}

function getPid() {
  return readPid(PID_FILE);
}

module.exports = { start, stop, getPid };
