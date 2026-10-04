/*
 * On-device E2E driver for the release APK (adb + UIAutomator). Dev tool, not an app dependency.
 *   adb install -r dist/ImposterParty-1.0.0.apk
 *   adb shell settings put global animator_duration_scale 0   # UIAutomator needs an idle UI
 *   node scripts/qa/device-e2e.js full      # fresh install → full game incl. background/kill/resume/back
 *   node scripts/qa/device-e2e.js visuals   # large font, light theme, airplane mode
 * Coordinates in FALLBACK assume a 1080×2400 screen.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ADB = process.env.ADB || 'C:/AndroidSdk/platform-tools/adb.exe';
const PKG = 'com.imposterparty.game';
const OUT = path.join(__dirname, '..', '..', 'qa-shots', 'device');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const log = (...a) => console.log('•', ...a);

let shotN = 0;
async function shot(name) {
  const file = path.join(OUT, `${String(++shotN).padStart(2, '0')}-${name}.png`);
  const buf = execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(file, buf);
}

function dump() {
  try {
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
    return adb('shell', 'cat', '/sdcard/ui.xml');
  } catch {
    return '';
  }
}

function nodes(xml) {
  const out = [];
  for (const m of xml.matchAll(/<node ([^>]*?)\/?>/g)) {
    const attrs = {};
    for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    out.push(attrs);
  }
  return out;
}

function decode(s) {
  return (s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function find(xml, { id, text, contains }) {
  return nodes(xml).find((n) => {
    if (id && n['resource-id'] !== id) return false;
    const t = decode(n.text) || decode(n['content-desc']);
    if (text && t !== text) return false;
    if (contains && !t.includes(contains)) return false;
    return true;
  });
}

function center(n) {
  const [x1, y1, x2, y2] = n.bounds.match(/\d+/g).map(Number);
  return [Math.round((x1 + x2) / 2), Math.round((y1 + y2) / 2)];
}

async function waitFor(q, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const xml = dump();
    const n = find(xml, q);
    if (n) return { n, xml };
    await sleep(400);
  }
  throw new Error(`timeout waiting for ${JSON.stringify(q)}`);
}

// Screens with a live timer never become 'idle' for uiautomator; use known positions (1080x2400).
const FALLBACK = { 'discussion-vote': [540, 1956] };

async function tap(q, after = 700) {
  let x, y;
  try {
    const { n } = await waitFor(q, q.id && FALLBACK[q.id] ? 4000 : 12000);
    [x, y] = center(n);
  } catch (e) {
    if (!(q.id && FALLBACK[q.id])) throw e;
    [x, y] = FALLBACK[q.id];
  }
  adb('shell', 'input', 'tap', String(x), String(y));
  await sleep(after);
}

function crashed() {
  const logs = adb('logcat', '-d', '-s', 'AndroidRuntime:E', 'ReactNativeJS:E', 'libc:F');
  return logs.split('\n').filter((l) => /FATAL|Fatal signal|Error|Exception/.test(l));
}

function texts(xml) {
  return nodes(xml)
    .map((n) => decode(n.text))
    .filter(Boolean);
}

async function launch(fresh = false) {
  if (fresh) adb('shell', 'pm', 'clear', PKG);
  adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
  await sleep(2500);
}

async function revealAll(roles, opts = {}) {
  for (let i = 0; i < 25; i++) {
    const xml = dump();
    if (!find(xml, { id: 'reveal-gate-ready' })) break;
    const name = (find(xml, { contains: '— show me' }) || {}).text || `p${i}`;
    await sleep(1000); // arm delay
    await tap({ id: 'reveal-gate-ready' }, 900);
    const { xml: cardXml } = await waitFor({ id: 'role-title' });
    const title = decode(find(cardXml, { id: 'role-title' }).text);
    roles[decode(name).replace(/^I'm /, '').replace(/ — show me$/, '')] = title;
    if (opts.onCard) await opts.onCard(i, title);
    await sleep(800);
    await tap({ id: 'reveal-hide' }, 900);
  }
}

const scenarios = {
  /** Fresh install → onboarding → quick play full game, with backgrounding and kill/restart mid-reveal. */
  async full() {
    adb('logcat', '-c');
    await launch(true);
    await shot('onboarding');
    await tap({ id: 'onboarding-skip' }, 1500);
    await shot('home');
    await tap({ id: 'home-quick' }, 2500);
    await shot('gate');

    // Player 1 reveals, then the app is backgrounded while the card is visible.
    await sleep(1000);
    await tap({ id: 'reveal-gate-ready' }, 900);
    await waitFor({ id: 'role-card' });
    await shot('card-visible');
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
    await sleep(1500);
    await launch();
    let xml = dump();
    const leakAfterBackground = !!find(xml, { id: 'role-card' });
    log('after background → card visible?', leakAfterBackground, '| gate visible?', !!find(xml, { id: 'reveal-gate-ready' }));
    await shot('after-background');

    // Reveal again, then kill the app while the card is visible.
    await sleep(1000);
    await tap({ id: 'reveal-gate-ready' }, 900);
    await waitFor({ id: 'role-card' });
    adb('shell', 'am', 'force-stop', PKG);
    await sleep(1000);
    await launch();
    xml = dump();
    log('after kill → resume dialog?', texts(xml).includes('Resume game?'), '| card visible?', !!find(xml, { id: 'role-card' }));
    await shot('resume-dialog');
    await tap({ text: 'Resume' }, 1800);
    xml = dump();
    log('after resume → gate?', !!find(xml, { id: 'reveal-gate-ready' }), '| card?', !!find(xml, { id: 'role-card' }));

    // Back button during a reveal hides the card.
    await sleep(1000);
    await tap({ id: 'reveal-gate-ready' }, 900);
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await sleep(800);
    xml = dump();
    log('after back → card?', !!find(xml, { id: 'role-card' }), '| gate?', !!find(xml, { id: 'reveal-gate-ready' }));

    const roles = {};
    await revealAll(roles, {
      onCard: async (i, title) => {
        if (i === 0 || /IMPOSTER/.test(title)) await shot(`card-${i}`);
      },
    });
    log('roles', JSON.stringify(roles));
    await shot('reveal-complete');
    await tap({ id: 'clues-start' });
    await shot('clue');
    for (let i = 0; i < 25; i++) {
      if (!find(dump(), { id: 'clue-next' })) break;
      await tap({ id: 'clue-next' }, 600);
    }
    await tap({ id: 'clue-discuss' }, 1200);
    await shot('discussion');
    await tap({ id: 'discussion-vote' }, 900);
    const imposter = Object.keys(roles).find((k) => /IMPOSTER/.test(roles[k]));
    for (let v = 0; v < 25; v++) {
      xml = dump();
      if (find(xml, { id: 'vote-reveal' })) break;
      if (!find(xml, { id: 'vote-gate-ready' })) {
        await sleep(600);
        continue;
      }
      await sleep(1000);
      await tap({ id: 'vote-gate-ready' }, 900);
      xml = dump();
      let target = find(xml, { id: `vote-target-${imposter}` });
      if (!target) target = nodes(xml).find((n) => (n['resource-id'] || '').startsWith('vote-target-'));
      adb('shell', 'input', 'tap', ...center(target).map(String));
      await sleep(400);
      if (v === 0) await shot('ballot');
      await tap({ id: 'vote-lock' }, 1500);
    }
    await tap({ id: 'vote-reveal' }, 2600);
    await shot('vote-result');
    await tap({ id: 'vote-reveal-role' }, 2200);
    await shot('elimination');
    xml = dump();
    if (find(xml, { id: 'elim-guess' })) {
      await tap({ id: 'elim-guess' }, 1000);
      await sleep(1000);
      await tap({ id: 'guess-gate-ready' }, 900);
      await shot('guess');
      xml = dump();
      const choice = nodes(xml).find((n) => (n['resource-id'] || '').startsWith('guess-choice-'));
      adb('shell', 'input', 'tap', ...center(choice).map(String));
      await sleep(400);
      await tap({ id: 'guess-submit' }, 2000);
      await shot('guess-result');
      await tap({ id: 'guess-results' }, 1500);
    } else {
      await tap({ id: 'elim-results' }, 1500);
    }
    await shot('round-result');
    await tap({ id: 'round-scoreboard' }, 1000);
    await shot('scoreboard');
    await tap({ id: 'score-next' }, 2500);
    log('next round gate?', !!find(dump(), { id: 'reveal-gate-ready' }));
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await sleep(900);
    await shot('leave-dialog');
    await tap({ text: 'Leave game' }, 1500);
    await tap({ id: 'home-stats' }, 1200);
    await shot('stats');
    const errs = crashed();
    log('crash/error lines:', errs.length ? errs.join('\n') : 'none');
  },

  /** Visual checks: light theme, large font, airplane mode. Assumes the app was set up by `full`. */
  async visuals() {
    adb('logcat', '-c');
    adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
    adb('shell', 'settings', 'put', 'system', 'font_scale', '1.3');
    await launch();
    await sleep(1500);
    await shot('large-font-home');
    await tap({ id: 'home-play' }, 1500);
    await shot('large-font-players');
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await sleep(800);
    await tap({ id: 'home-settings' }, 1200);
    await tap({ text: 'Light' }, 1200);
    await shot('light-settings');
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await sleep(900);
    await shot('light-home');
    await tap({ id: 'home-quick' }, 2500);
    await sleep(1000);
    await tap({ id: 'reveal-gate-ready' }, 1000);
    await shot('light-card-large-font');
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await sleep(500);
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await sleep(800);
    await tap({ text: 'Leave game' }, 1500);
    await tap({ id: 'home-settings' }, 1200);
    await tap({ text: 'Dark' }, 800);
    adb('shell', 'settings', 'put', 'system', 'font_scale', '1.0');
    adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable');
    const errs = crashed();
    log('crash/error lines:', errs.length ? errs.join('\n') : 'none');
  },
};

(async () => {
  const name = process.argv[2] || 'full';
  await scenarios[name]();
})().catch(async (e) => {
  console.error('DEVICE E2E FAILED', e.message);
  try {
    await shot('failure');
    console.error(crashed().join('\n'));
  } catch {}
  process.exit(1);
});
