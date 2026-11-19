const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { _electron } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output = path.join(__dirname, 'test-output');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jiujiu-offline-test-'));
const exportsPath = fs.mkdtempSync(path.join(os.tmpdir(), 'jiujiu-offline-save-'));
const installedExe = process.env.ROADMAP_TEST_EXE;
const launch = () => _electron.launch({
  executablePath: installedExe || require('electron'),
  args: installedExe ? [] : [__dirname],
  env: { ...process.env, ROADMAP_TEST_PROFILE: profile, ROADMAP_TEST_EXPORTS: exportsPath },
  timeout: 45000
});
(async () => {
  let application;
  try {
    application = await launch();
    const page = await application.firstWindow();
    const titleInset = await application.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win.getContentBounds().y - win.getBounds().y;
    });
    assert.ok(titleInset <= 8, `Unexpected native title bar height: ${titleInset}`);
    const errors = [], requests = [], failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    page.on('requestfailed', request => failures.push(request.url()));
    await page.waitForFunction(() => window.BaccaratTVView && typeof window.html2canvas === 'function');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#tvEditToggle, #tvEditPanel').count(), 0);
    assert.equal(await page.locator('.tv-brand-logo').evaluate(e => e.complete && e.naturalWidth > 0), true);
    await page.click('#tvSettingsButton');
    assert.equal(await page.locator('[data-settings-tab]:visible').count(), 3);
    assert.equal(await page.locator('#tvTabSave:visible').count(), 1);
    await page.click('#tvSettingsCancel');
    const derived = await page.evaluate(() => {
      state.rounds = [...'BPBPBBBBBBBPPPPPPPPPPBBBBPBBBPPPBPB'].map(r => ({ r })); renderAll();
      const counts = ['bigEye', 'smallRoad', 'cockroachRoad'].map(id => document.getElementById(id).querySelectorAll('.derived-dot').length);
      state.rounds = []; renderAll(); return counts;
    });
    assert.deepEqual(derived, [33, 32, 31], 'Installed offline roads include the chronology fix');
    await page.evaluate(() => { speech.enabled = false; });
    await page.keyboard.press('1'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => state.rounds.length === 1);
    await page.keyboard.press('2'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => state.rounds.length === 2);
    await page.keyboard.press('7');
    await page.waitForFunction(() => state.rounds.length === 1);
    console.log('PASS: no editor; public settings; result entry and undo.');
    await page.keyboard.press('8');
    await page.waitForSelector('#tvSavePromptModal[open]');
    await page.locator('#tvSaveModalInput').fill('離線驗收');
    await page.locator('#tvSaveConfirmBtn').click();
    await page.waitForFunction(() => /^(已儲存 JSON|儲存未完成)/.test(document.getElementById('backupStatus').textContent), null, { timeout: 45000 });
    const saveStatus = await page.locator('#backupStatus').textContent();
    assert.ok(saveStatus.startsWith('已儲存 JSON'), saveStatus);
    const json = fs.readFileSync(path.join(exportsPath, '離線驗收.json'), 'utf8');
    assert.equal(JSON.parse(json).rounds.length, 1);
    assert.equal(fs.existsSync(path.join(exportsPath, '離線驗收.png')), false);
    console.log('PASS: 8 opens name dialog; saves valid JSON locally without PNG.');
    await page.locator('#backupCloseBtn').click();
    for (const skin of ['red', 'green', 'black', 'led']) {
      const result = await page.evaluate(async skin => {
        document.documentElement.dataset.skin = skin;
        const source = document.querySelector('.tv-app'), before = source.getAttribute('style');
        const image = await BaccaratTVExport.png({ rounds: state.rounds });
        return { bytes: image.blob.size, unchanged: before === source.getAttribute('style') };
      }, skin);
      assert.ok(result.bytes > 10000, skin + ' PNG export');
      assert.equal(result.unchanged, true, skin + ' export preserves live styles');
    }
    await page.evaluate(() => { document.documentElement.dataset.skin = 'red'; });
    console.log('PASS: all four skins export PNG without changing live styles.');
    // Decode both local dragon files without depending on online codecs or assets.
    const videos = await page.evaluate(async () => {
      const results = [];
      const selected = ['bankerSrc', 'playerSrc'].map(key => document.getElementById('dragonVideo').dataset[key]);
      for (const src of selected) {
        const video = document.createElement('video'); video.muted = true;
        results.push(await new Promise(resolve => {
          video.onloadeddata = () => resolve({ src, ok: video.videoWidth > 0 });
          video.onerror = () => resolve({ src, ok: false });
          video.src = src; video.load();
        }));
      }
      return results;
    });
    assert.ok(videos.every(item => item.ok));
    assert.deepEqual(errors, []); assert.deepEqual(requests, []); assert.deepEqual(failures, []);
    await application.close(); application = await launch();
    const restored = await application.firstWindow();
    await restored.waitForFunction(() => state.rounds.length === 1);
    assert.equal(await restored.evaluate(() => loadSavedRoadmaps().some(road => road.name === '離線驗收')), true);
    await restored.keyboard.type('99');
    await restored.waitForSelector('#tvClearConfirmModal[open]');
    await restored.locator('#tvClearConfirmBtn').click();
    await restored.waitForFunction(() => state.rounds.length === 0);
    console.log('PASS: local dragon decoding; no network requests; road + saved list survive restart.');
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: true, installedExe: installedExe || null, exportsPath, videos, errors, requests, failures }, null, 2));
  } finally { await application?.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
