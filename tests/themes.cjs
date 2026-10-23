const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '' }));
    await page.route('https://fonts.gstatic.com/**', r => r.abort());
    await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: '' }));
    const url = pathToFileURL(path.join(__dirname, '../index.html')).href;
    await page.goto(url);
    await page.evaluate(() => { localStorage.clear(); });
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'classic');
    const sample = ['B','B','P','P','B','P','B','B','T','P','B','P','P','B','P','B','B','P','B','P'];
    await page.evaluate(sample => { speech.enabled = false; sample.forEach(r => addRound(r)); }, sample);
    const records = await page.evaluate(() => JSON.stringify(state.rounds));
    await page.locator('.limit-input').first().fill('25000');
    const snapshot = () => page.evaluate(() => [...document.querySelectorAll('.grid-board')].map(n => ({ html: n.innerHTML, w: n.offsetWidth, h: n.offsetHeight })));
    const original = await snapshot();
    await page.selectOption('#themeSelect', 'black-gold');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'black-gold');
    assert.deepEqual(await snapshot(), original, 'Switching skins preserves every road mark and board dimension');
    assert.equal(await page.locator('.limit-input').first().inputValue(), '25000');
    assert.equal(await page.evaluate(() => JSON.stringify(state.rounds)), records);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(7, 9, 11)');
    await page.locator('#themeSelect').focus();
    await page.keyboard.press('1');
    assert.equal(await page.evaluate(() => JSON.stringify(state.rounds)), records, 'Select keyboard does not enter rounds');
    await page.reload();
    assert.equal(await page.locator('#themeSelect').inputValue(), 'black-gold');
    assert.equal(await page.evaluate(() => JSON.stringify(state.rounds)), records);
    await page.evaluate(() => { speech.enabled = false; });
    await page.locator('[data-action="P"]').first().click();
    assert.equal(await page.locator('#totalCount').textContent(), String(sample.length + 1));
    await page.locator('#undoBtn').click();
    assert.equal(await page.evaluate(() => JSON.stringify(state.rounds)), records);
    // Exercise the real export layout using a canvas stub, without any cloud upload.
    const exported = await page.evaluate(async () => {
      let captured;
      window.html2canvas = async (view, options) => {
        captured = { background: options.backgroundColor, beads: view.querySelectorAll('.bead').length, theme: document.documentElement.dataset.theme };
        const canvas = document.createElement('canvas'); canvas.width = 1920; canvas.height = 1080; return canvas;
      };
      await RoadBackup.png({ rounds: state.rounds });
      return captured;
    });
    assert.deepEqual(exported, { background: 'rgb(7, 9, 11)', beads: sample.length, theme: 'black-gold' });
    for (const width of [1920, 1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1080 });
      await page.waitForFunction(() => Math.abs(parseFloat(document.documentElement.style.getPropertyValue('--app-scale')) - Math.min(innerWidth / 1920, innerHeight / 1080)) < 0.0001);
      const box = await page.locator('.app').boundingBox();
      assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1, 'Canvas fits viewport');
      const control = await page.locator('#themeSelect').boundingBox();
      assert(control.width > 0 && control.height > 0);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(__dirname, '../.preview/black-gold.png') });
    await page.selectOption('#themeSelect', 'classic');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(122, 11, 11)');
    assert.deepEqual(await snapshot(), original);
    await page.reload();
    assert.equal(await page.locator('#themeSelect').inputValue(), 'classic');
    await page.evaluate(() => localStorage.setItem('baccarat_road_theme_v1', 'invalid'));
    await page.reload();
    assert.equal(await page.locator('#themeSelect').inputValue(), 'classic');
    await page.addInitScript(() => { Storage.prototype.getItem = Storage.prototype.setItem = () => { throw Error('Storage unavailable'); }; });
    await page.reload();
    await page.selectOption('#themeSelect', 'black-gold');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'black-gold');
    assert.deepEqual(errors, []);
    console.log('PASS theme switching, record/limit preservation, reload persistence, keyboard isolation, entry/undo, export background, viewport fit, invalid/unavailable storage');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
