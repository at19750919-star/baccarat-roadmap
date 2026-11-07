const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  try {
    const page = await browser.newPage({viewport: {width: 1580, height: 884}});
    page.setDefaultTimeout(7000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname, '../tv.html')).href);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { state.rounds = []; for (const side of ['B', 'P', 'B']) addRound(side, {}); });
    const road = await page.evaluate(() => JSON.stringify(state.rounds));
    await page.click('#tvSettingsButton');
    const checkFit = async () => {
      await page.waitForTimeout(70);
      const fit = await page.locator('#tvSettings').evaluate(e => {
        const r = e.getBoundingClientRect(), f = e.querySelector('footer').getBoundingClientRect();
        const clipped = [...e.querySelectorAll('input:not([type=range]):not([type=checkbox])')]
          .filter(i => i.getClientRects().length && i.value && i.scrollWidth > i.clientWidth + 1)
          .map(i => ({id: i.id || i.dataset.limitKey, value: i.value, width: i.clientWidth, scroll: i.scrollWidth}));
        return {width: r.width, inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          footer: f.bottom <= r.bottom && f.top >= r.top, horizontal: e.scrollWidth <= e.clientWidth + 1, clipped};
      });
      assert.ok(fit.inside && fit.footer && fit.horizontal, JSON.stringify(fit));
      assert.deepEqual(fit.clipped, [], 'Input text must fit');
      return fit;
    };
    for (const size of [{width:1580,height:884},{width:1280,height:720}]) {
      await page.setViewportSize(size);
      for (const tab of ['Basic','Keys','Screen','Road','StatsFont','Stats','Symbols']) {
        await page.click('#tvTab' + tab); await checkFit();
      }
    }
    await page.setViewportSize({width:1580,height:884}); await page.click('#tvTabBasic');
    assert.equal(await page.locator('#tvSettingsForm > .tv-live-hint').count(), 0);
    assert.equal(await page.locator('#tvBasicPanel > .tv-settings-help').count(), 0);
    assert.equal(await page.locator('#tvProposalLimitSettings > .tv-live-hint').count(), 0);
    const limit = page.locator('[data-limit-key="bpMax"]');
    await limit.fill('2345678'); await limit.blur();
    assert.equal(await page.locator('.tv-limit [data-k=bpMax]').inputValue(), '2,345,678');
    await page.fill('#tvDragonThreshold', '8');
    assert.equal(await page.evaluate(() => getDragonThreshold()), 8);
    await page.click('#tvSettingsCancel');
    assert.equal(await page.evaluate(() => getDragonThreshold()), 6);
    assert.equal(await page.locator('.tv-limit [data-k=bpMax]').inputValue(), '1,500,000');
    await page.click('#tvSettingsButton'); await limit.fill('2345678');
    await page.click('#tvSettings button[type=submit]'); await page.reload();
    assert.equal(await page.locator('.tv-limit [data-k=bpMax]').inputValue(), '2,345,678');
    await page.click('#tvSettingsButton'); await page.click('#tvTabRoad');
    await page.click('#tvColorTarget'); await page.locator('[data-color-option=red]').click();
    await page.fill('#tvColorHex', '#ff8800');
    assert.equal(await page.locator('#bigRoad .big-circle.B').first().evaluate(e => getComputedStyle(e).borderTopColor), 'rgb(255, 136, 0)');
    await page.click('#tvSettingsCancel');
    assert.equal(await page.locator('#bigRoad .big-circle.B').first().evaluate(e => getComputedStyle(e).borderTopColor), 'rgb(214, 33, 33)');
    await page.click('#tvSettingsButton'); await page.click('#tvTabSymbols');
    assert.equal(await page.locator('#tvSymbolTarget').isVisible(), false, 'Native select stays hidden');
    const picker = page.locator('#tvSymbolTarget + .tv-select-picker');
    await picker.locator('.tv-select-button').click();
    await picker.getByRole('option', {name:'莊閒對圓點'}).click();
    assert.equal(await page.locator('#tvSymbolTarget').inputValue(), 'banker');
    await picker.locator('.tv-select-button').focus(); await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Home'); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#tvSymbolTarget').inputValue(), 'number');
    await page.click('#tvTabKeys');
    const checkbox = page.locator('#tvAutoCommit');
    const checked = await checkbox.isChecked(); await checkbox.click(); assert.equal(await checkbox.isChecked(), !checked);
    await page.click('#tvSettingsCancel');
    assert.equal(await page.evaluate(() => JSON.stringify(state.rounds)), road, 'Settings must preserve the road');
    await page.click('#tvSettingsButton'); await checkFit();
    await page.locator('#tvSettings').screenshot({path:path.join(__dirname,'output/tv-settings-basic-red.png')});
    await page.click('#tvTabRoad'); await checkFit();
    await page.locator('#tvSettings').screenshot({path:path.join(__dirname,'output/tv-settings-color-red.png')});
    assert.deepEqual(errors, []);
    console.log('PASS: all tabs fit at two resolutions; full input text; three hints removed; limit preview/save/cancel; color preview/cancel; custom select mouse/keyboard; toggle; road preserved.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
