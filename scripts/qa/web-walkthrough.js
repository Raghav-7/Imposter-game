/*
 * Headless UI walkthrough of the web build (dev tool, not an app dependency).
 *   npx expo start --web --port 8081        # in another terminal
 *   npm i --no-save puppeteer-core
 *   node scripts/qa/web-walkthrough.js 393 852 medium full      # or: ... screens
 * Env: CHROME_PATH, BASE, PRESET (settings JSON), NAMES (comma list), MODE, VOTE=civilian.
 * Screenshots go to qa-shots/<label>/; console errors and overflowing elements are reported.
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const [, , W = '393', H = '852', LABEL = 'medium', SCENARIO = 'full'] = process.argv;
const OUT = path.join(__dirname, '..', '..', 'qa-shots', LABEL);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--force-prefers-reduced-motion=0'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: +W, height: +H, deviceScaleFactor: +(process.env.DPR || 1), isMobile: true, hasTouch: false });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  if (process.env.SCHEME) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: process.env.SCHEME }]);

  let n = 0;
  const shot = async (name, full = false) => {
    await sleep(350);
    const file = path.join(OUT, `${String(++n).padStart(2, '0')}-${name}.png`);
    await page.screenshot({ path: file, fullPage: full });
  };
  const tap = async (id, wait = 650) => {
    const sel = `[data-testid="${id}"]`;
    await page.waitForSelector(sel, { timeout: 8000 });
    await page.click(sel);
    await sleep(wait);
  };
  const exists = async (id) => !!(await page.$(`[data-testid="${id}"]`));
  const text = async (id) => page.$eval(`[data-testid="${id}"]`, (e) => e.textContent).catch(() => null);
  const overflow = async (name) => {
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('div,span,input')]
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
        })
        .slice(0, 5)
        .map((e) => `${e.tagName}:${(e.textContent || '').slice(0, 30)}:${Math.round(e.getBoundingClientRect().right)}`),
    );
    if (bad.length) errors.push(`[overflow ${name}] ${bad.join(' | ')}`);
  };

  // Fresh install
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  if (process.env.PRESET) await page.evaluate((s) => localStorage.setItem('ip.settings.v1', s), process.env.PRESET);
  await page.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(1500);

  if (await exists('onboarding-next')) {
    await shot('onboarding');
    await overflow('onboarding');
    await tap('onboarding-skip', 1200);
  }
  await shot('home');
  await overflow('home');

  if (SCENARIO === 'screens') {
    for (const [id, name] of [
      ['home-rules', 'rules'],
      ['home-categories', 'categories'],
      ['home-stats', 'stats'],
      ['home-settings', 'settings'],
    ]) {
      await tap(id, 1000);
      await shot(name);
      await overflow(name);
      await page.goBack();
      await sleep(900);
    }
  }

  await tap('home-play', 1000);
  for (const name of (process.env.NAMES || 'Raghav,Arun,Priya,Karthik,Neha').split(',')) {
    await page.type('[data-testid="player-add-input"]', name);
    await page.keyboard.press('Enter');
    await sleep(250);
  }
  await shot('players');
  await overflow('players');
  await tap('players-next', 1000);
  if (process.env.MODE) await tap(`mode-${process.env.MODE}`, 400);
  await shot('config');
  await overflow('config');
  await tap('config-advanced', 500);
  await shot('config-full', true);
  await tap('config-category', 900);
  await shot('category', true);
  await overflow('category');
  await tap('category-food', 900);
  await tap('config-start', 900);
  await shot('deal');

  // Reveal everyone, remembering roles.
  const roles = {};
  await sleep(1600);
  for (let i = 0; i < 25; i++) {
    if (!(await exists('reveal-gate'))) break;
    const name = await page.$eval('[data-testid="reveal-gate"] [role="heading"]', (e) => e.textContent).catch(() => `p${i}`);
    if (i === 0) await shot('reveal-gate');
    await sleep(800); // arm delay
    await tap('reveal-gate-ready', 900);
    const title = await text('role-title');
    roles[name] = title;
    if (i < 2 || /IMPOSTER|UNDERCOVER/.test(title || '')) await shot(`card-${i}`);
    await overflow('card');
    await sleep(500);
    await tap('reveal-hide', 700);
  }
  console.log('roles', JSON.stringify(roles));
  await shot('reveal-complete');
  await tap('clues-start', 700);
  await shot('clue');
  await overflow('clue');
  for (let i = 0; i < 25 && (await exists('clue-next')); i++) await tap('clue-next', 550);
  await shot('clue-done');
  await tap('clue-discuss', 900);
  await shot('discussion');
  await overflow('discussion');
  await tap('discussion-vote', 800);

  const imposter = Object.keys(roles).find((k) => /IMPOSTER|UNDERCOVER/.test(roles[k] || ''));
  const civilian = Object.keys(roles).find((k) => !/IMPOSTER|UNDERCOVER/.test(roles[k] || ''));
  const target = process.env.VOTE === 'civilian' ? civilian : imposter;
  for (let v = 0; v < 25; v++) {
    if (await exists('vote-reveal')) break;
    if (!(await exists('vote-gate'))) {
      await sleep(600);
      continue;
    }
    if (v === 0) await shot('vote-gate');
    await sleep(800);
    await tap('vote-gate-ready', 700);
    const voter = await page.$eval('[role="heading"]', (e) => e.textContent).catch(() => '');
    let pick = `vote-target-${target}`;
    if (!(await exists(pick))) pick = (await page.$$eval('[data-testid^="vote-target-"]', (els) => els.map((e) => e.dataset.testid)))[0];
    await tap(pick, 300);
    if (v === 0) await shot('ballot');
    await overflow('ballot');
    await tap('vote-lock', 1400);
    void voter;
  }
  await shot('votes-in');
  await tap('vote-reveal', 2300);
  await shot('vote-result');
  await overflow('vote-result');
  if (await exists('vote-revote')) {
    console.log('tie → revote path');
  } else {
    await tap('vote-reveal-role', 1700);
    await shot('elimination');
    await overflow('elimination');
    if (await exists('elim-guess')) {
      await tap('elim-guess', 900);
      await sleep(800);
      await tap('guess-gate-ready', 700);
      await shot('guess');
      await overflow('guess');
      const choices = await page.$$eval('[data-testid^="guess-choice-"]', (els) => els.map((e) => e.dataset.testid));
      if (choices.length) await tap(choices[0], 300);
      else await page.type('[data-testid="guess-input"]', 'Banana');
      await tap('guess-submit', 1200);
      await shot('guess-result');
      await tap('guess-results', 1200);
    } else if (await exists('elim-results')) {
      await tap('elim-results', 1200);
    }
    await shot('round-result', true);
    await overflow('round-result');
    await tap('round-scoreboard', 900);
    await shot('scoreboard');
    await tap('score-end', 1200);
    await shot('final', true);
    await overflow('final');
    await tap('final-home', 1500);
    await tap('home-stats', 1000);
    await shot('stats-after', true);
  }

  console.log('ERRORS:\n' + (errors.length ? errors.join('\n') : 'none'));
  await browser.close();
})().catch((e) => {
  console.error('QA FAILED', e);
  process.exit(1);
});
