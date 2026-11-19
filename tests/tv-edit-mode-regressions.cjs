const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const editFile = path.join(rootDir, 'tv-edit-mode.js');
const bridgeFile = path.join(rootDir, 'tv-font-bridge.js');
const settingsIoFile = path.join(rootDir, '..', '共用元件', 'settings-io', 'settings-io.js');
const versionFile = path.join(rootDir, '..', '共用元件', 'version-snapshot', 'version-snapshot.js');

function memoryStorage(initial) {
  const data = Object.assign({}, initial || {});
  return {
    get length() { return Object.keys(data).length; },
    key(index) { return Object.keys(data)[index] || null; },
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
    dump: data
  };
}

function run(file, sandbox) {
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  return sandbox;
}

function element(spec) {
  return {
    id: spec.id || '',
    textContent: spec.text == null ? '' : spec.text,
    children: spec.children || [],
    style: Object.assign({}, spec.style || {}),
    innerHTML: '<untouched>',
    matches() { return false; }
  };
}

const coreBox = { console, globalThis: null };
coreBox.globalThis = coreBox;
run(editFile, coreBox);
run(settingsIoFile, coreBox);
const core = coreBox.TvEditCore;
assert.ok(core, '編輯核心應在沒有 DOM 時也可載入');
assert.equal(typeof coreBox.document, 'undefined');

const calls = [];
const ordered = element({ id: 'title', text: '尊榮百家樂' });
core.captureThenApply([ordered], node => {
  calls.push('capture');
  node._baseline = core.captureBaseline(node);
}, node => {
  calls.push('apply');
  core.applyRecord(node, { color: 'red', fontWeight: '700', fontSize: '30px', text: '已改' });
});
assert.equal(JSON.stringify(calls), JSON.stringify(['capture', 'apply']));
assert.equal(ordered.textContent, '已改');
assert.equal(ordered.style.fontWeight, '700');
core.paintFromBaseline(ordered, ordered._baseline, { color: 'blue', text: '<img src=x onerror=alert(1)>' });
assert.equal(ordered.style.color, 'blue');
assert.equal(ordered.style.fontWeight, '');
assert.equal(ordered.style.fontSize, '');
assert.equal(ordered.textContent, '<img src=x onerror=alert(1)>');
assert.equal(ordered.innerHTML, '<untouched>');

const late = element({ id: 'title', text: '已改', style: { color: 'red', fontWeight: '700' } });
const lateBase = core.captureBaseline(late);
core.writeBaseline(late, lateBase);
assert.equal(late.textContent, '已改', '太晚抓基準時，重設仍停在已改內容');
assert.equal(late.style.fontWeight, '700');

const count = element({ id: 'tvTopRoundCount', text: '8' });
core.applyRecord(count, { text: '999', color: 'gold', fontWeight: '500' });
assert.equal(count.textContent, '8');
assert.equal(count.style.fontWeight, '500');
assert.equal(count.innerHTML, '<untouched>');
const cleaned = core.sanitizeSettings({
  tvTopRoundCount: { text: '999', color: 'gold' },
  cntB: { text: '4', fontSize: '18px' },
  title: { text: '尊榮百家樂', fontWeight: '700', fontSize: '' }
});
assert.equal(cleaned.tvTopRoundCount.text, undefined);
assert.equal(cleaned.cntB.text, undefined);
assert.equal(cleaned.cntB.fontSize, '18px');
assert.equal(cleaned.title.fontWeight, '700');
assert.equal(cleaned.title.text, '尊榮百家樂');

const recorded = element({ id: 'title', text: '桌牌', style: { fontWeight: '600', color: 'red' } });
assert.equal(core.readRecord(recorded).fontWeight, '600');
const liveRecord = element({ id: 'cntP', text: '15', style: { fontWeight: '800' } });
assert.equal(core.readRecord(liveRecord).text, undefined);
assert.equal(core.readRecord(liveRecord).fontWeight, '800');

