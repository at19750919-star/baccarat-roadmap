const { app, BrowserWindow, Menu, ipcMain, session, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const licenseCore = require('./license-core.cjs');

if (process.env.ROADMAP_TEST_PROFILE) app.setPath('userData', process.env.ROADMAP_TEST_PROFILE);
let mainWindow;
const updateCore = require('./update-core.cjs');
// 更新檔簽章公鑰（對應私鑰在專案外的 update-signing-key，不會被打包）
const UPDATE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAWa5dTF9f5tK6c5LBUd8liaFY9wT5QrXs7RQj5YHfVSg=
-----END PUBLIC KEY-----`;
// 雲端備份收件網址（與網頁版相同）。只有主程式能連；畫面本身仍全面斷網。
const CLOUD_ENDPOINT = 'https://script.google.com/macros/s/AKfycbypt3_PnEL5TgdDPaBwg1M5bWAjQMR9dD5Jslicn3eZCtuNSTtqO35RafhQpuX-l9_m/exec';
async function cloudRequest(url, options, ms) {
  const response = await fetch(url, { ...options, redirect: 'follow', signal: AbortSignal.timeout(ms) });
  if (!response.ok) throw Error('HTTP ' + response.status);
  const data = await response.json();
  if (!data || typeof data.success !== 'boolean') throw Error('invalid response');
  return data;
}
const LICENSE_TIMEOUT_MS = 8000;
function licenseEnforced() {
  if (app.isPackaged) return true;
  return process.env.ROADMAP_LICENSE_ENFORCE === '1';
}
function currentMachineId() {
  if (process.env.ROADMAP_MACHINE_ID) return String(process.env.ROADMAP_MACHINE_ID).trim();
  if (process.platform !== 'win32') return '';
  try {
    const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true });
    return licenseCore.parseMachineGuid(out);
  } catch {
    return '';
  }
}
function licenseStatePath() {
  return path.join(app.getPath('userData'), 'license-state.json');
}
function readLicenseState() {
  try { return JSON.parse(fs.readFileSync(licenseStatePath(), 'utf8')); }
  catch { return null; }
}
function writeLicenseState(state) {
  if (!state) {
    try { fs.unlinkSync(licenseStatePath()); } catch { /* 還沒有授權紀錄 */ }
    return;
  }
  fs.mkdirSync(path.dirname(licenseStatePath()), { recursive: true });
  fs.writeFileSync(licenseStatePath(), JSON.stringify(state));
}
function persistLicense(verdict, code) {
  if (verdict.store) { writeLicenseState(verdict.store); return; }
  if (!verdict.clearGrace) return;
  const normalized = licenseCore.normalizeCode(code);
  writeLicenseState(verdict.rememberCode && normalized ? { version: 1, code: normalized } : null);
}
async function requestLicense(code, machineId) {
  const endpoint = process.env.ROADMAP_LICENSE_URL || CLOUD_ENDPOINT;
  try {
    const body = JSON.stringify({ action: 'licenseCheck', code: licenseCore.normalizeCode(code), machineId });
    const data = await cloudRequest(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body }, LICENSE_TIMEOUT_MS);
    if (!data || data.success !== true || typeof data.payload !== 'string' || typeof data.signature !== 'string') return { invalid: true };
    return { payload: data.payload, signature: data.signature };
  } catch {
    return null;
  }
}
function judgeLicense(code, machineId, fresh, interactive) {
  const now = Date.now();
  return licenseCore.evaluate({
    stored: readLicenseState(), fresh, code, machineId, now, today: licenseCore.todayTaipei(now), interactive: !!interactive
  });
}
let licenseView = { mode: 'activate', message: '請輸入業主給你的授權碼。' };
function publishLicense(view) {
  licenseView = { mode: view.mode, message: view.message || '' };
  const send = () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('roadmap:license-view', licenseView); };
  if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', send);
  else send();
}
const builtinSite = path.join(__dirname, 'site-public');
let overrideRoot, activeSite = null, pagePath, pageURL;
function chooseSite() {
  activeSite = updateCore.findActive({ overrideRoot, installedVersion: app.getVersion() });
  pagePath = path.join(activeSite ? activeSite.dir : builtinSite, '百家樂路單', 'tv.html');
  pageURL = pathToFileURL(pagePath).href;
}
const isMain = event => event.sender === mainWindow?.webContents && event.senderFrame?.url.split('?')[0] === pageURL;

function unusedName(folder, filename) {
  const clean = path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  const { name, ext } = path.parse(clean);
  let file = path.join(folder, clean), n = 1;
  while (fs.existsSync(file)) file = path.join(folder, `${name} (${n++})${ext}`);
  return file;
}

let updating = false;
async function importUpdate(filePath) {
  if (updating) return;
  updating = true;
  const test = !!process.env.ROADMAP_TEST_PROFILE;
  let result;
  try {
    if (typeof filePath !== 'string' || !/\.jjupdate$/i.test(filePath)) throw Error('不是更新檔（.jjupdate）');
    const verified = updateCore.verifyUpdate(await fs.promises.readFile(filePath), UPDATE_PUBLIC_KEY, app.getVersion());
    if (activeSite && verified.seq <= activeSite.seq) throw Error(`目前已是 ${activeSite.update}，此更新檔不是較新的版本`);
    updateCore.applyToOverride({ builtinSite, overrideRoot, verified });
    chooseSite();
    if (activeSite?.update !== verified.update) throw Error('套用後驗證失敗');
    result = { ok: true, update: verified.update };
    mainWindow.loadFile(pagePath);
  } catch (e) {
    chooseSite();
    result = { ok: false, error: e.message };
  }
  globalThis.roadmapLastUpdate = result;
  if (!test) {
    await dialog.showMessageBox(mainWindow, { type: result.ok ? 'info' : 'error', title: '玖玖百家樂路單', buttons: ['確定'],
      message: result.ok ? `更新完成：版本 ${result.update}` : '更新檔無效，未套用', detail: result.ok ? undefined : result.error });
  }
  updating = false;
}
async function pickUpdate() {
  const pick = await dialog.showOpenDialog(mainWindow, { title: '選擇更新檔', properties: ['openFile'], filters: [{ name: '玖玖路單更新檔', extensions: ['jjupdate'] }] });
  if (!pick.canceled && pick.filePaths[0]) await importUpdate(pick.filePaths[0]);
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  overrideRoot = path.join(app.getPath('userData'), 'site-override');
  chooseSite();
  // The installed app never depends on an internet connection.
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_, done) => done({ cancel: true }));
  session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));
  const folder = process.env.ROADMAP_TEST_EXPORTS || path.join(app.getPath('documents'), '玖玖路單');
  fs.mkdirSync(folder, { recursive: true });
  session.defaultSession.on('will-download', (_, item) => item.setSavePath(unusedName(folder, item.getFilename())));

  mainWindow = new BrowserWindow({
    width: 1580, height: 940, minWidth: 1000, minHeight: 620,
    title: '玖玖百家樂路單', backgroundColor: '#7a0b0b',
    frame: false,
    icon: path.join(__dirname, 'site-public', '百家樂路單', 'tv-at-logo-transparent.png'),
    show: !process.env.ROADMAP_TEST_PROFILE,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== pageURL) event.preventDefault(); });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.control && !input.alt && !input.shift && !input.meta && input.key.toLowerCase() === 'u') { event.preventDefault(); pickUpdate(); }
  });
  // The editor may pop out its local panel, but never open an external site.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => url === 'about:blank'
    ? { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } } }
    : { action: 'deny' });
  ipcMain.handle('roadmap:select-folder', async (event, currentPath) => {
    if (!isMain(event)) return null;
    const defaultPath = (typeof currentPath === 'string' && currentPath && fs.existsSync(currentPath)) ? currentPath : folder;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '選擇路單儲存資料夾（電腦本機或 USB 隨身碟）',
      defaultPath,
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths || !result.filePaths.length) return null;
    return result.filePaths[0];
  });
  ipcMain.handle('roadmap:save', async (event, pack) => {
    if (!isMain(event) || typeof pack?.name !== 'string' || typeof pack?.json !== 'string') throw Error('無效的路單檔案');
    if (pack.json.length > 4 * 1024 * 1024) throw Error('路單檔案過大');
    const targetFolder = (typeof pack.folder === 'string' && pack.folder.trim()) ? pack.folder.trim() : folder;
    fs.mkdirSync(targetFolder, { recursive: true });
    const base = pack.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 100) || '路單';
    const jsonPath = unusedName(targetFolder, base + '.json');
    await fs.promises.writeFile(jsonPath, pack.json, { flag: 'wx' });
    return { jsonPath, folder: targetFolder };
  });
  ipcMain.handle('roadmap:cloud', async (event, req) => {
    if (!isMain(event) || !/^[0-9a-f]{64}$/.test(req?.receipt || '') || !req.roadmap || typeof req.roadmap !== 'object' || typeof req.pngBase64 !== 'string') throw Error('無效的雲端備份資料');
    if (req.pngBase64.length > 8.5 * 1024 * 1024 || JSON.stringify(req.roadmap).length > 262144) throw Error('備份檔案過大');
    const body = JSON.stringify({ action: 'roadSubmit', receipt: req.receipt, roadmap: req.roadmap, pngBase64: req.pngBase64 });
    return cloudRequest(CLOUD_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body }, 40000);
  });
  ipcMain.handle('roadmap:cloud-status', async (event, receipt) => {
    if (!isMain(event) || !/^[0-9a-f]{64}$/.test(receipt || '')) throw Error('無效的收件碼');
    return cloudRequest(CLOUD_ENDPOINT + '?action=roadStatus&receipt=' + receipt, {}, 12000);
  });
  ipcMain.on('roadmap:update-file', (event, filePath) => { if (isMain(event)) importUpdate(filePath); });
  ipcMain.on('roadmap:quit', event => { if (isMain(event) && mainWindow && !mainWindow.isDestroyed()) mainWindow.close(); });
  const isLicenseWindow = event => event.sender === mainWindow?.webContents;
  ipcMain.handle('roadmap:license-status', event => isLicenseWindow(event) ? licenseView : null);
  ipcMain.handle('roadmap:license-submit', async (event, code) => {
    if (!isLicenseWindow(event)) return { ok: false, message: '無法送出' };
    const machineId = currentMachineId();
    if (!licenseCore.machineOk(machineId)) return publishAndReturn({ allow: false, mode: 'locked', message: '讀不到這台電腦的識別碼。請聯絡業主。', clearGrace: false });
    if (!licenseCore.codeOk(code)) return publishAndReturn({ allow: false, mode: 'activate', message: '授權碼格式不對。請向業主確認授權碼。', clearGrace: false });
    const fresh = await requestLicense(code, machineId);
    const verdict = judgeLicense(code, machineId, fresh, true);
    persistLicense(verdict, code);
    if (verdict.allow) { await mainWindow.loadFile(pagePath); return { ok: true }; }
    return publishAndReturn(verdict);
  });
  ipcMain.handle('roadmap:license-retry', async event => {
    if (!isLicenseWindow(event)) return { ok: false, message: '無法送出' };
    const saved = readLicenseState();
    if (!saved?.code) return publishAndReturn({ allow: false, mode: 'activate', message: '請輸入業主給你的授權碼。', clearGrace: false });
    const machineId = currentMachineId();
    if (!licenseCore.machineOk(machineId)) return publishAndReturn({ allow: false, mode: 'locked', message: '讀不到這台電腦的識別碼。請聯絡業主。', clearGrace: false });
    const fresh = await requestLicense(saved.code, machineId);
    const verdict = judgeLicense(saved.code, machineId, fresh, false);
    persistLicense(verdict, saved.code);
    if (verdict.allow) { await mainWindow.loadFile(pagePath); return { ok: true }; }
    return publishAndReturn(verdict);
  });
  ipcMain.handle('roadmap:license-reset', event => {
    if (!isLicenseWindow(event)) return null;
    writeLicenseState(null);
    return publishAndReturn({ allow: false, mode: 'activate', message: '請輸入業主給你的授權碼。', clearGrace: false });
  });
  ipcMain.on('roadmap:quit-license', event => { if (isLicenseWindow(event) && mainWindow && !mainWindow.isDestroyed()) mainWindow.close(); });
  function publishAndReturn(verdict) {
    publishLicense(verdict);
    return { ok: false, mode: verdict.mode, message: verdict.message || '' };
  }
  ipcMain.on('roadmap:prompt', (event, message, initial) => {
    if (!isMain(event)) { event.returnValue = null; return; }
    let answered = false;
    const promptWindow = new BrowserWindow({
      parent: mainWindow, modal: true, width: 430, height: 220, resizable: false,
      title: '路單名稱', show: !process.env.ROADMAP_TEST_PROFILE,
      webPreferences: { preload: path.join(__dirname, 'prompt-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false }
    });
    const reply = (answerEvent, value) => {
      if (answerEvent.sender !== promptWindow.webContents || answered) return;
      answered = true; event.returnValue = typeof value === 'string' ? value : null; promptWindow.close();
    };
    ipcMain.on('roadmap:prompt-result', reply);
    promptWindow.on('closed', () => { ipcMain.removeListener('roadmap:prompt-result', reply); if (!answered) { answered = true; event.returnValue = null; } });
    promptWindow.webContents.once('did-finish-load', () => promptWindow.webContents.send('roadmap:prompt-data', { message: String(message), initial: String(initial || '') }));
    promptWindow.loadFile(path.join(__dirname, 'prompt.html'));
  });
  if (!licenseEnforced()) {
    mainWindow.loadFile(pagePath);
  } else {
    const saved = readLicenseState();
    const machineId = currentMachineId();
    if (!licenseCore.machineOk(machineId)) {
      publishLicense({ mode: 'locked', message: '讀不到這台電腦的識別碼。請聯絡業主。' });
      mainWindow.loadFile(path.join(__dirname, 'license.html'));
    } else if (!saved?.code) {
      publishLicense({ mode: 'activate', message: '請輸入業主給你的授權碼。' });
      mainWindow.loadFile(path.join(__dirname, 'license.html'));
    } else {
      publishLicense({ mode: 'wait', message: '正在確認授權，請稍候。' });
      mainWindow.loadFile(path.join(__dirname, 'license.html'));
      const fresh = await requestLicense(saved.code, machineId);
      const verdict = judgeLicense(saved.code, machineId, fresh, false);
      persistLicense(verdict, saved.code);
      if (verdict.allow) mainWindow.loadFile(pagePath);
      else publishLicense(verdict);
    }
  }
  if (!process.env.ROADMAP_TEST_PROFILE) mainWindow.maximize();
}).catch(error => {
  dialog.showErrorBox('玖玖百家樂路單', '授權檢查發生問題。請聯絡業主。\n' + (error && error.message || ''));
  app.quit();
});
app.on('window-all-closed', () => app.quit());

