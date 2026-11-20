const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('OfflineRoadmap', {
  save: pack => ipcRenderer.invoke('roadmap:save', pack),
  cloud: request => ipcRenderer.invoke('roadmap:cloud', request),
  cloudStatus: receipt => ipcRenderer.invoke('roadmap:cloud-status', receipt),
  prompt: (message, initial) => ipcRenderer.sendSync('roadmap:prompt', message, initial),
  selectFolder: currentPath => ipcRenderer.invoke('roadmap:select-folder', currentPath)
});
contextBridge.exposeInMainWorld('RoadmapLicense', {
  status: () => ipcRenderer.invoke('roadmap:license-status'),
  submit: code => ipcRenderer.invoke('roadmap:license-submit', code),
  retry: () => ipcRenderer.invoke('roadmap:license-retry'),
  reset: () => ipcRenderer.invoke('roadmap:license-reset'),
  quit: () => ipcRenderer.send('roadmap:quit-license'),
  onView: callback => ipcRenderer.on('roadmap:license-view', (_event, view) => callback(view))
});


// Desktop-only: pressing 0 three times in a row (within 1.5 s) closes the app,
// unless the user is typing, a settings/dialog is open, or 0 is bound to a game key.
let zeroPresses = [];
window.addEventListener('keydown', event => {
  if (event.key !== '0') { zeroPresses = []; return; }
  if (event.repeat || event.isComposing || event.defaultPrevented) return;
  if (event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
  const target = event.target;
  const el = target instanceof Element ? target : document.activeElement;
  const typing = el && (el.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
  if (typing) { zeroPresses = []; return; }
  try {
    const saved = JSON.parse(localStorage.getItem('baccarat_key_bindings_v1') || '{}');
    if (Object.values(saved).some(v => String(v).trim() === '0')) return;
  } catch (_) {}
  const now = Date.now();
  zeroPresses = zeroPresses.filter(t => now - t < 1500);
  zeroPresses.push(now);
  if (zeroPresses.length < 3) return;
  zeroPresses = [];
  setTimeout(() => {
    if (event.defaultPrevented || document.querySelector('dialog[open]')) return;
    ipcRenderer.send('roadmap:quit');
  }, 0);
});

// Desktop-only: drag a .jjupdate file onto the window to import an update.
const isUpdateDrag = event => [...(event.dataTransfer?.items || [])].some(i => i.kind === 'file');
window.addEventListener('dragover', event => { if (isUpdateDrag(event)) event.preventDefault(); }, true);
window.addEventListener('drop', event => {
  const file = [...(event.dataTransfer?.files || [])].find(f => /\.jjupdate$/i.test(f.name));
  if (!file) return;
  event.preventDefault(); event.stopPropagation();
  try { ipcRenderer.send('roadmap:update-file', webUtils.getPathForFile(file)); } catch (_) {}
}, true);
