const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1580, height: 884 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**', route => route.fulfill({ body: '' }));
    await page.goto(process.env.ROADMAP_TEST_URL || pathToFileURL(path.join(__dirname, '..', 'tv.html')).href);
    const actual = await page.evaluate(() => {
      speech.enabled = false;
      const marks = 'BBRRRRBRRRRRRRRB'.split('');
      const results = [];
      for (const [id, shape] of [['bigEye', 'hollow'], ['smallRoad', 'solid'], ['cockroachRoad', 'slash']]) {
        renderDerived(id, marks, shape);
        const board = document.getElementById(id);
        const topBlue = [...board.children].filter(cell => cell.style.gridRow === '1' && cell.querySelector('.derived-dot.blue'));
        results.push({ id, blueColumns: topBlue.map(cell => Number(cell.style.gridColumn)), count: board.querySelectorAll('.derived-dot').length });
      }
      return results;
    });
    for (const result of actual) {
      assert.deepEqual(result.blueColumns, [1, 3, 5], `${result.id}: next blue must appear in the fifth column`);
      assert.equal(result.count, 16);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: browser renders the next blue at column 5; every mark retained; no JS errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