const bundle = core.makeVersionBundle({
  settings: cleaned,
  splits: { '1': { dir: 'row', r: 0.4, a: { parts: ['main'] }, b: { parts: ['text'], text: '自訂格' } } },
  controls: { title: { '--edit-font-size': { num: 28, unit: 'px' } } },
  panel: { left: 12, top: 20, width: 360, height: 280 }
});
assert.equal(bundle.v, 1);
assert.equal(bundle.settings.title.text, '尊榮百家樂');
assert.equal(bundle.settings.cntB.text, undefined);
assert.equal(bundle.splits['1'].b.text, '自訂格');
assert.equal(bundle.controls.title['--edit-font-size'].num, 28);
assert.equal(JSON.stringify(bundle).includes('999'), false);

assert.equal(core.validatePageSettings({
  'tv-edit-mode:settings': { title: { text: { html: '<script>alert(1)</script>' } } }
}), '文字必須是純文字');
assert.equal(core.validatePageSettings({
  'tv-edit-mode:settings': { title: { color: 12 } }
}), '樣式值必須是文字');
assert.equal(core.validatePageSettings({
  'tv-edit-mode:settings': { title: { text: '<b>不是 HTML</b>', fontWeight: '700' } },
  'tv-edit-mode:splits': { '0': { parts: ['label'] } }
}), '');
assert.equal(core.validatePageSettings({ 'tv-edit-mode:settings': { title: { light: '50,35,45' } } }), '');
assert.equal(core.validatePageSettings({ 'tv-edit-mode:settings': { title: { light: '200,35,45' } } }), '光源設定格式不正確');
assert.equal(core.validatePageSettings({ 'tv-edit-mode:splits': [] }), '切格格式不正確');

const resetKeys = core.collectResetKeys([
  'tv-edit-mode:settings', 'tv-edit-mode:splits', 'tv-edit-mode:controls:node-1',
  'tv-edit-mode:snapshots', 'tv-edit-mode:font-panel-rect', 'tv-edit-panel:rect',
  'baccarat_tv_settings_v1', 'baccarat_road_rounds_v1', 'settings-io:backup', 'tv-edit-mode-backup:2026'
]);
assert.equal(JSON.stringify(resetKeys), JSON.stringify([
  'tv-edit-mode:settings', 'tv-edit-mode:splits', 'tv-edit-mode:controls:node-1',
  'tv-edit-mode:snapshots', 'tv-edit-mode:font-panel-rect', 'tv-edit-panel:rect'
]));

const plan = core.planStorageReplace(
  ['tv-edit-mode:settings', 'tv-edit-mode:controls:title', 'tv-edit-panel:rect', 'baccarat_tv_settings_v1'],
  { 'tv-edit-mode:settings': { title: { color: 'blue' } }, 'baccarat_tv_settings_v1': { rounds: 9 } }
);
assert.equal(JSON.stringify(plan.write), JSON.stringify(['tv-edit-mode:settings']));
assert.equal(JSON.stringify(plan.remove), JSON.stringify(['tv-edit-mode:controls:title', 'tv-edit-panel:rect']));

assert.equal(core.decideClose(false, false), 'close');
assert.equal(core.decideClose(true, true), 'save-and-close');
assert.equal(core.decideClose(true, false), 'stay');
assert.equal(core.decideCancel(false, false), 'reload');
assert.equal(core.decideCancel(true, false), 'stay');
assert.equal(core.decideCancel(true, true), 'reload');
assert.equal(core.decideImport(true, false), 'stay');
assert.equal(core.decideImport(true, true), 'commit-import');
assert.equal(core.decideImport(false, false), 'commit-import');
assert.equal(core.decideVersionRestore(true, false), 'stay');
assert.equal(core.decideVersionRestore(true, true), 'preview');
assert.equal(core.decideVersionRestore(false, true), 'preview');

