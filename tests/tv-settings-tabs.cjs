// 設定對話框只顯示三個分頁：基本設定、按鍵設定、儲存設定。
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    const page = await (await browser.newContext({viewport: {width: 1920, height: 1080}})).newPage();
    page.setDefaultTimeout(7000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname, '../tv.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await page.click('#tvSettingsButton'); await page.waitForTimeout(250);
    const visible = () => page.$$eval('#tvSettings [data-settings-tab]', bs => bs.filter(b => b.offsetParent).map(b => b.id));
    const selected = () => page.$eval('#tvSettings [data-settings-tab][aria-selected="true"]', b => b.id);
    assert.deepEqual(await visible(), ['tvTabBasic', 'tvTabKeys', 'tvTabSave']);
    for (const id of ['tvTabScreen', 'tvTabRoad', 'tvTabStatsFont', 'tvTabStats', 'tvTabSymbols'])
      assert.equal(await page.locator('#' + id).isVisible(), false, id + ' 應隱藏');
    assert.equal(await selected(), 'tvTabBasic');
    assert.equal(await page.locator('#tvColorsReset').isVisible(), false);
    await page.click('#tvTabKeys'); assert.equal(await selected(), 'tvTabKeys');
    await page.click('#tvTabSave'); assert.equal(await selected(), 'tvTabSave');
    assert.equal(await page.locator('#tvSavePanel').isVisible(), true);
    assert.equal(await page.locator('#tvColorsReset').isVisible(), false);
    await page.click('#tvTabBasic');
    await page.focus('#tvTabBasic');
    const seq = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); seq.push(await selected()); }
    assert.deepEqual(seq, ['tvTabKeys', 'tvTabSave', 'tvTabBasic', 'tvTabKeys']);
    await page.keyboard.press('ArrowLeft'); assert.equal(await selected(), 'tvTabBasic');
    await page.keyboard.press('ArrowLeft'); assert.equal(await selected(), 'tvTabSave');
    assert.deepEqual(await visible(), ['tvTabBasic', 'tvTabKeys', 'tvTabSave']);
    // 重新開啟仍停在基本設定
    await page.click('#tvSettingsCancel'); await page.waitForTimeout(150);
    await page.click('#tvSettingsButton'); await page.waitForTimeout(250);
    assert.equal(await selected(), 'tvTabBasic');
    assert.deepEqual(errors, []);
    console.log('tv-settings-tabs ok');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
