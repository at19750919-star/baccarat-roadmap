// Desktop app: 000 quits (Esc no longer does); table number and shoe number are configurable.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { _electron } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jiujiu-zero-'));
const launch = () => _electron.launch({ executablePath: require('electron'), args: [__dirname], env: { ...process.env, ROADMAP_TEST_PROFILE: profile }, timeout: 45000 });
const ready = async app => { const p = await app.firstWindow(); await p.waitForSelector('#tvTableNo', { state: 'attached', timeout: 30000 }); await p.waitForTimeout(500); return p; };
const header = page => page.evaluate(() => {
  const stats = document.querySelector('.tv-app .tv-stats');
  const heads = [...stats.querySelectorAll(':scope > .tv-stat-head')].filter(h => getComputedStyle(h).display !== 'none');
  return {
    cols: getComputedStyle(stats).gridTemplateColumns.split(' ').length,
    cells: heads.map(h => h.textContent.replace(/\s+/g, '')),
    overflow: heads.some(h => h.scrollWidth > h.clientWidth + 1)
  };
});
const press0 = async (page, n, gap = 120) => { for (let i = 0; i < n; i++) { await page.keyboard.press('0'); if (i < n - 1) await page.waitForTimeout(gap); } };
(async () => {
  let app = await launch(), page = await ready(app), closed = false;
  app.on('close', () => closed = true);
  let h = await header(page);
  assert.deepEqual(h.cells, ['桌號001', '局數0']); assert.equal(h.cols, 2);
  console.log('PASS default header', h.cells.join(' | '));

  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  assert.equal(closed, false, 'Esc must not quit any more');
  await press0(page, 2); await page.waitForTimeout(1700); await press0(page, 1); await page.waitForTimeout(800);
  assert.equal(closed, false, '0,0 then pause then 0 must not quit');
  console.log('PASS Esc and slow 0s do not quit');

  await page.click('#tvSettingsButton'); await page.waitForTimeout(400);
  await page.fill('#tvTableNo', 'A08');
  await page.check('#tvShoeEnabled');
  await page.fill('#tvShoeNo', '12');
  await press0(page, 3); await page.waitForTimeout(800);
  assert.equal(closed, false, '000 typed in an input must not quit');
  await page.fill('#tvShoeNo', '12');
  await page.locator('#tvShoeNo').evaluate(el => el.blur());
  await press0(page, 3); await page.waitForTimeout(800);
  assert.equal(closed, false, '000 with settings open must not quit');
  await page.click('#tvSettingsForm button[type="submit"]'); await page.waitForTimeout(400);
  h = await header(page);
  assert.deepEqual(h.cells, ['桌號A08', '靴號12', '局數0']); assert.equal(h.cols, 3); assert.equal(h.overflow, false);
  console.log('PASS saved header', h.cells.join(' | '), 'cols', h.cols, 'overflow', h.overflow);
  await page.screenshot({ path: path.join(__dirname, 'test-output', 'stats-shoe-on.png'), clip: await page.locator('.tv-app .tv-stats').boundingBox() });
  await app.close();

  app = await launch(); page = await ready(app); closed = false; app.on('close', () => closed = true);
  h = await header(page);
  assert.deepEqual(h.cells, ['桌號A08', '靴號12', '局數0']);
  console.log('PASS persisted after restart');
  await page.click('#tvSettingsButton');
  await page.uncheck('#tvShoeEnabled');
  assert.equal(await page.isDisabled('#tvShoeNo'), true);
  await page.click('#tvSettingsForm button[type="submit"]'); await page.waitForTimeout(400);
  h = await header(page);
  assert.deepEqual(h.cells, ['桌號A08', '局數0']); assert.equal(h.cols, 2);
  console.log('PASS shoe off hides cell', h.cells.join(' | '));

  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await press0(page, 3);
  await Promise.race([app.waitForEvent('close').catch(() => {}), new Promise((_, r) => setTimeout(() => r(Error('app did not quit on 000')), 8000))]);
  console.log('PASS 000 closed the app');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
