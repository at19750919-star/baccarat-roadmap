const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
(async () => {
  const application = await _electron.launch({
    executablePath: process.env.ROADMAP_TEST_EXE || path.resolve('dist/win-unpacked/玖玖百家樂路單.exe'),
    env: { ...process.env, ROADMAP_TEST_PROFILE: fs.mkdtempSync(path.join(os.tmpdir(), 'jiujiu-titlebar-')) },
    timeout: 30000
  });
  try {
    const page = await application.firstWindow();
    await page.waitForFunction(() => window.BaccaratTVView);
    const records = [];
    for (const maximized of [false, true]) {
      const record = await application.evaluate(async ({ BrowserWindow, desktopCapturer, screen }, maximize) => {
        const win = BrowserWindow.getAllWindows()[0];
        win.setAlwaysOnTop(true);
        win.show(); if (maximize) win.maximize(); else { win.unmaximize(); win.setBounds({ x: 100, y: 100, width: 1580, height: 940 }); }
        win.focus();
        await new Promise(resolve => setTimeout(resolve, 1200));
        const display = screen.getDisplayMatching(win.getBounds());
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: display.size.width * display.scaleFactor, height: display.size.height * display.scaleFactor } });
        const source = sources.find(item => item.display_id === String(display.id));
        const bounds = win.getBounds(), content = win.getContentBounds();
        const x = Math.max(0, Math.round((bounds.x - display.bounds.x) * display.scaleFactor));
        const y = Math.max(0, Math.round((bounds.y - display.bounds.y) * display.scaleFactor));
        const image = source.thumbnail.crop({ x, y, width: Math.min(Math.round(bounds.width * display.scaleFactor), source.thumbnail.getSize().width - x), height: 80 });
        return { maximized: win.isMaximized(), visible: win.isVisible(), inset: content.y - bounds.y, screenshot: image.toPNG().toString('base64') };
      }, maximized);
      assert.equal(record.visible, true); assert.equal(record.maximized, maximized);
      assert.ok(record.inset <= 8, 'Native title bar is consuming content space');
      const imagePath = path.join('test-output', maximized ? 'titlebar-maximized.png' : 'titlebar-normal.png');
      fs.writeFileSync(imagePath, Buffer.from(record.screenshot, 'base64'));
      delete record.screenshot; records.push(record);
    }
    fs.writeFileSync('test-output/titlebar-visible-report.json', JSON.stringify(records, null, 2));
    console.log(JSON.stringify(records));
  } finally { await application.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
