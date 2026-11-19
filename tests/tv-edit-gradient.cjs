const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(8000);
    await page.route('https://**', route => route.fulfill({ body: '' }));
    const url = pathToFileURL(path.join(__dirname, '../tv.html')).href;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    const board = page.locator('.tv-table-board').first();
    await page.click('#tvEditToggle');
    await board.dispatchEvent('click');
    assert.match(await page.locator('#tvEditBackground').inputValue(), /^#[\dA-F]{6}/);
    const styleColors = await page.locator('#tvEditControls [data-csc-type="color"] .csc-color-input').evaluateAll(els => els.map(el => el.value));
    assert.deepEqual(styleColors.length, 2, '字色與框線顏色：' + JSON.stringify(styleColors));
    assert.ok(styleColors.every(value => /^#[\dA-F]{6}/.test(value)), JSON.stringify(styleColors));
    assert.match(await page.locator('#tvEditSolidColor').inputValue(), /^#[\dA-F]{6}/);
    await page.click('#tvEditBgGradient');
    await page.fill('#tvEditGradientStart', '#123456');
    await page.fill('#tvEditGradientEnd', '#ABCDEF');
    await page.click('[data-bg-angle="90"]');
    const background = () => board.evaluate(el => el.style.background);
    assert.match(await background(), /90deg/);
    assert.match(await background(), /rgb\(18, 52, 86\)/);
    assert.match(await background(), /rgb\(171, 205, 239\)/);
    const beforePick = await background();
    await page.locator('#tvEditGradientStart').click();
    await page.locator('.cp-tab-btn[data-tab="swatches"]').click();
    await page.locator('.cp-swatches-grid [data-color="#f44336"]').click();
    await page.waitForFunction(() => document.querySelector('.tv-table-board').style.background.includes('244, 67, 54'));
    assert.equal(await page.locator('#tvEditGradientStart').inputValue(), '#123456', 'Preview does not commit');
    await page.keyboard.press('Escape');
    await page.waitForFunction(value => document.querySelector('.tv-table-board').style.background === value, beforePick);
    await page.locator('#tvEditGradientEnd').click();
    await page.locator('.cp-swatches-grid [data-color="#f44336"]').click();
    await page.waitForFunction(() => document.querySelector('.tv-table-board').style.background.includes('244, 67, 54'));
    await page.locator('.cp-btn-apply').click();
    assert.equal(await page.locator('#tvEditGradientEnd').inputValue(), '#F44336');
    await page.fill('#tvEditGradientEnd', '#ABCDEF');
    await page.click('#tvEditSave');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.tv-table-board')?.style.background.includes('90deg'));
    assert.match(await background(), /90deg/);
    await page.click('#tvEditToggle');
    await board.dispatchEvent('click');
    assert.equal(await page.locator('#tvEditBgGradient').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#tvEditGradientStart').inputValue(), '#123456');
    assert.equal(await page.locator('#tvEditGradientEnd').inputValue(), '#ABCDEF');
    assert.match(await page.locator('#tvEditBackground').inputValue(), /#123456 0%, #ABCDEF 100%/);
    await page.locator('#tvEditGradientEnd').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#tvEditGradientEnd').isVisible(), true);
    await page.click('[data-bg-angle="270"]');
    assert.match(await background(), /270deg/, 'Existing saved gradient remains editable');
    await page.click('#tvEditBgSolid');
    assert.equal(await board.evaluate(el => getComputedStyle(el).backgroundImage), 'none');
    page.once('dialog', dialog => dialog.accept());
    await page.click('#tvEditCancel');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => document.querySelector('.tv-table-board')?.style.background.includes('90deg'));
    assert.match(await background(), /90deg/);
    await page.click('#tvEditToggle');
    await board.dispatchEvent('click');
    await page.click('#tvEditReset');
    assert.equal(await board.evaluate(el => el.style.background), '');
    console.log('PASS: HEX controls, gradient preview, save/reload, cancel and selected reset');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