const saved = memoryStorage({
  'baccarat_tv_settings_v1': '{"rounds":3}',
  'tv-edit-mode:settings': JSON.stringify({ title: { color: 'red', fontWeight: '700', text: '舊' } })
});
let savedWrites = 0;
const realSet = saved.setItem;
saved.setItem = (key, value) => { savedWrites += 1; realSet.call(saved, key, value); };
const preview = core.previewEntries({
  settings: { title: { color: 'blue', fontWeight: '500', text: '目前預覽' }, cntB: { text: '77', fontSize: '19px' } },
  splits: { '2': { parts: ['count'] } },
  controls: { title: { '--edit-color': { hex: '#112233' } } },
  panel: { left: 3, top: 4, width: 320, height: 240 },
  snapshots: [{ id: 's1', name: '舊版' }]
});
const exported = coreBox.exportSettings({ download: false, prefixes: ['tv-edit'], storage: core.storageFromEntries(preview) });
assert.equal(savedWrites, 0);
assert.equal(exported.settings['tv-edit-mode:settings'].title.text, '目前預覽');
assert.equal(exported.settings['tv-edit-mode:settings'].title.fontWeight, '500');
assert.equal(exported.settings['tv-edit-mode:settings'].cntB.text, undefined);
assert.equal(exported.settings['tv-edit-mode:splits']['2'].parts[0], 'count');
assert.equal(exported.settings['tv-edit-panel:rect'].left, 3);
assert.equal(saved.getItem('tv-edit-mode:settings').includes('舊'), true);

const imported = {
  schema: 'antigravity-shared-components-settings',
  version: '1.0.0',
  settings: {
    'tv-edit-mode:settings': { title: { color: 'green', text: '匯入文字' }, cntT: { text: '5', fontWeight: '300' } },
    'tv-edit-mode:splits': { '0': { parts: ['label'] } },
    'baccarat_road_rounds_v1': [{ r: 'B' }]
  }
};
const importStore = memoryStorage({
  'baccarat_road_rounds_v1': '[{"r":"P"}]',
  'tv-edit-mode:settings': JSON.stringify({ title: { color: 'red', fontSize: '40px', fontWeight: '900', text: '舊標題' } }),
  'tv-edit-mode:controls:title': JSON.stringify({ v: 1, values: { '--edit-font-size': { num: 40, unit: 'px' } } }),
  'tv-edit-panel:rect': JSON.stringify({ left: 9, top: 9, width: 300, height: 220 })
});
const importPlan = core.planStorageReplace(Object.keys(importStore.dump), imported.settings);
const importResult = coreBox.importSettings(imported, importPlan.write, { storage: importStore, prefixes: ['tv-edit'] });
assert.equal(importResult.success, true);
importPlan.remove.forEach(key => importStore.removeItem(key));
assert.equal(importStore.getItem('baccarat_road_rounds_v1'), '[{"r":"P"}]');
assert.equal(importStore.getItem('tv-edit-mode:controls:title'), null);
assert.equal(importStore.getItem('tv-edit-panel:rect'), null);
const title = element({ id: 'title', text: '舊標題', style: { color: 'red', fontSize: '40px', fontWeight: '900' } });
const titleBase = core.captureBaseline(element({ id: 'title', text: '尊榮百家樂' }));
core.paintFromBaseline(title, titleBase, core.sanitizeSettings(importStore.dump['tv-edit-mode:settings'] && JSON.parse(importStore.getItem('tv-edit-mode:settings'))).title);
assert.equal(title.style.color, 'green');
assert.equal(title.style.fontSize, '');
assert.equal(title.style.fontWeight, '');
assert.equal(title.textContent, '匯入文字');
assert.equal(title.innerHTML, '<untouched>');

