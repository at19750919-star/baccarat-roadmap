const assert = require('node:assert/strict');
const path = require('node:path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }

const pageUrl = 'file:///' + path.join(__dirname, '..', 'tv.html').replaceAll('\\', '/');

async function verify(page, width, height) {
  await page.evaluate(({ width, height }) => {
    const panel = document.querySelector('#tvEditPanel');
    Object.assign(panel.style, { left: '8px', top: '8px', width: width + 'px', height: height + 'px', maxHeight: 'none' });
  }, { width, height });
  const geometry = await page.evaluate(() => {
    const content = document.querySelector('.tv-edit-content');
    const controls = document.querySelector('#tvEditControls').getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.tv-edit-actions button')].map(el => el.getBoundingClientRect());
    const status = document.querySelector('#tvEditStatus').getBoundingClientRect();
    const cells = [...document.querySelectorAll('#tvEditControls .tv-slider-bar')].filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect());
    const commands = [...document.querySelectorAll('.tv-edit-history button,.tv-edit-actions button,.tv-edit-font-button,.csc-textbtn,.csc-iconbtn')]
      .filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect());
    const history = [...document.querySelectorAll('.tv-edit-history button')].map(el => el.getBoundingClientRect());
    const actionPair = [...document.querySelectorAll('.tv-edit-actions button')].slice(0, 2).map(el => el.getBoundingClientRect());
    const mode = document.querySelector('#tvEditBgSolid').getBoundingClientRect();
    return {
      controlsBottom: controls.bottom,
      firstButtonTop: Math.min(...buttons.map(rect => rect.top)),
      lastButtonBottom: Math.max(...buttons.map(rect => rect.bottom)),
      statusTop: status.top,
      contentScrollHeight: content.scrollHeight,
      contentClientHeight: content.clientHeight,
      cells: cells.map(rect => ({ width: rect.width, height: rect.height })),
      commands: commands.map(rect => ({ width: rect.width, height: rect.height })),
      historyPair: history.slice(0, 2).map(rect => ({ x: rect.x, y: rect.y })),
      actionPair: actionPair.map(rect => ({ x: rect.x, y: rect.y })),
      modeWidth: mode.width,
      columns: getComputedStyle(content).gridTemplateColumns.split(' ').length,
    };
  });
  assert.ok(geometry.firstButtonTop >= geometry.controlsBottom, `buttons overlap controls at ${width}x${height}`);
  assert.ok(geometry.statusTop >= geometry.lastButtonBottom, `status overlaps buttons at ${width}x${height}`);
  assert.ok(geometry.cells.length > 0);
  assert.ok(geometry.cells.every(cell => cell.width === 175 && cell.height === 25));
  assert.ok(geometry.commands.length > 0);
  assert.ok(geometry.commands.every(button => button.width === 87.5 && button.height === 25));
  assert.equal(geometry.modeWidth, 175);
  for (const pair of [geometry.historyPair, geometry.actionPair]) {
    assert.equal(pair[0].y, pair[1].y, `half-width commands do not share a row at ${width}x${height}`);
    assert.equal(pair[1].x - pair[0].x, 87.5);
  }
  await page.locator('.tv-edit-content').evaluate(el => { el.scrollTop = el.scrollHeight; });
  assert.ok(await page.locator('#tvEditStatus').evaluate(el => {
    const content = el.closest('.tv-edit-content');
    const a = el.getBoundingClientRect(), b = content.getBoundingClientRect();
    return a.top >= b.top && a.bottom <= b.bottom;
  }), `status cannot be scrolled into view at ${width}x${height}`);
  return geometry.columns;
}

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 2048, height: 908 } });
    const page = await context.newPage();
    await page.goto(pageUrl);
    await page.locator('.tv-edit-toggle').click();
    await page.locator('.tv-board-title-en').click();
    const results = [];
    for (const width of [300, 430, 620]) {
      for (const height of [220, 400, 700]) results.push(await verify(page, width, height));
    }
    const popupReady = page.waitForEvent('popup');
    await page.locator('#tvEditPopout').click();
    const popup = await popupReady;
    await popup.waitForLoadState();
    for (const height of [220, 400, 700]) results.push(await verify(popup, 620, height));
    await popup.close();
    await page.locator('.tv-stats .stats-list > li').first().click();
    const splitButtons = await page.locator('.cs-tools .cs-btn').evaluateAll(buttons =>
      buttons.filter(button => button.getClientRects().length).map(button => ({
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
      })));
    assert.ok(splitButtons.length > 0);
    assert.ok(splitButtons.every(button => button.width === 87.5 && button.height === 25));
    console.log('tv-edit panel overlap ok; columns:', [...new Set(results)].sort().join(','));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
