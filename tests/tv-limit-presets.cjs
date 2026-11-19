// 限紅版本：預設三組、切換、命名、新增、刪除、儲存、取消還原、重新整理後保留。
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const url = pathToFileURL(path.join(__dirname, '../tv.html')).href;
    await page.goto(url); await page.evaluate(() => document.fonts.ready);
    const display = k => page.locator(`.tv-limit .limit-input[data-k="${k}"]`).inputValue();
    const editor = k => page.locator(`#tvProposalLimitSettings input[data-limit-key="${k}"]`);
    const options = () => page.locator('#tvLimitPreset option').allTextContents();
    const pick = async name => {
      await page.locator('.tv-limit-presets .tv-select-button').click();
      await page.locator('.tv-limit-presets .tv-select-menu button', {hasText: name}).click();
    };
    const open = async () => { await page.click('#tvSettingsButton'); await page.waitForTimeout(250); };

    await open();
    assert.deepEqual(await options(), ['版本一', '版本二', '版本三']);
    assert.equal(await page.locator('.tv-limit-presets .tv-select-button').isVisible(), true, '下拉選單已換成面板樣式');
    const head = await page.locator('#tvProposalLimitSettings > .tv-settings-subhead').boundingBox();
    const bar = await page.locator('.tv-limit-presets').boundingBox();
    assert.ok(Math.abs((head.y + head.height / 2) - (bar.y + bar.height / 2)) < 12, '版本列和「限紅」標題同一行');

    // 版本二改值、改名，按儲存
    await pick('版本一');
    const baseBp = await display('bpMax');
    await pick('版本二');
    await editor('bpMax').fill('800000'); await editor('bpMax').blur();
    assert.equal(await display('bpMax'), '800,000', '畫面即時顯示');
    await page.fill('#tvLimitPresetName', '小桌'); await page.locator('#tvLimitPresetName').blur();
    assert.deepEqual(await options(), ['版本一', '小桌', '版本三']);
    await page.click('#tvLimitPresetSave');
    assert.equal(await page.locator('#tvLimitPresetSave').textContent(), '已儲存');

    // 切回版本一，值不同
    await pick('版本一');
    assert.equal(await display('bpMax'), baseBp);
    assert.equal(await editor('bpMax').inputValue(), baseBp);

    // 新增：複製目前版本、自動命名、可改名
    await page.click('#tvLimitPresetAdd');
    assert.deepEqual(await options(), ['版本一', '小桌', '版本三', '版本4']);
    await page.fill('#tvLimitPresetName', '貴賓'); await page.locator('#tvLimitPresetName').blur();
    await editor('tMax').fill('50000'); await editor('tMax').blur();

    // 刪除要按兩次
    await pick('版本三');
    await page.click('#tvLimitPresetDelete');
    assert.equal(await page.locator('#tvLimitPresetDelete').textContent(), '確定刪除');
    assert.equal((await options()).length, 4);
    await page.click('#tvLimitPresetDelete');
    assert.deepEqual(await options(), ['版本一', '小桌', '貴賓']);

    // 用底部儲存關閉
    await pick('貴賓');
    await page.locator('#tvSettingsForm button[type=submit]').click();
    assert.equal(await page.locator('#tvSettings').evaluate(d => d.open), false);
    assert.equal(await display('tMax'), '50,000');

    // 取消要還原：改名、切版本後取消
    await open();
    await pick('小桌');
    await page.fill('#tvLimitPresetName', '亂改'); await page.locator('#tvLimitPresetName').blur();
    await page.click('#tvSettingsCancel');
    assert.equal(await display('tMax'), '50,000', '取消後畫面回到貴賓');
    await open();
    assert.deepEqual(await options(), ['版本一', '小桌', '貴賓']);
    assert.equal(await page.locator('#tvLimitPresetName').inputValue(), '貴賓');
    await page.click('#tvSettingsCancel');

    // 重新整理後保留
    await page.reload(); await page.evaluate(() => document.fonts.ready);
    assert.equal(await display('tMax'), '50,000');
    assert.equal(await display('bpMax'), baseBp);
    await open();
    assert.deepEqual(await options(), ['版本一', '小桌', '貴賓']);
    await pick('小桌');
    assert.equal(await display('bpMax'), '800,000');

    // 只剩一個時不能刪
    await pick('版本一'); await page.click('#tvLimitPresetDelete'); await page.click('#tvLimitPresetDelete');
    await page.click('#tvLimitPresetDelete'); await page.click('#tvLimitPresetDelete');
    assert.deepEqual(await options(), ['貴賓']);
    assert.equal(await page.locator('#tvLimitPresetDelete').isDisabled(), true);
    await page.locator('#tvSettings').screenshot({path: process.env.SHOT || path.join(require('os').tmpdir(), 'tv-limit-presets.png')});

    assert.deepEqual(errors, []);
    console.log('tv-limit-presets: all passed');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exit(1); });