function computedStyle() {
  const style = { getPropertyValue: () => '' };
  style[Symbol.iterator] = function* () {};
  return style;
}
const versionStore = memoryStorage();
const versionBox = {
  console,
  crypto,
  localStorage: versionStore,
  document: { styleSheets: [], documentElement: { style: [] }, querySelector: () => ({ style: {} }) },
  getComputedStyle: computedStyle
};
versionBox.window = versionBox;
versionBox.globalThis = versionBox;
run(versionFile, versionBox);
const snapshots = new versionBox.VersionSnapshot({
  key: 'tv-edit-mode:snapshots',
  storage: versionStore,
  document: versionBox.document,
  selectors: ['.tv-table-board', '.tv-limit', '.tv-stats'],
  properties: ['color', 'font-weight']
});
const working = memoryStorage({ 'tv-edit-mode:settings': '{"title":{"color":"saved"}}' });
core.saveEditVersion(snapshots, '含內層', {
  settings: { nodeTitle: { text: '內層標題', fontWeight: '700', color: '#d4a64a' }, tvTopRoundCount: { text: '41', fontSize: '22px' } },
  splits: { '3': { dir: 'col', a: { parts: ['prefix', 'main'] }, b: { parts: ['count'] } } },
  controls: { nodeTitle: { '--edit-font-weight': { num: 700 } } }
});
assert.equal(working.getItem('tv-edit-mode:settings'), '{"title":{"color":"saved"}}');
const again = new versionBox.VersionSnapshot({ key: 'tv-edit-mode:snapshots', storage: versionStore, document: versionBox.document });
assert.equal(again.snapshots.length, 1);
assert.equal(core.classifySnapshot(again.snapshots[0]), 'edit');
assert.equal(JSON.stringify(again.snapshots[0].variables), '{}');
assert.equal(JSON.stringify(again.snapshots[0].elements), '{}');
assert.equal(again.snapshots[0].edit.settings.nodeTitle.text, '內層標題');
assert.equal(again.snapshots[0].edit.settings.nodeTitle.fontWeight, '700');
assert.equal(again.snapshots[0].edit.settings.tvTopRoundCount.text, undefined);
assert.equal(again.snapshots[0].edit.settings.tvTopRoundCount.fontSize, '22px');
assert.equal(again.snapshots[0].edit.splits['3'].dir, 'col');
const legacy = {
  id: 'legacy-1',
  name: '只有外層',
  createdAt: '2026-01-01T00:00:00.000Z',
  variables: {},
  elements: { '.tv-table-board': { color: 'rgb(1, 2, 3)', 'font-weight': '500' } }
};
versionStore.setItem('tv-edit-mode:snapshots', JSON.stringify([again.snapshots[0], legacy]));
const mixed = new versionBox.VersionSnapshot({ key: 'tv-edit-mode:snapshots', storage: versionStore, document: versionBox.document });
assert.equal(mixed.snapshots.length, 2);
assert.equal(core.classifySnapshot(mixed.snapshots.find(item => item.id === 'legacy-1')), 'legacy');

const source = fs.readFileSync(editFile, 'utf8');
const loadAt = source.indexOf('function restoreSavedAfterBaseline()');
const loadBody = source.slice(loadAt, source.indexOf('window.addEventListener(\'load\', restoreSavedAfterBaseline)'));
assert.ok(loadBody.indexOf('captureThenApply(elements, captureOriginal, applySaved)') > 0);
const exportAt = source.indexOf('tvEditExport');
assert.equal(source.slice(exportAt, exportAt + 420).includes('commitAll'), false);
assert.ok(source.includes('storageFromEntries(currentPreviewEntries())'));
assert.ok(source.includes('decideClose(dirty'));
assert.ok(source.includes('decideCancel(dirty'));
assert.ok(source.includes('decideImport(dirty'));
assert.ok(source.includes('decideVersionRestore(dirty'));
assert.ok(source.includes('saveEditVersion(snapshots, name, currentBundle())'));
assert.ok(source.includes('applyEditBundle(snap.edit, false)'));
assert.ok(source.includes('importSettings(data, plan.write'));
assert.ok(source.includes('collectResetKeys(storageKeys())'));
assert.equal(source.includes('innerHTML'), false);

