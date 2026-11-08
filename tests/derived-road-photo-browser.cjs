const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const expected = {
  bigEye: ['RRR...', 'B.....', 'RRRRR.', 'B.....', 'RRRRRR', 'B.....', 'RR....', 'B.....', 'RRR...', 'BBB...', 'R.....', 'B.....', 'RRR...', 'B.....', 'R.....'],
  smallRoad: ['RR....', 'B.....', 'RRRRR.', 'BB....', 'RRRRRR', 'B....R', 'RRR..R', 'BB....', 'RR....', 'BB....', 'R.....', 'BBB...'],
  cockroachRoad: ['R.....', 'B.....', 'RRRRR.', 'BB....', 'RRRRRR', 'BB...R', 'RR...R', 'BB....', 'RR....', 'B.....', 'RR....', 'B.....', 'R.....', 'B.....']
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1580, height: 884 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.argv[2] || pathToFileURL(path.join(__dirname, '..', 'tv.html')).href);
    await page.evaluate(() => {
      speech.enabled = false;
      state.rounds = [];
      for (const r of 'BPBPBBBBBBBPPPPPPPPPPBBBBPBBBPPPBPB') addRound(r);
    });
    const inspect = () => page.evaluate(expectedColumns => {
      const result = {};
      for (const [id, columns] of Object.entries(expectedColumns)) {
        const cells = [...document.getElementById(id).children];
        result[id] = columns.map((_, col) => Array.from({ length: 6 }, (_, row) => {
          const cell = cells.find(node => Number(node.style.gridColumn) === col + 1 && Number(node.style.gridRow) === row + 1);
          const dot = cell?.querySelector('.derived-dot');
          return dot ? (dot.classList.contains('blue') ? 'B' : 'R') : '.';
        }).join(''));
      }
      return result;
    }, expected);
    assert.deepEqual(await inspect(), expected, 'All derived bead positions match the physical machine photo');
    assert.equal(await page.locator('#bigRoad .big-circle').count(), 35);
    assert.deepEqual(await page.evaluate(() => state.rounds.reduce((n, r) => { n[r.r]++; return n; }, { B: 0, P: 0 })), { B: 18, P: 17 });
    await page.keyboard.press('Backspace');
    await page.waitForFunction(() => state.rounds.length === 34);
    assert.deepEqual(await page.evaluate(() => ['bigEye', 'smallRoad', 'cockroachRoad'].map(id => document.getElementById(id).querySelectorAll('.derived-dot').length)), [32, 31, 30]);
    await page.evaluate(() => addRound('B'));
    assert.deepEqual(await inspect(), expected, 'Undo and re-entry reproduce the same roads');
    assert.deepEqual(errors, []);
    console.log('PASS: actual 35-hand input matches every position in all three physical roads; undo and re-entry verified.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
