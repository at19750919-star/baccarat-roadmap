const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const { _electron } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const core = require('./update-core.cjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jiujiu-upd-'));
const profile = path.join(tmp, 'profile'), siteCopy = path.join(tmp, 'site'), outDir = path.join(tmp, 'out');
const keyFile = path.join(__dirname, '..', 'update-signing-key', 'private.pem');
const version = require('./package.json').version;

const launch = () => _electron.launch({ executablePath: require('electron'), args: [__dirname], env: { ...process.env, ROADMAP_TEST_PROFILE: profile }, timeout: 45000 });
const ready = async app => { const p = await app.firstWindow(); await p.waitForFunction(() => window.BaccaratTVView); return p; };
const pageUrl = page => page.url();
// 在主程序內走和「拖入檔案」相同的 IPC 路徑
const importFile = async (app, file) => {
  await app.evaluate(({ ipcMain, BrowserWindow }, f) => {
    globalThis.roadmapLastUpdate = null;
    const wc = BrowserWindow.getAllWindows()[0].webContents;
    ipcMain.emit('roadmap:update-file', { sender: wc, senderFrame: { url: wc.getURL().split('?')[0] } }, f);
  }, file);
  for (let i = 0; i < 100; i++) {
    const r = await app.evaluate(() => globalThis.roadmapLastUpdate);
    if (r) return r;
    await new Promise(r => setTimeout(r, 200));
  }
  throw Error('no update result');
};
const mark = async page => page.evaluate(() => window.__UPDATE_MARK || null);

