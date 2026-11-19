const { app, BrowserWindow, Menu, ipcMain, session, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

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

app.whenReady().then(() => {
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
  mainWindow.loadFile(pagePath);
  if (!process.env.ROADMAP_TEST_PROFILE) mainWindow.maximize();
});
app.on('window-all-closed', () => app.quit());