// 測試雙螢幕工作台橋接（tv-font-bridge.js）：source/origin/nonce 驗證、結構化 CSS allowlist、LIVE 預覽、目標變更還原不污染、確定提交與取消還原
const bridgeListeners = [];
const bridgeBox = {
  console,
  crypto,
  window: {
    addEventListener(type, fn) { if (type === 'message') bridgeListeners.push(fn); },
    removeEventListener(type, fn) {
      if (type !== 'message') return;
      const idx = bridgeListeners.indexOf(fn);
      if (idx >= 0) bridgeListeners.splice(idx, 1);
    }
  }
};
bridgeBox.globalThis = bridgeBox;
bridgeBox.window.TvFontBridge = null;
run(bridgeFile, bridgeBox);
const bridge = bridgeBox.TvFontBridge || bridgeBox.window.TvFontBridge;
assert.ok(bridge, 'TvFontBridge 應載入成功');

assert.equal(bridge.getPageAdapter('tv').settingsKey, 'tv-edit-mode:settings');
const otherPage = bridge.registerPageAdapter({ pageId: 'vip', label: 'VIP 桌台', settingsKey: 'vip-edit-mode:settings' });
assert.equal(otherPage.settingsKey, 'vip-edit-mode:settings');
assert.notEqual(bridge.getPageAdapter('tv').settingsKey, bridge.getPageAdapter('vip').settingsKey);

assert.equal(bridge.sanitizeStylePayload({ styles: { color: 'url(https://evil.example)' } }).ok, false);
assert.equal(bridge.sanitizeStylePayload({ styles: { boxShadow: '0px 4px 8px expression(alert(1))' } }).ok, false);
assert.equal(bridge.sanitizeStylePayload({ family: '"MyUpload"', weight: 400, source: 'upload' }).ok, false);

function makeBridgeNode(id, initialStyle) {
  const attrs = new Map();
  return {
    id,
    isConnected: true,
    style: Object.assign({
      color: '', fontFamily: '', fontWeight: '', fontSize: '',
      borderWidth: '', borderStyle: '', borderColor: '', borderRadius: '', boxShadow: ''
    }, initialStyle || {}),
    hasAttribute(name) { return attrs.has(name); },
    setAttribute(name, val) { attrs.set(name, String(val)); },
    removeAttribute(name) { attrs.delete(name); },
    matches() { return false; }
  };
}

const nodeA = makeBridgeNode('title', { color: '#ffffff', fontSize: '20px', fontWeight: '400' });
const nodeB = makeBridgeNode('limit', { color: '#d4a64a', fontSize: '16px', fontWeight: '500' });
const statusEl = { textContent: '' };
const fakePopup = { closed: false, posted: [], postMessage(msg, origin) { this.posted.push({ msg, origin }); }, close() { this.closed = true; } };
const nonce = 'abcdef0123456789abcdef0123456789';
const committedRecords = {};

bridge.open({
  pageId: 'tv',
  nonce,
  win: fakePopup,
  skipPoll: true,
  skipNavigate: true,
  targetId: 'title',
  label: '尊榮百家樂',
  initialStyles: { color: '#ffffff', fontSize: '20px' },
  targets: [nodeA],
  statusEl,
  isCurrent: () => true,
  resolveTarget: (nextEl) => ({ targetId: nextEl.id, label: nextEl.id, styles: { color: nextEl.style.color } }),
  commit: (applied, committedTargets) => {
    committedTargets.forEach(n => { committedRecords[n.id] = core.readRecord(n); });
  }
});

const emitMessage = (event) => bridgeListeners.slice().forEach(fn => fn(event));

// 1. 錯誤的 origin / source / nonce 必須被拒絕
emitMessage({
  source: fakePopup,
  origin: 'http://evil.example',
  data: { kind: 'tv-font-bridge', nonce, seq: 1, action: 'preview', styles: { color: '#ff0000' } }
});
assert.equal(nodeA.style.color, '#ffffff');