(async () => {
  // 準備：複製 site-public，做一個肉眼可見的小改動（不動網頁版原始檔）
  const copyDir = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const i of fs.readdirSync(a, { withFileTypes: true })) i.isDirectory() ? copyDir(path.join(a, i.name), path.join(b, i.name)) : fs.copyFileSync(path.join(a, i.name), path.join(b, i.name)); };
  copyDir(path.join(__dirname, 'site-public'), siteCopy);
  const html = path.join(siteCopy, '百家樂路單', 'tv.html');
  fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace('<head>', '<head>\n<script>window.__UPDATE_MARK = "V1";</script>'));
  const make = (extra = []) => execFileSync(process.execPath, [path.join(__dirname, 'make-update.cjs'), '--no-prepare', '--site', siteCopy, '--out', outDir, '--baseline-dir', path.join(tmp, 'bl'), ...extra], { encoding: 'utf8' });
  fs.mkdirSync(path.join(tmp, 'bl'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'update-baselines', `${version}.json`), path.join(tmp, 'bl', `${version}.json`));
  const out = make();
  const file1 = path.join(outDir, `玖玖路單更新-${version}-1.jjupdate`);
  assert.ok(fs.existsSync(file1), out);
  console.log('make-update:', out.trim().split('\n').join(' | '));
  assert.ok(fs.statSync(file1).size < 200 * 1024, 'update file should be small (only changed files)');

  // (a) 套用 -> 重新載入內容變了 -> 重啟仍是新內容
  let app = await launch(), page = await ready(app);
  assert.equal(await mark(page), null);
  assert.ok(!/site-override/.test(pageUrl(page)));
  await page.evaluate(() => localStorage.setItem('__keep', 'yes'));
  let r = await importFile(app, file1);
  assert.deepEqual(r, { ok: true, update: `${version}-1` });
  await page.waitForFunction(() => window.BaccaratTVView && window.__UPDATE_MARK === 'V1');
  assert.match(decodeURIComponent(pageUrl(page)), /site-override/);
  assert.equal(await page.evaluate(() => localStorage.getItem('__keep')), 'yes');
  console.log('(a1) PASS: applied, page reloaded with changed content, localStorage kept');
  await app.close();
  app = await launch(); page = await ready(app);
  assert.equal(await mark(page), 'V1');
  assert.match(decodeURIComponent(pageUrl(page)), /site-override/);
  console.log('(a2) PASS: after restart still the updated content');

  // 同版本再匯入 -> 拒絕
  r = await importFile(app, file1);
  assert.equal(r.ok, false);

  // (b) 竄改一個位元組 -> 拒絕，仍是前一版
  const outer = JSON.parse(zlib.gunzipSync(fs.readFileSync(file1)).toString());
  const bad = JSON.parse(outer.payload);
  const tv = bad.files.find(f => f.path.endsWith('tv.html'));
  tv.data = tv.data.slice(0, 40) + (tv.data[40] === 'A' ? 'B' : 'A') + tv.data.slice(41);
  const tampered = path.join(tmp, 'tampered.jjupdate');
  fs.writeFileSync(tampered, zlib.gzipSync(JSON.stringify({ format: 1, payload: JSON.stringify(bad), sig: outer.sig })));
  r = await importFile(app, tampered);
  assert.equal(r.ok, false); assert.match(r.error, /簽章/);
  assert.equal(await mark(page), 'V1');
  assert.match(decodeURIComponent(pageUrl(page)), new RegExp(`site-override.${version}-1`));
  console.log('(b1) PASS: tampered file rejected (' + r.error + '), previous version still active');

  // (b2) 簽章有效但 sha256 與內容不符 -> 拒絕
  const key = fs.readFileSync(keyFile, 'utf8');
  const signed = (obj, name) => {
    const payload = JSON.stringify(obj);
    const sig = require('node:crypto').sign(null, Buffer.from(payload), require('node:crypto').createPrivateKey(key)).toString('base64');
    const f = path.join(tmp, name); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify({ format: 1, payload, sig }))); return f;
  };
  const data = Buffer.from('x');
  const base = { app: 'jiujiu-roadmap', update: `${version}-5`, base: version, seq: 5, removed: [] };
  r = await importFile(app, signed({ ...base, files: [{ path: '百家樂路單/tv.js', sha256: '0'.repeat(64), size: 1, data: data.toString('base64') }] }, 'badsha.jjupdate'));
  assert.equal(r.ok, false); assert.match(r.error, /內容不符/);
  console.log('(b2) PASS: valid signature but wrong sha256 rejected');

  // (c) 路徑穿越／絕對路徑／不允許副檔名 -> 拒絕
  const good = f => ({ path: f, sha256: core.sha256(data), size: 1, data: data.toString('base64') });
  for (const bp of ['../evil.js', '百家樂路單/../../evil.js', 'C:/evil.js', '/evil.js', '百家樂路單\\..\\evil.js', '百家樂路單/run.exe', '百家樂路單/a.cjs']) {
    r = await importFile(app, signed({ ...base, files: [good(bp)] }, 'trav.jjupdate'));
    assert.equal(r.ok, false, bp); assert.match(r.error, /不允許的路徑/, bp);
  }
  assert.ok(!fs.existsSync(path.join(tmp, 'evil.js')) && !fs.existsSync(path.join(profile, 'evil.js')));
  assert.equal(await mark(page), 'V1');
  console.log('(c) PASS: path traversal / absolute / bad extension rejected, nothing written');

  // 另一個基底版本的更新檔 -> 拒絕
  r = await importFile(app, signed({ ...base, base: '9.9.9', update: '9.9.9-5', files: [good('百家樂路單/tv.js')] }, 'otherbase.jjupdate'));
  assert.equal(r.ok, false); assert.match(r.error, /適用/);

  // 較新的更新檔（seq 2，累積）可套用，舊的 seq 1 之後不能回退
  fs.appendFileSync(path.join(siteCopy, '百家樂路單', 'tv.js'), '\nwindow.__UPDATE_MARK = "V2";\n');
  fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace('"V1"', '"V1b"'));
  make();
  const file2 = path.join(outDir, `玖玖路單更新-${version}-2.jjupdate`);
  r = await importFile(app, file2);
  assert.equal(r.ok, true);
  await page.waitForFunction(() => window.__UPDATE_MARK === 'V2');
  const dirs = fs.readdirSync(path.join(profile, 'site-override')).sort();
  assert.deepEqual(dirs, [`${version}-2`, 'active.json']);
  r = await importFile(app, file1);
  assert.equal(r.ok, false);
  console.log('(a3) PASS: newer cumulative update applied, old override cleaned, rollback refused');
  await app.close();

  // 更新版安裝檔（版本較高）要忽略舊覆蓋版本
  const af = path.join(profile, 'site-override', 'active.json');
  const act = JSON.parse(fs.readFileSync(af, 'utf8')); act.base = '1.0.6'; fs.writeFileSync(af, JSON.stringify(act));
  app = await launch(); page = await ready(app);
  assert.equal(await mark(page), null);
  assert.ok(!/site-override/.test(decodeURIComponent(pageUrl(page))));
  console.log('(e) PASS: override for a different installed version is ignored, built-in site used');
  await app.close();

  // 覆蓋版本被破壞 -> 退回內建
  act.base = version; fs.writeFileSync(af, JSON.stringify(act));
  fs.appendFileSync(path.join(profile, 'site-override', `${version}-2`, '百家樂路單', 'tv.js'), '//x');
  app = await launch(); page = await ready(app);
  assert.equal(await mark(page), null);
  console.log('(f) PASS: corrupted override falls back to built-in site');
  await app.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('ALL PASS');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
