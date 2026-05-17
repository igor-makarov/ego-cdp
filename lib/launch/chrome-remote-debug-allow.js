import { execFile } from 'child_process';

const OSASCRIPT_TIMEOUT_MS = Number.parseInt(process.env.EGO_CDP_ALLOW_OSASCRIPT_TIMEOUT_MS || '2000', 10);
const TRIGGER_DELAYS_MS = (process.env.EGO_CDP_ALLOW_TRIGGER_DELAYS_MS || '2000,5000,10000')
  .split(',')
  .map((part) => Number.parseInt(part.trim(), 10))
  .filter((delay) => Number.isFinite(delay) && delay >= 0);

const CLICK_ALLOW_JXA = String.raw`
function safe(fn, fallback) { try { return fn(); } catch (_) { return fallback; } }
function findAllowButton(e, depth) {
  if (depth < 0 || !e) return null;
  var role = safe(function(){ return e.role(); }, "");
  if (role === "AXButton") {
    var desc = safe(function(){ return e.description(); }, "") || "";
    var name = safe(function(){ return e.name(); }, "") || "";
    if (desc === "Allow" || name === "Allow") return e;
  }
  var children = safe(function(){ return e.uiElements(); }, []);
  for (var i = 0; i < children.length; i++) {
    var found = findAllowButton(children[i], depth - 1);
    if (found) return found;
  }
  return null;
}
var se = Application("System Events");
var chrome = se.applicationProcesses.whose({ name: "Google Chrome" })();
if (!chrome.length) {
  "chrome-not-running";
} else {
  var clicked = false;
  var windows = safe(function(){ return chrome[0].windows(); }, []);
  for (var wi = 0; wi < windows.length && !clicked; wi++) {
    var sheets = safe(function(){ return windows[wi].sheets(); }, []);
    for (var si = 0; si < sheets.length && !clicked; si++) {
      var sheet = sheets[si];
      var title = safe(function(){ return sheet.title(); }, "") || safe(function(){ return sheet.name(); }, "") || "";
      if (title !== "Allow remote debugging?") continue;
      var button = findAllowButton(sheet, 12);
      if (!button) continue;
      button.actions.byName("AXPress").perform();
      clicked = true;
    }
  }
  clicked ? "clicked" : "no-popup";
}
`;

export function createChromeRemoteDebugAllowWatcher({ enabled }) {
  let timers = [];
  let inFlight = false;

  function runClickCheck() {
    return new Promise((resolve, reject) => {
      const child = execFile(
        'osascript',
        ['-l', 'JavaScript', '-e', CLICK_ALLOW_JXA],
        { timeout: OSASCRIPT_TIMEOUT_MS },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr.trim() || error.message));
            return;
          }
          resolve(stdout.trim());
        },
      );
      child.stdin?.end();
    });
  }

  async function tick() {
    if (!enabled || inFlight) return;
    inFlight = true;
    try {
      await runClickCheck();
    } catch {
      // Best effort only. The client request will surface CDP errors/timeouts.
    } finally {
      inFlight = false;
    }
  }

  return {
    trigger() {
      if (!enabled) return;
      for (const delay of TRIGGER_DELAYS_MS) {
        const timer = setTimeout(() => {
          timers = timers.filter((scheduled) => scheduled !== timer);
          void tick();
        }, delay);
        timer.unref?.();
        timers.push(timer);
      }
    },

    stop() {
      for (const timer of timers) clearTimeout(timer);
      timers = [];
    },
  };
}
