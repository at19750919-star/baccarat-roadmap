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
    const url = pathToFileURL(path.join(__dirname, '../tv.html')).href;
    await page.goto(url); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#saveBtn').isVisible(), false);
    assert.equal(await page.locator('#tvEditToggle').isVisible(), false);
    assert.equal(await page.locator('header #tvSkinToggle').count(), 0);
    const measure = () => page.evaluate(() => {
      const scale = document.querySelector('.tv-app').getBoundingClientRect().width / 1920;
      const box = q => { const e = document.querySelector(q), r = e.getBoundingClientRect(); return {x: r.x / scale, y: r.y / scale, w: r.width / scale, h: r.height / scale}; };
      return {limit: box('.tv-limit'), logo: box('.tv-brand-slot'), bead: box('#beadBoard')};
    });
    const layout = await measure();
    assert.ok(Math.abs(layout.limit.w - 1368) < 1, JSON.stringify(layout));
    assert.ok(layout.limit.x > 261.2 + 90, 'Limit table moves right into the removed controls space');
    assert.ok(layout.logo.w > 310, 'Logo area gains width');
    assert.ok(Math.abs(layout.bead.w - 1100) < 1 && Math.abs(layout.bead.h - 348.734375) < 1, 'Bead dimensions stay unchanged');
    await page.keyboard.press('KeyX');
    assert.equal(await page.locator('.app.tv-app').evaluate(e => e.classList.contains('tv-editing')), true);
    await page.locator('.tv-stats .stat-banker').click();
    await page.locator('#tvEditPanel').waitFor({state:'visible'});
    await page.locator('#tvEditText').focus(); await page.keyboard.press('KeyX');
    assert.equal(await page.locator('.app.tv-app').evaluate(e => e.classList.contains('tv-editing')), true, 'Typing X stays in edit mode');
    await page.keyboard.press('Backspace');
    await page.locator('#tvEditText').evaluate(e => e.blur());
    page.on('dialog', d => d.accept());
    await page.keyboard.press('KeyX');
    assert.equal(await page.locator('.app.tv-app').evaluate(e => e.classList.contains('tv-editing')), false);
    await page.keyboard.press('Control+KeyX');
    assert.equal(await page.locator('.app.tv-app').evaluate(e => e.classList.contains('tv-editing')), false);
    await page.keyboard.press('Digit7'); await page.keyboard.press('Digit7');
    assert.equal(await page.locator('.tv-style-options button:visible').count(), 4);
    assert.equal(await page.locator('#tvSkinToggle,#tvSkinMenu').count(), 0);
    await page.keyboard.press('KeyX');
    assert.equal(await page.locator('.app.tv-app').evaluate(e => e.classList.contains('tv-editing')), false, 'Settings blocks X');
    for (const skin of ['green', 'black', 'led', 'red']) {
      await page.locator('[data-skin-value="' + skin + '"]').click();
      assert.equal(await page.locator('.tv-style-options [aria-checked=true]').count(), 1);
      assert.equal(await page.locator('html').getAttribute('data-skin'), skin === 'red' ? null : skin);
      assert.equal(await page.evaluate(() => localStorage.getItem('tv_skin_v1')), skin);
    }
    await page.locator('[data-skin-value="red"]').focus(); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('html').getAttribute('data-skin'), 'green', 'Keyboard style selection works inside settings');
    assert.equal(await page.locator('[data-skin-value="green"]').getAttribute('aria-checked'), 'true');
    await page.keyboard.press('End');assert.equal(await page.locator('html').getAttribute('data-skin'), 'led');
    await page.keyboard.press('Home');assert.equal(await page.locator('html').getAttribute('data-skin'), null);
    await page.keyboard.press('ArrowRight');
    await page.click('#tvSettingsCancel'); await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-skin'), 'green', 'Style selection persists');
    await page.click('#tvSettingsButton');
    await page.locator('[data-skin-value="red"]').click(); await page.click('#tvSettingsCancel');
    await page.setViewportSize({width: 1920, height: 1080});
    await page.screenshot({path: path.join(__dirname, 'output/tv-header-controls.png')});
    assert.deepEqual(errors, []);
    console.log('PASS: hidden controls; 8 save covered by tv-shortcuts; X edit/typing guards; style mouse/keyboard/persistence; moved limits; unchanged beads.', JSON.stringify(layout));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