emitMessage({
  source: {},
  origin: 'http://127.0.0.1:5199',
  data: { kind: 'tv-font-bridge', nonce, seq: 1, action: 'preview', styles: { color: '#ff0000' } }
});
assert.equal(nodeA.style.color, '#ffffff');

// 2. 合法 LIVE 預覽（字色、字型、大小、邊框、陰影），此時尚未寫入 committedRecords
emitMessage({
  source: fakePopup,
  origin: 'http://127.0.0.1:5199',
  data: {
    kind: 'tv-font-bridge',
    nonce,
    seq: 1,
    targetId: 'title',
    action: 'preview',
    styles: {
      color: '#112233',
      fontFamily: '"Noto Serif TC", serif',
      fontWeight: 700,
      fontSize: '32px',
      borderWidth: '2px',
      borderStyle: 'solid',
      borderColor: '#d4a64a',
      borderRadius: '6px',
      boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.5)'
    }
  }
});
assert.equal(nodeA.style.color, '#112233');
assert.equal(nodeA.hasAttribute('data-tv-edit-color'), true);
assert.equal(nodeA.style.fontSize, '32px');
assert.equal(nodeA.style.borderWidth, '2px');
assert.equal(nodeA.style.borderRadius, '6px');
assert.equal(committedRecords.title, undefined);

// 3. 未確定即切換目標（nodeA -> nodeB）：nodeA 必須立即還原，且過期的 nodeA 預覽訊息不可污染 nodeB
bridge.noteSelection(nodeB, [nodeB]);
assert.equal(nodeA.style.color, '#ffffff');
assert.equal(nodeA.style.fontSize, '20px');
assert.equal(nodeB.style.color, '#d4a64a');

emitMessage({
  source: fakePopup,
  origin: 'http://127.0.0.1:5199',
  data: {
    kind: 'tv-font-bridge',
    nonce,
    seq: 2,
    targetId: 'title',
    action: 'preview',
    styles: { color: '#990000', fontSize: '48px' }
  }
});
assert.equal(nodeB.style.color, '#d4a64a', '過期目標的預覽訊息不可污染新目標');

// 4. 對新目標 nodeB 進行預覽並按「確定」提交，驗證真正寫入設定記錄；再測試取消還原
emitMessage({
  source: fakePopup,
  origin: 'http://127.0.0.1:5199',
  data: {
    kind: 'tv-font-bridge',
    nonce,
    seq: 3,
    targetId: 'limit',
    action: 'commit',
    keepOpen: true,
    styles: {
      color: '#224466',
      fontSize: '24px',
      borderWidth: '3px',
      borderStyle: 'dashed',
      borderColor: '#eeddcc',
      borderRadius: '10px',
      boxShadow: '0px 2px 8px 0px rgba(0, 0, 0, 0.4)'
    }
  }
});
assert.equal(nodeB.style.color, '#224466');
assert.equal(committedRecords.limit.color, '#224466');
assert.equal(committedRecords.limit.fontSize, '24px');
assert.equal(committedRecords.limit.borderStyle, 'dashed');
assert.equal(committedRecords.limit.boxShadow, '0px 2px 8px 0px rgba(0, 0, 0, 0.4)');

// 在已確定後再預覽新顏色但按取消，應還原到上次確定的狀態 (#224466)
emitMessage({
  source: fakePopup,
  origin: 'http://127.0.0.1:5199',
  data: {
    kind: 'tv-font-bridge',
    nonce,
    seq: 4,
    targetId: 'limit',
    action: 'preview',
    styles: { color: '#ff00ff' }
  }
});
assert.equal(nodeB.style.color, '#ff00ff');
emitMessage({
  source: fakePopup,
  origin: 'http://127.0.0.1:5199',
  data: {
    kind: 'tv-font-bridge',
    nonce,
     action: 'cancel',
    targetId: 'limit',
    keepOpen: false
  }
});
assert.equal(nodeB.style.color, '#224466');

console.log('tv-edit-mode regressions ok');
