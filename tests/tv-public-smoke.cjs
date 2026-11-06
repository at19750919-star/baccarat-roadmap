const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }

const root = path.resolve(__dirname, '..');
const origin = 'https://at19750919-star.github.io/baccarat-roadmap/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.json': 'application/json' };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const skin of ['red', 'green', 'black', 'led']) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      const page = await context.newPage();
      const errors = [], missing = [], editorRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://**', route => {
        const url = route.request().url();
        if (!url.startsWith(origin)) return route.fulfill({ body: '' });
        const relative = decodeURIComponent(new URL(url).pathname.slice('/baccarat-roadmap/'.length));
        if (/tv-edit|共用元件/.test(relative)) editorRequests.push(relative);
        const file = path.resolve(root, relative);
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          missing.push(relative);
          return route.fulfill({ status: 404, body: '' });
        }
        return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
      });
      await page.addInitScript(value => localStorage.setItem('tv_skin_v1', value), skin);
      await page.goto(origin + 'tv.html', { waitUntil: 'load' });
      assert.equal(await page.locator('#tvEditToggle, #tvEditPanel').count(), 0);
      assert.equal(await page.locator('script[src*="tv-edit"], link[href*="tv-edit"]').count(), 0);
      await page.evaluate(() => { speech.enabled = false; state.rounds = []; renderAll(); });
      await page.keyboard.press('1');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => state.rounds.length === 1);
      assert.equal(await page.evaluate(() => state.rounds[0].r), 'B');
      await page.keyboard.press('C');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => state.rounds.length === 2);
      assert.equal(await page.evaluate(() => state.rounds[1].tiger), 'small');
      await page.keyboard.type('222');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => state.rounds.length === 3);
      assert.equal(await page.evaluate(() => state.rounds[2].l7), 3);
      await page.click('#tvSettingsButton');
      assert.equal(await page.locator('[data-settings-tab]:visible').count(), 2);
      await page.click('#tvSettingsCancel');
      assert.deepEqual(errors, [], skin + ' JS errors');
      assert.deepEqual(missing, [], skin + ' missing assets');
      assert.deepEqual(editorRequests, [], skin + ' editor dependencies');
      console.log('PASS public ' + skin + ': shortcuts, settings, assets, no editor');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
