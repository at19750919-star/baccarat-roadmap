const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }

const root = path.resolve(__dirname, '..');
const origin = 'https://at19750919-star.github.io/baccarat-roadmap/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const password = fs.readFileSync(path.join(root, 'owner-gate.js'), 'utf8').match(/OWNER_PASSWORD = '([^']+)'/)[1];

function serve(route) {
  const url = route.request().url();
  if (!url.startsWith(origin)) return route.fulfill({ body: '' });
  const relative = decodeURIComponent(new URL(url).pathname.slice('/baccarat-roadmap/'.length));
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' });
  return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.route('**/*', serve);
    const shotDir = path.join(process.env.TEMP, 'jiujiu-license-ui');
    fs.mkdirSync(shotDir, { recursive: true });
    await page.goto(origin + 'tv.html', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: path.join(shotDir, 'gate.png') });
    assert.equal(await page.locator('#ownerGate').count(), 1);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).visibility), 'hidden');
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.state ? state.rounds.length : 0), 0, '密碼畫面擋住按鍵');
    await page.locator('#ownerGatePassword').fill('不對的密碼');
    await page.locator('#ownerGateSubmit').click();
    assert.equal(await page.locator('#ownerGateError').textContent(), '密碼不對。');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('owner-locked')), true);
    await page.locator('#ownerGatePassword').fill(password);
    await page.locator('#ownerGateSubmit').click();
    await page.waitForFunction(() => !document.documentElement.classList.contains('owner-locked'));
    assert.equal(await page.locator('#ownerGate').count(), 0);
    await page.evaluate(() => { speech.enabled = false; });
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => state.rounds.length === 1);
    console.log('PASS owner gate: 公開網址要密碼，錯密碼留在畫面，對密碼才進路單');
    await context.close();

    const local = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const filePage = await local.newPage();
    await filePage.goto(pathToFileURL(path.join(root, 'tv.html')).href, { waitUntil: 'domcontentloaded' });
    await filePage.screenshot({ path: path.join(process.env.TEMP, 'jiujiu-license-ui', 'tv-file.png') });
    assert.equal(await filePage.locator('#ownerGate').count(), 0);
    assert.equal(await filePage.evaluate(() => document.documentElement.classList.contains('owner-locked')), false);
    console.log('PASS owner gate: 本機檔案不問密碼');
    await local.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
