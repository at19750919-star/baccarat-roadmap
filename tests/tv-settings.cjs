const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (_) { ({ chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**', r => r.fulfill({ body: '' }));
    await page.goto(pathToFileURL(path.join(__dirname, '../tv.html')).href);
    await page.evaluate(() => {
      localStorage.clear();
      const rounds = Array.from({ length: 140 }, (_, i) => ({ r: i % 11 === 0 ? 'T' : i % 7 < 3 ? 'B' : 'P', bp: i % 9 === 0, pp: i % 13 === 0, l6: false }));
      localStorage.setItem('baccarat_road_rounds_v1', JSON.stringify(rounds));
    });
    await page.reload();
    const records = await page.evaluate(() => JSON.stringify(state.rounds));
    const checkLayout = async columns => {
      assert.deepEqual(errors, [], 'No runtime errors');
      const actual = await page.evaluate(() => {
        const app = document.querySelector('.tv-app');
        const css = getComputedStyle(app);
        const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
        return {
          big: Number(css.getPropertyValue('--cols-big')),
          bigCell: parseFloat(css.getPropertyValue('--cell-big')),
          smallCell: parseFloat(css.getPropertyValue('--cell-derived')),
          bottom: rect(document.querySelector('.bottom-row')),
          boards: [...document.querySelectorAll('.grid-board')].map(el => {
            const c = getComputedStyle(el);
            return { id: el.id, rect: rect(el), parent: rect(el.parentElement), rows: c.gridTemplateRows.split(' ').length, columns: c.gridTemplateColumns.split(' ').length, children: el.children.length };
          }),
          header: [...document.querySelector('.title-bar').children].map(rect),
          headerCSS: [getComputedStyle(document.querySelector('.title-bar')).gridTemplateColumns, getComputedStyle(document.querySelector('.title-bar')).width, getComputedStyle(document.querySelector('.tv-identity')).minWidth],
        };
      });
      assert.equal(actual.big, columns);
      assert.ok(Math.abs(actual.bigCell - actual.smallCell * 2) < 0.001);
      const star = await page.locator('#starRoad').evaluate(el => {
        const css = getComputedStyle(el);
        return {
          cell: parseFloat(css.gridTemplateColumns),
          background: css.backgroundSize.split(',').map(value => value.trim()),
          marksFit: [...el.children].every(mark => {
            const row = Number(mark.style.gridRow);
            const col = Number(mark.style.gridColumn);
            return row >= 1 && row <= 3 && col >= 1 && col <= css.gridTemplateColumns.split(' ').length;
          }),
        };
      });
      assert.ok(Math.abs(star.cell - actual.bigCell) < 0.02, `Star cells match big-road cells: ${star.cell}, ${actual.bigCell}`);
      assert.ok(Math.abs(parseFloat(star.background[0].split(' ')[1]) - actual.bigCell) < 0.01, 'Horizontal grid lines use the full star-cell height');
      assert.ok(Math.abs(parseFloat(star.background[1]) - actual.bigCell) < 0.01, 'Vertical grid lines use the full star-cell width');
      assert.equal(star.marksFit, true);
      assert.ok(actual.bottom.bottom <= 1070.1 && actual.bottom.right <= 1910.1, JSON.stringify(actual.bottom));
      for (const board of actual.boards) {
        assert.equal(board.rows, board.id === 'starRoad' ? 3 : 6, board.id);
        assert.ok(board.rect.x >= board.parent.x - 0.1 && board.rect.right <= board.parent.right + 0.1, `${board.id} horizontal overflow: ${JSON.stringify(board)}`);
        assert.ok(board.rect.y >= board.parent.y - 0.1 && board.rect.bottom <= board.parent.bottom + 0.1, `${board.id} vertical overflow`);
        if (board.id !== 'starRoad') assert.equal(board.children, board.columns * 6, `${board.id} rendering columns match CSS`);
      }
      assert.ok(actual.header.every(r => r.x >= 10 && r.right <= 1910), JSON.stringify([actual.header, actual.headerCSS]));
      const markIntegrity = await page.evaluate(() => {
        const big = buildBigRoad(state.rounds);
        const columns = Number(getComputedStyle(document.querySelector('.tv-app')).getPropertyValue('--cols-big'));
        const start = Math.max(0, big.cols - columns);
        const bigExpected = big.grid.reduce((sum, row) => sum + Object.keys(row).filter(col => Number(col) >= start).length, 0);
        const derivedOK = [['bigEye', 1], ['smallRoad', 2], ['cockroachRoad', 3]].every(([id, offset]) => {
          const board = document.getElementById(id);
          const cols = getComputedStyle(board).gridTemplateColumns.split(' ').length;
          const laid = layoutDerivedMarks(buildDerivedRoad(big.grid, offset, big.cols, 6), 6);
          const first = Math.max(0, laid.cols - cols);
          return [...board.children].every(cell => {
            const col = Number(cell.style.gridColumn) - 1;
            const row = Number(cell.style.gridRow) - 1;
            const mark = laid.grid[row][col + first];
            return !!cell.firstElementChild === !!mark && (!mark || cell.firstElementChild.classList.contains('blue') === (mark === 'B'));
          });
        });
        return { bigOK: document.querySelectorAll('#bigRoad .big-circle').length === bigExpected, derivedOK };
      });
      assert.deepEqual(markIntegrity, { bigOK: true, derivedOK: true }, 'Resize preserves the calculated road marks');
      return actual.bottom.height;
    };
    await checkLayout(46);
    async function apply(columns, strokes = [4, 2, 3, 3]) {
      await page.click('#tvSettingsButton');
      await page.fill('#tvBigColumns', String(columns));
      for (const [id, value] of [['tvBigStroke', strokes[0]], ['tvEyeStroke', strokes[1]], ['tvCockroachStroke', strokes[2]], ['tvStarStroke', strokes[3]]]) await page.fill('#' + id, String(value));
      await page.click('#tvSettings button[type=submit]');
      await page.waitForFunction(() => !document.getElementById('tvSettings').open);
    }
    const heights = [];
    for (const columns of [38, 46, 48, 39, 45, 46]) {
      await apply(columns, [6, 4, 4.5, 5]);
      heights.push(await checkLayout(columns));
      assert.equal(await page.evaluate(() => JSON.stringify(state.rounds)), records);
    }
    assert.ok(heights[0] < heights[1] && heights[1] < heights[2], 'Bottom yields height to the upper roads');
    const strokes = await page.evaluate(() => [
      getComputedStyle(document.querySelector('#bigRoad .big-circle')).borderTopWidth,
      getComputedStyle(document.querySelector('#bigEye .shape-hollow')).borderTopWidth,
      getComputedStyle(document.querySelector('#cockroachRoad .shape-slash'), '::before').height,
      getComputedStyle(document.querySelector('#starRoad .tv-star-mark')).borderTopWidth,
    ]);
    assert.deepEqual(strokes, ['6px', '4px', '4.5px', '5px']);
    await page.reload();
    await checkLayout(46);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('baccarat_tv_settings_v1')).bigStroke), 6);
    assert.equal(await page.locator('#starRoad .tv-star-mark').first().evaluate(el => getComputedStyle(el).borderTopWidth), '5px');
    const starRows = await page.locator('#starRoad .tv-star-mark').evaluateAll(marks => [...new Set(marks.map(mark => getComputedStyle(mark).gridRowStart))].sort());
    assert.deepEqual(starRows, ['1', '2', '3'], 'Three actual grid rows');
    await page.click('#tvSettingsButton');
    for (const invalid of ['37', '49', '40.5', '']) {
      await page.fill('#tvBigColumns', invalid);
      await page.click('#tvSettings button[type=submit]');
      assert.equal(await page.locator('#tvSettings').evaluate(el => el.open), true);
    }
    await page.click('#tvSettingsCancel');
    await checkLayout(46);
    await page.click('#tvSettingsButton');
    await page.click('#tvSettingsReset');
    await page.locator('#tvSettingsReset').focus();
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => JSON.stringify(state.rounds)), records, 'Settings keyboard does not enter game results');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#tvSettings').evaluate(el => el.open), false);
    await page.click('#tvSettingsButton');
    await page.click('#tvSettingsReset');
    await page.click('#tvSettings button[type=submit]');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('baccarat_tv_settings_v1')).bigStroke), 4);
    assert.equal(await page.locator('#starRoad .tv-star-mark').first().evaluate(el => getComputedStyle(el).borderTopWidth), '3px');
    await page.evaluate(() => { speech.enabled = false; document.activeElement.blur(); });
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#totalCount').textContent(), '141');
    await page.evaluate(() => undo());
    assert.equal(await page.evaluate(() => JSON.stringify(state.rounds)), records);
    await page.selectOption('#themeSelect', 'black-gold', { force: true });
    await checkLayout(46);
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight);
      assert.equal(overflow, false, 'No page scrollbars');
    }
    await page.selectOption('#themeSelect', 'classic', { force: true });
    await page.click('#tvSettingsButton');
    await page.locator('#tvSettings').screenshot({ path: path.join(__dirname, 'output/tv-settings.png') });
    await page.keyboard.press('Escape');
    await apply(38);
    await page.locator('#starRoad').screenshot({ path: path.join(__dirname, 'output/tv-star-3-rows.png') });
    for (const [saved, expected] of [
      [JSON.stringify({ columns: 1 }), 38],
      [JSON.stringify({ columns: 1000 }), 48],
      ['invalid json', 46],
    ]) {
      await page.evaluate(saved => localStorage.setItem('baccarat_tv_settings_v1', saved), saved);
      await page.reload();
      await checkLayout(expected);
      assert.equal(await page.locator('#starRoad .tv-star-mark').first().evaluate(el => getComputedStyle(el).borderTopWidth), '3px', 'Old settings without starStroke retain the default');
      assert.equal(await page.evaluate(() => JSON.stringify(state.rounds)), records);
    }
    await page.evaluate(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'baccarat_tv_settings_v1') throw Error('Storage denied');
        return setItem.call(this, key, value);
      };
    });
    await page.click('#tvSettingsButton');
    await page.fill('#tvBigColumns', '40');
    await page.click('#tvSettings button[type=submit]');
    assert.equal(await page.locator('#tvSettingsStatus').isVisible(), true);
    await checkLayout(40); // Failed save leaves the preview visible.
    await page.click('#tvSettingsCancel');
    await checkLayout(46); // Cancel restores the settings from before editing.
    assert.deepEqual(errors, []);
    console.log('PASS TV settings: column limits, 6 rows, 2:1 sizing, bottom fit, renderer alignment, strokes, persistence, cancel/reset, keyboard, entry/undo, themes, viewport fit');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
