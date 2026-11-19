(function (root) {
  'use strict';

  const STYLE_PROPS = ['background', 'backgroundColor', 'borderColor', 'borderWidth', 'borderStyle', 'borderRadius', 'boxShadow', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing'];
  const LIVE_TEXT_IDS = new Set(['tvTopRoundCount', 'totalCount', 'cntB', 'cntP', 'cntT', 'cntBP', 'cntPP', 'cntL6', 'cntST', 'cntBT', 'cntL72', 'cntL73', 'cntS74', 'cntS75', 'cntS76']);
  const PAGE_PREFIX = 'tv-edit-mode:';
  const PANEL_RECT_KEY = 'tv-edit-panel:rect';
  const SETTINGS_KEY = 'tv-edit-mode:settings';
  const SPLITS_KEY = 'tv-edit-mode:splits';
  const CONTROLS_PREFIX = 'tv-edit-mode:controls:';
  const SNAPSHOT_KEY = 'tv-edit-mode:snapshots';
  const FONT_PANEL_KEY = 'tv-edit-mode:font-panel-rect';

  function isPageEditKey(key) {
    return typeof key === 'string' && (key.indexOf(PAGE_PREFIX) === 0 || key === PANEL_RECT_KEY);
  }
  function isLiveTextId(id) { return LIVE_TEXT_IDS.has(id); }
  function isEditableText(el) {
    if (!el || (el.children && el.children.length)) return false;
    if (isLiveTextId(el.id)) return false;
    if (typeof el.matches === 'function' && el.matches('input,button,select,textarea')) return false;
    return true;
  }
  function isPlain(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
  function forbiddenKey(key) {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
  }
  function validLight(value) {
    if (typeof value !== 'string' || !/^\d{1,3},\d{1,3},\d{1,3}$/.test(value)) return false;
    return value.split(',').every(n => Number(n) <= 100);
  }
  function clearLight(el) {
    if (!el || !el.dataset || !el.dataset.tvEditLight) return;
    el.style.background = el.dataset.tvEditBaseBackground || '';
    delete el.dataset.tvEditLight;
    delete el.dataset.tvEditBaseBackground;
  }
  function paintLight(el, value, base) {
    if (!validLight(value)) return;
    if (base == null) base = el.dataset.tvEditLight ? el.dataset.tvEditBaseBackground : el.style.background;
    el.style.background = base || '';
    const image = getComputedStyle(el).backgroundImage;
    const [x, y, strength] = value.split(',').map(Number);
    const glow = 'radial-gradient(ellipse at ' + x + '% ' + y + '%, rgba(255, 235, 190, ' + (strength * .006).toFixed(3) + ') 0%, rgba(255, 235, 190, 0) 72%)';
    el.style.backgroundImage = glow + (image && image !== 'none' ? ', ' + image : '');
    el.dataset.tvEditBaseBackground = base || '';
    el.dataset.tvEditLight = value;
  }
  function emptyStyle() {
    const style = {};
    STYLE_PROPS.forEach(prop => { style[prop] = ''; });
    return style;
  }
  function syncEditColorAttr(el) {
    if (!el || !el.style) return;
    if (el.style.color) {
      if (typeof el.setAttribute === 'function') el.setAttribute('data-tv-edit-color', '');
    } else if (typeof el.removeAttribute === 'function') {
      el.removeAttribute('data-tv-edit-color');
    }
  }
  function captureBaseline(el) {
    const value = emptyStyle();
    STYLE_PROPS.forEach(prop => { value[prop] = (el.style && el.style[prop]) || ''; });
    value.text = el.textContent == null ? '' : String(el.textContent);
    return value;
  }
  function writeBaseline(el, baseline) {
    const base = baseline || emptyStyle();
    clearLight(el);
    STYLE_PROPS.forEach(prop => { el.style[prop] = base[prop] || ''; });
    if (isEditableText(el) && base.text != null) el.textContent = String(base.text);
    syncEditColorAttr(el);
  }
  function applyRecord(el, saved) {
    if (!isPlain(saved)) return;
    clearLight(el);
    const background = typeof saved.background === 'string' && saved.background ? saved.background : (typeof saved.backgroundColor === 'string' ? saved.backgroundColor : '');
    STYLE_PROPS.forEach(prop => {
      if (prop === 'background' || prop === 'backgroundColor') return;
      if (typeof saved[prop] === 'string') el.style[prop] = saved[prop];
    });
    if (background) {
      el.style.backgroundColor = '';
      el.style.background = background;
    } else {
      if (typeof saved.background === 'string') el.style.background = saved.background;
      if (typeof saved.backgroundColor === 'string') el.style.backgroundColor = saved.backgroundColor;
    }
    if (validLight(saved.light)) paintLight(el, saved.light, background || '');
    if (typeof saved.text === 'string' && isEditableText(el)) el.textContent = saved.text;
    syncEditColorAttr(el);
  }
  function paintFromBaseline(el, baseline, saved) {
    writeBaseline(el, baseline);
    applyRecord(el, saved);
  }
  function readRecord(el) {
    const saved = {};
    STYLE_PROPS.forEach(prop => {
      if (prop === 'backgroundColor' && el.style && el.style.background) return;
      if (el.style && el.style[prop]) saved[prop] = el.style[prop];
    });
    if (el.dataset && validLight(el.dataset.tvEditLight)) {
      if (el.dataset.tvEditBaseBackground) saved.background = el.dataset.tvEditBaseBackground;
      else delete saved.background;
      saved.light = el.dataset.tvEditLight;
    }
    if (isEditableText(el)) saved.text = el.textContent == null ? '' : String(el.textContent);
    return saved;
  }
  function sanitizeSettings(settings) {
    const out = {};
    if (!isPlain(settings)) return out;
    Object.keys(settings).forEach(id => {
      if (forbiddenKey(id)) return;
      const item = settings[id];
      if (!isPlain(item)) return;
      const clean = {};
      STYLE_PROPS.forEach(prop => {
        if (typeof item[prop] === 'string' && item[prop]) clean[prop] = item[prop];
      });
      if (validLight(item.light)) clean.light = item.light;
      if (typeof item.text === 'string' && !isLiveTextId(id)) clean.text = item.text;
      if (Object.keys(clean).length) out[id] = clean;
    });
    return out;
  }
  function makeVersionBundle(input) {
    const src = input || {};
    return {
      v: 1,
      settings: sanitizeSettings(src.settings),
      splits: isPlain(src.splits) ? JSON.parse(JSON.stringify(src.splits)) : {},
      controls: isPlain(src.controls) ? JSON.parse(JSON.stringify(src.controls)) : {},
      panel: isPlain(src.panel) ? JSON.parse(JSON.stringify(src.panel)) : null,
      fontPanel: isPlain(src.fontPanel) ? JSON.parse(JSON.stringify(src.fontPanel)) : null
    };
  }
  function classifySnapshot(snap) {
    if (!isPlain(snap)) return 'invalid';
    if (snap.edit && snap.edit.v === 1 && isPlain(snap.edit.settings)) return 'edit';
    if (isPlain(snap.elements)) return 'legacy';
    return 'invalid';
  }
  function attachEditBundle(snapshot, bundle) {
    snapshot.variables = {};
    snapshot.elements = {};
    snapshot.edit = makeVersionBundle(bundle);
    return snapshot;
  }
  function saveEditVersion(store, name, bundle) {
    const snap = store.capture(name);
    attachEditBundle(snap, bundle);
    store.save();
    return snap;
  }
  function collectResetKeys(keys) {
    return (keys || []).filter(isPageEditKey);
  }
  function planStorageReplace(existingKeys, importedSettings) {
    const write = Object.keys(importedSettings || {}).filter(isPageEditKey);
    const keep = new Set(write);
    const remove = (existingKeys || []).filter(key => isPageEditKey(key) && !keep.has(key));
    return { write: write, remove: remove };
  }
  function validatePageSettings(settingsRoot) {
    if (!isPlain(settingsRoot)) return '格式錯誤：缺少 settings';
    const bag = settingsRoot[SETTINGS_KEY];
    if (bag != null) {
      if (!isPlain(bag)) return '編輯設定格式不正確';
      for (const id of Object.keys(bag)) {
        if (forbiddenKey(id)) return '編輯設定格式不正確';
        const item = bag[id];
        if (!isPlain(item)) return '編輯設定格式不正確';
        for (const key of Object.keys(item)) {
          if (forbiddenKey(key)) return '編輯設定格式不正確';
          const value = item[key];
          if (key === 'text') {
            if (typeof value !== 'string') return '文字必須是純文字';
          } else if (key === 'light') {
            if (!validLight(value)) return '光源設定格式不正確';
          } else if (STYLE_PROPS.indexOf(key) < 0) {
            return '含有不支援的樣式欄位';
          } else if (typeof value !== 'string') {
            return '樣式值必須是文字';
          }
        }
      }
    }
    if (settingsRoot[SPLITS_KEY] != null && !isPlain(settingsRoot[SPLITS_KEY])) return '切格格式不正確';
    return '';
  }
  function previewEntries(state) {
    const src = state || {};
    const entries = [[SETTINGS_KEY, JSON.stringify(sanitizeSettings(src.settings))], [SPLITS_KEY, JSON.stringify(isPlain(src.splits) ? src.splits : {})]];
    const controls = isPlain(src.controls) ? src.controls : {};
    Object.keys(controls).forEach(id => {
      if (forbiddenKey(id) || !isPlain(controls[id])) return;
      entries.push([CONTROLS_PREFIX + id, JSON.stringify({ v: 1, values: controls[id] })]);
    });
    if (isPlain(src.fontPanel)) entries.push([FONT_PANEL_KEY, JSON.stringify(src.fontPanel)]);
    if (isPlain(src.panel)) entries.push([PANEL_RECT_KEY, JSON.stringify(src.panel)]);
    if (Array.isArray(src.snapshots)) entries.push([SNAPSHOT_KEY, JSON.stringify(src.snapshots)]);
    return entries;
  }
  function storageFromEntries(entries) {
    const map = new Map(entries || []);
    const keys = [...map.keys()];
    return {
      get length() { return keys.length; },
      key(index) { return index >= 0 && index < keys.length ? keys[index] : null; },
      getItem(key) { return map.has(key) ? String(map.get(key)) : null; }
    };
  }
  function decideClose(dirty, accepted) {
    if (!dirty) return 'close';
    return accepted ? 'save-and-close' : 'stay';
  }
  function decideCancel(dirty, accepted) {
    if (!dirty) return 'reload';
    return accepted ? 'reload' : 'stay';
  }
  function decideImport(dirty, accepted) {
    if (dirty && !accepted) return 'stay';
    return 'commit-import';
  }
  function decideVersionRestore(dirty, accepted) {
    if (dirty && !accepted) return 'stay';
    return 'preview';
  }
  function captureThenApply(elements, capture, apply) {
    (elements || []).forEach(capture);
    (elements || []).forEach(apply);
  }

  root.TvEditCore = {
    STYLE_PROPS, LIVE_TEXT_IDS, PAGE_PREFIX, PANEL_RECT_KEY, SETTINGS_KEY, SPLITS_KEY, CONTROLS_PREFIX, SNAPSHOT_KEY, FONT_PANEL_KEY,
    isPageEditKey, isLiveTextId, isEditableText, syncEditColorAttr, captureBaseline, writeBaseline, applyRecord, paintFromBaseline, readRecord,
    sanitizeSettings, makeVersionBundle, classifySnapshot, attachEditBundle, saveEditVersion, collectResetKeys, planStorageReplace,
    validatePageSettings, previewEntries, storageFromEntries, decideClose, decideCancel, decideImport, decideVersionRestore, captureThenApply
  };

  if (typeof document === 'undefined') return;

  let KEY = SETTINGS_KEY;
  const ROOT = '.tv-table-board, .tv-table-board *, .tv-limit, .tv-limit *, .tv-stats, .tv-stats *';
  const app = document.querySelector('.tv-app');
  const toggle = document.getElementById('tvEditToggle');
  const panel = document.getElementById('tvEditPanel');
  const panelHead = document.getElementById('tvEditPanelHead');
  const controlsMount = document.getElementById('tvEditControls');
  const textInput = document.getElementById('tvEditText');
  const textNote = document.getElementById('tvEditTextNote');
  const backgroundInput = document.getElementById('tvEditBackground');
  const solidOptions = document.getElementById('tvEditSolidOptions');
  const solidColor = document.getElementById('tvEditSolidColor');
  const bgSolidBtn = document.getElementById('tvEditBgSolid');
  const bgGradientBtn = document.getElementById('tvEditBgGradient');
  const gradientOptions = document.getElementById('tvEditGradientOptions');
  const gradientStart = document.getElementById('tvEditGradientStart');
  const gradientEnd = document.getElementById('tvEditGradientEnd');
  const undoBtn = panel ? panel.querySelector('#tvEditUndo') : null;
  const redoBtn = panel ? panel.querySelector('#tvEditRedo') : null;
  const selectUpBtn = panel ? panel.querySelector('#tvEditSelectUp') : null;
  const selectDownBtn = panel ? panel.querySelector('#tvEditSelectDown') : null;
  let gradientAngleValue = '180';
  const lightEnabled = document.getElementById('tvEditLightEnabled');
  const lightOptions = document.getElementById('tvEditLightOptions');
  const lightX = document.getElementById('tvEditLightX');
  const lightY = document.getElementById('tvEditLightY');
  const lightStrength = document.getElementById('tvEditLightStrength');
  const label = document.getElementById('tvEditSelection');
  const status = document.getElementById('tvEditStatus');
  const versionsHost = panel ? panel.querySelector('#tvEditVersions') : null;
  const popoutBtn = panel ? panel.querySelector('#tvEditPopout') : null;
  const panelHome = panel ? { parent: panel.parentNode, next: panel.nextSibling } : null;
  if (!app || !toggle || !panel || !root.CssControls) return;

  let active = false;
  let selected = null;
  let group = [];
  let descendStack = [];
  let layerNav = false;
  let cssPanel = null;
  let editFontApi = null;
  let weightSyncLock = false;
  let placeToken = 0;
  const fontWeightBound = new WeakSet();
  let drag = null;
  let settings = {};
  const originals = new WeakMap();
  const suppliedBorder = new WeakSet();
  const tombstones = new Set();
  let stagedControls = {};
  let stagedPanelRect = null;
  let panelRectRollback;
  // PanelMemory 拖曳會直接寫 PANEL_RECT_KEY，這裡記上次已儲存的原始字串，放棄時才寫回。
  let savedPanelRect = null;
  try { savedPanelRect = localStorage.getItem(PANEL_RECT_KEY); } catch (_) { savedPanelRect = null; }
  function isNodeId(id) { return typeof id === 'string' && /^node-\d+$/.test(id); }
  function blockAnchor(el) {
    if (!el || !el.classList) return '';
    if (el.classList.contains('tv-table-board')) return 'tv-table-board';
    if (el.classList.contains('tv-limit')) return 'tv-limit';
    if (el.classList.contains('tv-stats')) return 'tv-stats';
    return '';
  }
  function nthOfType(el) {
    let count = 1, sib = el.previousElementSibling, tag = el.tagName;
    while (sib) { if (sib.tagName === tag) count += 1; sib = sib.previousElementSibling; }
    return count;
  }
  function joinAnchor(anchor, segments) {
    const path = segments.slice().reverse().join('/');
    return path ? anchor + '/' + path : anchor;
  }
  function stableId(el) {
    const segments = [];
    let node = el;
    while (node && node.tagName) {
      if (node !== el && node.id) return joinAnchor(node.tagName.toLowerCase() + ':' + node.id, segments);
      const block = blockAnchor(node);
      if (block && node !== el) return joinAnchor(block, segments);
      if (block && node === el) return block;
      segments.push(node.tagName.toLowerCase() + ':' + nthOfType(node));
      node = node.parentElement;
    }
    return segments.slice().reverse().join('/');
  }
  function remapBag(bag, idMap) {
    if (!isPlain(bag)) return null;
    const out = {}, claimed = Object.create(null);
    let changed = false;
    Object.keys(bag).forEach(id => {
      if (forbiddenKey(id)) return;
      let target = id;
      if (isNodeId(id)) {
        const nextId = idMap.get(id);
        if (nextId && nextId !== id && !forbiddenKey(nextId) && !Object.prototype.hasOwnProperty.call(bag, nextId) && !claimed[nextId]) {
          target = nextId;
          changed = true;
        }
      }
      if (claimed[target]) return;
      claimed[target] = 1;
      out[target] = bag[id];
    });
    return changed ? out : null;
  }
  function migrateNodeIds() {
    const settingsRaw = localStorage.getItem(SETTINGS_KEY);
    let settingsObj = {};
    try { const parsed = JSON.parse(settingsRaw || '{}'); if (isPlain(parsed)) settingsObj = parsed; } catch (_) { settingsObj = {}; }
    const controlKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.indexOf(CONTROLS_PREFIX) === 0) controlKeys.push(key);
    }
    const controlRaw = Object.create(null);
    controlKeys.forEach(key => { controlRaw[key] = localStorage.getItem(key); });
    const snapRaw = localStorage.getItem(SNAPSHOT_KEY);
    let snaps = null;
    try { const parsed = JSON.parse(snapRaw || 'null'); if (Array.isArray(parsed)) snaps = parsed; } catch (_) { snaps = null; }
    const snapHasNode = (snaps || []).some(snap => isPlain(snap) && isPlain(snap.edit) && (
      (isPlain(snap.edit.settings) && Object.keys(snap.edit.settings).some(isNodeId)) ||
      (isPlain(snap.edit.controls) && Object.keys(snap.edit.controls).some(isNodeId))
    ));
    if (!Object.keys(settingsObj).some(isNodeId) && !controlKeys.some(key => isNodeId(key.slice(CONTROLS_PREFIX.length))) && !snapHasNode) return;
    const idMap = new Map();
    document.querySelectorAll(ROOT).forEach((el, index) => {
      if (!el || el.id || (el.dataset && el.dataset.tvEditId) || (el.classList && el.classList.contains('cs-leaf'))) return;
      const nextId = stableId(el);
      if (!nextId || forbiddenKey(nextId) || nextId === 'node-' + index) return;
      idMap.set('node-' + index, nextId);
    });
    const nextSettings = remapBag(settingsObj, idMap);
    const reserved = Object.create(null), controlMoves = [];
    controlKeys.forEach(key => { reserved[key] = 1; });
    controlKeys.forEach(key => {
      const oldId = key.slice(CONTROLS_PREFIX.length);
      if (!isNodeId(oldId)) return;
      const nextId = idMap.get(oldId);
      if (!nextId || forbiddenKey(nextId)) return;
      const nextKey = CONTROLS_PREFIX + nextId;
      if (reserved[nextKey] || controlRaw[key] == null) return;
      reserved[nextKey] = 1;
      controlMoves.push({ from: key, to: nextKey, raw: controlRaw[key] });
    });
    let nextSnaps = null;
    if (snaps) {
      nextSnaps = snaps.map(snap => {
        if (!isPlain(snap) || !isPlain(snap.edit)) return snap;
        const settingsBag = remapBag(snap.edit.settings, idMap);
        const controlsBag = remapBag(snap.edit.controls, idMap);
        if (!settingsBag && !controlsBag) return snap;
        const edit = Object.assign({}, snap.edit);
        if (settingsBag) edit.settings = settingsBag;
        if (controlsBag) edit.controls = controlsBag;
        return Object.assign({}, snap, { edit: edit });
      });
      if (nextSnaps.every((snap, index) => snap === snaps[index])) nextSnaps = null;
    }
    if (!nextSettings && !controlMoves.length && !nextSnaps) return;
    const backup = {};
    backup[SETTINGS_KEY] = settingsRaw;
    controlKeys.forEach(key => { backup[key] = controlRaw[key]; });
    const backupKey = 'tv-edit-mode-backup:node-migrate:' + new Date().toISOString();
    const written = [];
    try {
      localStorage.setItem(backupKey, JSON.stringify(backup));
      if (nextSettings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
      controlMoves.forEach(move => { localStorage.setItem(move.to, move.raw); written.push(move.to); localStorage.removeItem(move.from); });
      if (nextSnaps) localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(nextSnaps));
    } catch (error) {
      let rolledBack = false;
      try {
        if (settingsRaw == null) localStorage.removeItem(SETTINGS_KEY); else localStorage.setItem(SETTINGS_KEY, settingsRaw);
        written.forEach(key => localStorage.removeItem(key));
        controlKeys.forEach(key => { if (backup[key] == null) localStorage.removeItem(key); else localStorage.setItem(key, backup[key]); });
        if (snapRaw == null) localStorage.removeItem(SNAPSHOT_KEY); else localStorage.setItem(SNAPSHOT_KEY, snapRaw);
        rolledBack = true;
      } catch (_) {}
      if (rolledBack) { try { localStorage.removeItem(backupKey); } catch (_) {} }
      throw error;
    }
  }
  function assignEditIds(legacy) {
    document.querySelectorAll(ROOT).forEach((el, index) => {
      if (el.dataset.tvEditId || (el.classList && el.classList.contains('cs-leaf'))) return;
      el.dataset.tvEditId = el.id || (legacy ? 'node-' + index : stableId(el));
    });
  }
  let legacyNodeIds = false;
  try { migrateNodeIds(); }
  catch (error) { console.warn('tv-edit-mode 代號搬移失敗', error); legacyNodeIds = true; }
  assignEditIds(legacyNodeIds);
  try { settings = sanitizeSettings(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { settings = {}; }
  const snapshots = new root.VersionSnapshot({
    key: SNAPSHOT_KEY,
    selectors: ['.tv-table-board', '.tv-limit', '.tv-stats'],
    properties: ['color', 'background-color', 'border-color', 'border-width', 'border-style', 'border-radius', 'box-shadow', 'font-family', 'font-size', 'font-weight', 'letter-spacing']
  });

  let dirty = false;
  let savedSig = '';
  let historyLock = false;
  let historyMute = 0;
  const undoStack = [];
  const redoStack = [];
  let pendingBefore = null;
  let pendingKind = '';
  let textBefore = null;
  let textTimer = 0;
  let fontBefore = null;
  let colorBefore = null;
  function persist() { if (!historyLock) dirty = true; }
  function fontRectNow() {
    if (isPlain(fpPending)) return fpPending;
    const stored = readJson(FP_KEY);
    return isPlain(stored) ? stored : null;
  }
  function stateSignature() {
    return JSON.stringify({
      settings: sanitizeSettings(settings),
      splits: currentSplits(),
      fp: fontRectNow()
    });
  }
  function captureSnap() {
    return {
      settings: sanitizeSettings(settings),
      stagedControls: JSON.parse(JSON.stringify(stagedControls || {})),
      tombstones: [...tombstones].sort(),
      splits: currentSplits(),
      fpPending: isPlain(fpPending) ? JSON.parse(JSON.stringify(fpPending)) : null
    };
  }
  function snapKey(snap) {
    return JSON.stringify(snap);
  }
  function updateHistoryButtons() {
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }
  function clearHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    pendingBefore = null;
    pendingKind = '';
    textBefore = null;
    fontBefore = null;
    colorBefore = null;
    if (textTimer) { clearTimeout(textTimer); textTimer = 0; }
    updateHistoryButtons();
  }
  function commitSnap(before) {
    if (historyMute || historyLock || !before || !active) return;
    const now = captureSnap();
    const beforeKey = snapKey(before);
    if (beforeKey === snapKey(now)) return;
    const last = undoStack.length ? undoStack[undoStack.length - 1] : null;
    if (last && snapKey(last) === beforeKey) return;
    colorBefore = null;
    undoStack.push(before);
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    updateHistoryButtons();
  }
  function armHistory(kind) {
    if (historyMute || historyLock || !active || pendingBefore) return;
    pendingBefore = captureSnap();
    pendingKind = kind || 'edit';
  }
  function flushHistory() {
    if (!pendingBefore) return;
    const before = pendingBefore;
    pendingBefore = null;
    pendingKind = '';
    commitSnap(before);
  }
  function flushText() {
    if (textTimer) { clearTimeout(textTimer); textTimer = 0; }
    if (!textBefore) return;
    const before = textBefore;
    textBefore = null;
    commitSnap(before);
  }
  function flushFont() {
    if (!fontBefore) return;
    const before = fontBefore;
    fontBefore = null;
    commitSnap(before);
  }
  function applySnap(snap) {
    historyLock = true;
    try {
      const next = makeVersionBundle({
        settings: snap.settings,
        splits: snap.splits,
        controls: snap.stagedControls,
        fontPanel: snap.fpPending
      });
      settings = next.settings;
      fpPending = next.fontPanel;
      if (root.CssControls && root.CssControls.discardPending) root.CssControls.discardPending(CONTROLS_PREFIX);
      tombstones.clear();
      (snap.tombstones || []).forEach(key => tombstones.add(key));
      stagedControls = {};
      Object.keys(next.controls || {}).forEach(id => { if (isPlain(next.controls[id])) stagedControls[id] = next.controls[id]; });
      repaint(next.splits, false);
      fontRoots().forEach(placeFontPicker);
      dirty = stateSignature() !== savedSig;
    } finally {
      historyLock = false;
    }
    updateHistoryButtons();
    updateLayerButtons();
  }
  function undoHistory() {
    flushText();
    flushFont();
    flushHistory();
    if (!undoStack.length) return;
    const current = captureSnap();
    const prev = undoStack.pop();
    redoStack.push(current);
    applySnap(prev);
    writeSettings();
    status.textContent = '已復原';
  }
  function redoHistory() {
    flushText();
    flushFont();
    flushHistory();
    if (!redoStack.length) return;
    const current = captureSnap();
    const next = redoStack.pop();
    undoStack.push(current);
    applySnap(next);
    writeSettings();
    status.textContent = '已重做';
  }
  function writeSettings() { try { localStorage.setItem(KEY, JSON.stringify(sanitizeSettings(settings))); } catch (_) {} }
  function storageKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key) keys.push(key); }
    return keys;
  }
  function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } }
  function commitAll() {
    settings = sanitizeSettings(settings);
    writeSettings();
    Object.keys(stagedControls).forEach(id => {
      if (!isPlain(stagedControls[id])) return;
      try { localStorage.setItem(CONTROLS_PREFIX + id, JSON.stringify({ v: 1, values: stagedControls[id] })); } catch (_) {}
    });
    if (root.CssControls.commitPending) root.CssControls.commitPending(CONTROLS_PREFIX);
    tombstones.forEach(key => localStorage.removeItem(key));
    tombstones.clear();
    stagedControls = {};
    if (fpPending) { try { localStorage.setItem(FONT_PANEL_KEY, JSON.stringify(fpPending)); } catch (_) {} fpPending = null; }
    if (stagedPanelRect) { try { localStorage.setItem(PANEL_RECT_KEY, JSON.stringify(stagedPanelRect)); } catch (_) {} stagedPanelRect = null; }
    panelRectRollback = undefined;
    if (splitter && splitter.commit) splitter.commit();
    try { savedPanelRect = localStorage.getItem(PANEL_RECT_KEY); } catch (_) {}
    dirty = false;
    savedSig = stateSignature();
  }
  function rollbackPanelRect() {
    if (panelRectRollback === undefined) return;
    if (panelRectRollback == null) localStorage.removeItem(PANEL_RECT_KEY);
    else localStorage.setItem(PANEL_RECT_KEY, panelRectRollback);
    panelRectRollback = undefined;
  }
  function discardAndReload() {
    try {
      if (savedPanelRect == null) localStorage.removeItem(PANEL_RECT_KEY);
      else localStorage.setItem(PANEL_RECT_KEY, savedPanelRect);
    } catch (_) {}
    panelRectRollback = undefined;
    dirty = false;
    clearHistory();
    location.reload();
  }
  function getId(el) {
    if (!el.dataset.tvEditId && !(el.classList && el.classList.contains('cs-leaf'))) {
      el.dataset.tvEditId = el.id || (legacyNodeIds ? 'node-' + [...document.querySelectorAll(ROOT)].indexOf(el) : stableId(el));
    }
    return el.dataset.tvEditId;
  }
  function computed(el) {
    const view = (el && el.ownerDocument && el.ownerDocument.defaultView) || window;
    return view.getComputedStyle(el);
  }
  function hexColor(value) {
    const raw = String(value || '').trim();
    if (/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(raw)) return raw.toUpperCase();
    if (/^#[\da-f]{3}$/i.test(raw)) return '#' + [...raw.slice(1)].map(c => c + c).join('').toUpperCase();
    const match = raw.match(/^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
    if (!match) return raw;
    const hex = '#' + match.slice(1, 4).map(n => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0')).join('').toUpperCase();
    return match[4] == null || Number(match[4]) >= 1 ? hex : hex + Math.round(Number(match[4]) * 255).toString(16).padStart(2, '0').toUpperCase();
  }
  function isHexColor(value) {
    return /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(String(value || '').trim());
  }
  function readSimpleGradient(value) {
    const raw = String(value || '').trim();
    if (!/^linear-gradient\(/i.test(raw)) return null;
    const body = raw.replace(/^linear-gradient\(/i, '').replace(/\)\s*$/, '');
    let angle = '180';
    let rest = body;
    const angleMatch = body.match(/^\s*(?:(\d+(?:\.\d+)?)deg|to\s+(?:top|bottom|left|right)(?:\s+(?:top|bottom|left|right))?)\s*,\s*/i);
    if (angleMatch) {
      const token = angleMatch[0].toLowerCase();
      if (angleMatch[1]) angle = String(Math.round(Number(angleMatch[1])));
      else if (token.indexOf('top') >= 0 && token.indexOf('right') >= 0) angle = '45';
      else if (token.indexOf('bottom') >= 0 && token.indexOf('right') >= 0) angle = '135';
      else if (token.indexOf('top') >= 0 && token.indexOf('left') >= 0) angle = '315';
      else if (token.indexOf('bottom') >= 0 && token.indexOf('left') >= 0) angle = '225';
      else if (token.indexOf('top') >= 0) angle = '0';
      else if (token.indexOf('right') >= 0) angle = '90';
      else if (token.indexOf('left') >= 0) angle = '270';
      rest = body.slice(angleMatch[0].length);
    }
    const found = [...rest.matchAll(/(#[\da-f]{3,8}|rgba?\([^)]+\))(?:\s+-?\d+(?:\.\d+)?%)?/gi)];
    if (found.length < 2) return null;
    const start = hexColor(found[0][1]);
    const end = hexColor(found[found.length - 1][1]);
    if (!isHexColor(start) || !isHexColor(end)) return null;
    return { angle: angle, start: start, end: end };
  }
  function backgroundSource(el) {
    if (!el) return '';
    if (el.dataset && el.dataset.tvEditLight) return el.dataset.tvEditBaseBackground || '';
    const shorthand = el.style.background || '';
    if (/gradient\(|url\(/i.test(shorthand)) return shorthand;
    const image = el.style.backgroundImage || '';
    if (image && image !== 'none' && /gradient\(/i.test(image)) return image;
    if (el.style.backgroundColor) return el.style.backgroundColor;
    if (shorthand) return shorthand;
    const view = computed(el);
    if (view.backgroundImage && view.backgroundImage !== 'none' && /gradient\(/i.test(view.backgroundImage)) return view.backgroundImage;
    return view.backgroundColor || '';
  }
  function writeBackground(el, value) {
    const light = el.dataset.tvEditLight;
    if (light) clearLight(el);
    el.style.backgroundColor = '';
    el.style.background = value || '';
    if (light) paintLight(el, light, value || '');
  }
  function backgroundMode(el) {
    const raw = backgroundSource(el);
    if (readSimpleGradient(raw) || /gradient\(|url\(/i.test(String(raw || ''))) return 'gradient';
    return 'solid';
  }
  function setBgMode(mode) {
    const gradient = mode === 'gradient';
    if (bgSolidBtn) bgSolidBtn.setAttribute('aria-pressed', gradient ? 'false' : 'true');
    if (bgGradientBtn) bgGradientBtn.setAttribute('aria-pressed', gradient ? 'true' : 'false');
    if (solidOptions) solidOptions.hidden = gradient;
    if (gradientOptions) gradientOptions.hidden = !gradient;
  }
  function setGradientAngle(angle) {
    const known = ['0', '45', '90', '135', '180', '225', '270', '315'];
    const next = String(angle);
    gradientAngleValue = known.indexOf(next) >= 0 ? next : '180';
    if (!panel) return;
    panel.querySelectorAll('[data-bg-angle]').forEach(btn => {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-bg-angle') === gradientAngleValue ? 'true' : 'false');
    });
  }
  function gradientCss(start, end, angle) {
    return 'linear-gradient(' + (angle || gradientAngleValue) + 'deg, ' + start + ' 0%, ' + end + ' 100%)';
  }
  function backgroundLooksSame(el, value) {
    const current = backgroundSource(el);
    const next = String(value || '').trim();
    if (!next) return !String(current || '').trim();
    if (readSimpleGradient(next) || /gradient\(|url\(/i.test(next)) {
      return String(current || '').replace(/\s+/g, '').toLowerCase() === next.replace(/\s+/g, '').toLowerCase();
    }
    const want = hexColor(next);
    const have = hexColor(current || computed(el).backgroundColor);
    return isHexColor(want) && String(want).toUpperCase() === String(have).toUpperCase();
  }
  function updateBackground(value) {
    if (!selected || !value || !CSS.supports('background', value)) return false;
    if (group.every(el => backgroundLooksSame(el, value))) return false;
    group.forEach(n => { writeBackground(n, value); saveTarget(n); });
    if (backgroundInput && document.activeElement !== backgroundInput) backgroundInput.value = /gradient\(|url\(/i.test(value) ? value : hexColor(value);
    status.textContent = '背景已更新';
    return true;
  }
  function updateGradient() {
    const start = hexColor(gradientStart.value), end = hexColor(gradientEnd.value);
    if (!isHexColor(start) || !isHexColor(end)) return false;
    gradientStart.value = start;
    gradientEnd.value = end;
    setBgMode('gradient');
    return updateBackground(gradientCss(start, end, gradientAngleValue));
  }
  function syncBackgroundFields(el) {
    if (!el || !solidColor || !backgroundInput) return;
    const raw = backgroundSource(el);
    const gradient = readSimpleGradient(raw);
    if (gradient) {
      setBgMode('gradient');
      gradientStart.value = gradient.start;
      gradientEnd.value = gradient.end;
      setGradientAngle(gradient.angle);
      backgroundInput.value = gradientCss(gradient.start, gradient.end, gradient.angle);
      return;
    }
    if (/gradient\(|url\(/i.test(raw)) {
      setBgMode('gradient');
      backgroundInput.value = raw;
      return;
    }
    setBgMode('solid');
    const color = hexColor(raw || computed(el).backgroundColor);
    solidColor.value = isHexColor(color) ? color : '#15100A';
    backgroundInput.value = solidColor.value;
  }
  function captureOriginal(el) {
    if (originals.has(el)) return originals.get(el);
    const value = captureBaseline(el);
    const c = computed(el);
    value.computed = {
      background: c.backgroundColor, borderColor: c.borderColor, borderWidth: c.borderTopWidth, borderStyle: c.borderTopStyle,
      borderRadius: c.borderTopLeftRadius, boxShadow: c.boxShadow, color: c.color,
      fontFamily: c.fontFamily, fontSize: c.fontSize, fontWeight: c.fontWeight, letterSpacing: c.letterSpacing
    };
    originals.set(el, value);
    return value;
  }
  function restore(el) {
    if (!el || el.isConnected === false) return;
    if (originals.has(el)) writeBaseline(el, originals.get(el));
    else { STYLE_PROPS.forEach(prop => { el.style[prop] = ''; }); syncEditColorAttr(el); }
    delete settings[getId(el)];
    tombstoneControl(getId(el));
    persist();
    if (selected === el) renderControls();
  }
  function applySaved(el) { applyRecord(el, settings[getId(el)]); }
  function saveTarget(el) {
    const id = getId(el);
    const saved = readRecord(el);
    if (Object.keys(saved).length) settings[id] = saved;
    else delete settings[id];
    persist();
  }
  function tombstoneControl(id) {
    const key = CONTROLS_PREFIX + id;
    tombstones.add(key);
    delete stagedControls[id];
    if (root.CssControls.discardPending) root.CssControls.discardPending(key);
  }
  function tombstoneControlPrefix(prefix) {
    storageKeys().forEach(key => { if (key.indexOf(CONTROLS_PREFIX + prefix) === 0) tombstones.add(key); });
    Object.keys(stagedControls).forEach(id => { if (id.indexOf(prefix) === 0) delete stagedControls[id]; });
    if (root.CssControls.discardPending) root.CssControls.discardPending(CONTROLS_PREFIX + prefix);
  }
  function owningStatCell(el) {
    if (!el || !el.closest) return null;
    const list = el.closest('.stats-list');
    if (!list) return null;
    let node = el;
    while (node && node.parentElement !== list) node = node.parentElement;
    return node && node.tagName === 'LI' ? node : null;
  }

  const FP_KEY = FONT_PANEL_KEY;
  const POPOUT_RECT_KEY = 'tv-edit-popout:rect';
  const POPOUT_PANEL_RECT_KEY = 'tv-edit-popout:panel-rect';
  let popoutWin = null;
  let popoutStyleObserver = null;
  let editFontRoot = null;
  function isPopped() {
    return !!(popoutWin && !popoutWin.closed && panel.ownerDocument === popoutWin.document);
  }
  function fontPickerExpanded(fpRoot) {
    const doc = (fpRoot && fpRoot.ownerDocument) || document;
    return doc.fullscreenElement === fpRoot || fpRoot.classList.contains('fp-full');
  }
  function clampFontPicker(fpRoot) {
    if (isPopped() || fontPickerExpanded(fpRoot)) return;
    const r = fpRoot.getBoundingClientRect(), t = toggle.getBoundingClientRect();
    let w = Math.min(r.width, innerWidth), h = Math.min(r.height, innerHeight);
    let left = Math.max(0, Math.min(innerWidth - w, r.left)), top = Math.max(0, Math.min(innerHeight - h, r.top));
    if (left < t.right && left + w > t.left && top < t.bottom + 6) { top = t.bottom + 8; h = Math.min(h, innerHeight - top); }
    Object.assign(fpRoot.style, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px', right: 'auto', bottom: 'auto' });
  }
  let fpPending = null;
  let fpAnchor = null;
  function saveFontPicker(fpRoot) {
    if (isPopped() || historyLock) return;
    const r = fpRoot.getBoundingClientRect();
    const next = { left: r.left, top: r.top, width: r.width, height: r.height };
    let prev = fpPending || fpAnchor;
    if (!prev) { const stored = readJson(FP_KEY); if (isPlain(stored)) prev = stored; }
    if (!prev) { fpAnchor = next; return; }
    if (!['left', 'top', 'width', 'height'].some(key => Math.abs(Number(next[key]) - Number(prev[key])) > 1)) return;
    fpAnchor = next;
    fpPending = next;
    persist();
  }
  function parkFontPicker(fpRoot) {
    Object.assign(fpRoot.style, { left: 'auto', top: 'auto', right: 'auto', bottom: 'auto', width: 'auto', height: 'auto', maxWidth: 'none', maxHeight: 'none' });
  }
  function clearFontPickerGeometry(fpRoot) {
    ['left', 'top', 'right', 'bottom', 'width', 'height', 'maxWidth', 'maxHeight'].forEach(key => { fpRoot.style[key] = ''; });
  }
  function placeFontPicker(fpRoot) {
    if (isPopped()) { parkFontPicker(fpRoot); return; }
    let rect = fpPending; if (!rect) rect = readJson(FP_KEY);
    if (rect) Object.assign(fpRoot.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px', right: 'auto', bottom: 'auto' });
    else clearFontPickerGeometry(fpRoot);
    if (!fpRoot.hidden) clampFontPicker(fpRoot);
  }
  function bindFontPickerMove(fpRoot, handle) {
    let move = null;
    handle.addEventListener('pointerdown', event => { if (isPopped() || event.target.closest('button')) return; armHistory('fontpos'); const r = fpRoot.getBoundingClientRect(); move = { x: event.clientX - r.left, y: event.clientY - r.top }; event.preventDefault(); });
    window.addEventListener('pointermove', event => { if (!move) return; Object.assign(fpRoot.style, { left: (event.clientX - move.x) + 'px', top: (event.clientY - move.y) + 'px', right: 'auto', bottom: 'auto' }); clampFontPicker(fpRoot); });
    window.addEventListener('pointerup', () => { if (!move) return; move = null; clampFontPicker(fpRoot); saveFontPicker(fpRoot); if (pendingKind === 'fontpos') setTimeout(flushHistory, 0); });
    let resizeTimer = 0;
    new ResizeObserver(() => { if (isPopped() || fpRoot.hidden || move || fontPickerExpanded(fpRoot)) return; clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (isPopped()) return; clampFontPicker(fpRoot); saveFontPicker(fpRoot); }, 150); }).observe(fpRoot);
  }
  function fontRoots() {
    const list = [];
    const push = node => { if (node && list.indexOf(node) < 0) list.push(node); };
    push(editFontRoot);
    document.querySelectorAll('.fp.tv-edit-fp').forEach(push);
    if (popoutWin && !popoutWin.closed) popoutWin.document.querySelectorAll('.fp.tv-edit-fp').forEach(push);
    return list;
  }
  function closeFontPicker() {
    if (root.TvFontBridge) root.TvFontBridge.abandon();
    historyMute += 1;
    try { fontRoots().forEach(node => { node.hidden = true; }); }
    finally { historyMute -= 1; }
  }
  function avoidToggle() {
    const t = toggle.getBoundingClientRect(), p = panel.getBoundingClientRect();
    if (p.left < t.right && p.right > t.left && p.top < t.bottom + 6 && p.bottom > t.top) panel.style.top = Math.min(Math.max(0, innerHeight - p.height), t.bottom + 8) + 'px';
  }
  let panelMem = null;
  const selBoxes = [];
  function selBoxAt(index) {
    let box = selBoxes[index];
    if (box) return box;
    box = document.createElement('div');
    box.className = 'tv-edit-selbox';
    if (!index) box.id = 'tvEditSelBox';
    document.body.appendChild(box);
    selBoxes[index] = box;
    return box;
  }
  selBoxAt(0);
  let selRaf = 0;
  function hideSelBoxes(from) {
    for (let i = from; i < selBoxes.length; i++) {
      selBoxes[i].style.display = 'none';
      selBoxes[i].classList.remove('tv-edit-selbox-primary');
    }
  }
  function trackSel() {
    if (!active) { hideSelBoxes(0); selRaf = 0; return; }
    let shown = 0;
    group.forEach(el => {
      if (!el || !el.isConnected || !(el.classList && el.classList.contains('tv-edit-selected'))) return;
      const box = selBoxAt(shown);
      const r = el.getBoundingClientRect();
      box.classList.toggle('tv-edit-selbox-primary', el === selected);
      Object.assign(box.style, { display: 'block', left: (r.left - 3) + 'px', top: (r.top - 3) + 'px', width: (r.width + 6) + 'px', height: (r.height + 6) + 'px' });
      shown += 1;
    });
    hideSelBoxes(shown);
    if (!active) { hideSelBoxes(0); selRaf = 0; return; }
    selRaf = requestAnimationFrame(trackSel);
  }
  function startTrackSel() { if (!selRaf) selRaf = requestAnimationFrame(trackSel); }
  function stopTrackSel() { hideSelBoxes(0); if (selRaf) cancelAnimationFrame(selRaf); selRaf = 0; }
  function rectsOverlap(a, b) {
    return !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }
  function overlapArea(a, b) {
    if (!a || !b) return 0;
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function dodgeSelected(el) {
    const r = el.getBoundingClientRect(), p = panel.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight, gap = 14;
    const candidates = [
      { left: r.right + gap, top: r.top }, { left: r.left - p.width - gap, top: r.top },
      { left: r.left, top: r.bottom + gap }, { left: r.left, top: r.top - p.height - gap }
    ];
    const fits = q => q.left >= 8 && q.top >= 8 && q.left + p.width <= vw - 8 && q.top + p.height <= vh - 8 &&
      !(q.left < r.right && q.left + p.width > r.left && q.top < r.bottom && q.top + p.height > r.top);
    return candidates.find(fits) || { left: Math.max(8, Math.min(vw - p.width - 8, r.right + gap)), top: Math.max(8, Math.min(vh - p.height - 8, r.top)) };
  }
  function defaultPanelPos(el) {
    const p = panel.getBoundingClientRect();
    const margin = 8;
    const maxLeft = Math.max(margin, innerWidth - p.width - margin);
    const maxTop = Math.max(margin, innerHeight - p.height - margin);
    const clamp = (left, top) => ({ left: Math.max(margin, Math.min(maxLeft, left)), top: Math.max(margin, Math.min(maxTop, top)) });
    const selectedRect = el.getBoundingClientRect();
    const regions = ['.tv-table-board', '.tv-limit', '.tv-stats'].map(sel => {
      const node = document.querySelector(sel);
      return node ? node.getBoundingClientRect() : null;
    });
    const board = regions[0], limit = regions[1], stats = regions[2];
    const toggleRect = toggle.getBoundingClientRect();
    const road = document.querySelector('#bigRoad') || document.querySelector('.big-panel');
    const roadRect = road ? road.getBoundingClientRect() : null;
    const raw = [
      { left: maxLeft, top: margin },
      { left: maxLeft, top: toggleRect.bottom + 8 },
      { left: maxLeft, top: roadRect ? roadRect.top : margin }
    ];
    [board, limit, stats, selectedRect].forEach(rect => {
      if (!rect) return;
      raw.push({ left: maxLeft, top: rect.bottom + 8 });
      raw.push({ left: maxLeft, top: rect.top - p.height - 8 });
      raw.push({ left: rect.right + 8, top: margin });
      raw.push({ left: rect.left - p.width - 8, top: margin });
      raw.push({ left: rect.right + 8, top: rect.top });
      raw.push({ left: rect.left - p.width - 8, top: rect.top });
    });
    for (let i = 0; i <= 6; i++) {
      for (let j = 0; j <= 6; j++) raw.push({ left: margin + (maxLeft - margin) * i / 6, top: margin + (maxTop - margin) * j / 6 });
    }
    const seen = new Set();
    const boxes = [];
    raw.forEach(item => {
      const pos = clamp(item.left, item.top);
      const key = Math.round(pos.left) + ':' + Math.round(pos.top);
      if (seen.has(key)) return;
      seen.add(key);
      boxes.push({ left: pos.left, top: pos.top, right: pos.left + p.width, bottom: pos.top + p.height });
    });
    const hitsSelected = box => rectsOverlap(box, selectedRect);
    const clear = boxes.filter(box => !hitsSelected(box) && !regions.some(rect => rectsOverlap(box, rect)));
    const clearRoom = clear.filter(box => !rectsOverlap(box, toggleRect));
    const pool = clearRoom.length ? clearRoom : clear;
    function preferOpen(a, b) {
      if (Math.abs(a.left - b.left) > 12) return a.left > b.left ? a : b;
      return a.top <= b.top ? a : b;
    }
    if (pool.length) return pool.reduce(preferOpen);
    const ranked = boxes.filter(box => !hitsSelected(box));
    const source = ranked.length ? ranked : boxes;
    return source.reduce((best, box) => {
      const score = [overlapArea(box, stats), overlapArea(box, limit), overlapArea(box, board), overlapArea(box, selectedRect), -box.left, box.top];
      if (!best) return { box: box, score: score };
      for (let i = 0; i < score.length; i++) {
        if (Math.abs(score[i] - best.score[i]) <= (i < 4 ? 1 : 12)) continue;
        return score[i] < best.score[i] ? { box: box, score: score } : best;
      }
      return best;
    }, null).box;
  }
  function placePanel(el) {
    panel.hidden = false;
    if (isPopped()) return;
    const remembered = !!(panelMem && panelMem.restore());
    if (remembered) {
      const pr = panel.getBoundingClientRect(), er = el.getBoundingClientRect();
      if (!rectsOverlap(pr, er)) { panel.style.visibility = ''; return; }
    }
    panel.style.visibility = 'hidden';
    panel.style.left = '0px'; panel.style.top = '0px';
    const token = ++placeToken;
    const mode = remembered ? 'dodge' : 'default';
    requestAnimationFrame(() => {
      if (token !== placeToken || isPopped() || !el.isConnected) { panel.style.visibility = ''; return; }
      const pos = mode === 'dodge' ? dodgeSelected(el) : defaultPanelPos(el);
      panel.style.left = pos.left + 'px'; panel.style.top = pos.top + 'px';
      const before = { left: panel.style.left, top: panel.style.top };
      avoidToggle();
      if (mode === 'default' && rectsOverlap(panel.getBoundingClientRect(), el.getBoundingClientRect())) {
        panel.style.left = before.left; panel.style.top = before.top;
      }
      panel.style.visibility = '';
    });
  }
  function labelFor(el) {
    if (el.id === 'tvTopRoundCount' || el.id === 'totalCount') return '局數（程式自動計算）';
    const text = (el.textContent || el.getAttribute('aria-label') || el.className || el.tagName).trim().replace(/\s+/g, ' ');
    return text.slice(0, 30) || el.tagName.toLowerCase();
  }
  function editableText(el) { return isEditableText(el); }
  const props = [
    ['color', '字色', '#f2e4c2'], ['borderColor', '框線顏色', '#d4a64a'],
    ['borderWidth', '框線粗細', '1px'], ['borderRadius', '圓角', '4px'], ['fontSize', '文字尺寸', '16px'],
    ['fontWeight', '字重', '400'],
    ['letterSpacing', '字距', '0px'], ['boxShadow', '陰影', 'none']
  ];
  function numericWeight(value) {
    const named = { normal: 400, bold: 700 };
    const n = named[value] != null ? named[value] : parseFloat(value);
    if (!isFinite(n)) return 400;
    return Math.max(100, Math.min(900, Math.round(n / 100) * 100));
  }
  function readLiveControlBag() {
    if (!cssPanel || !selected || typeof cssPanel.save !== 'function') return null;
    const id = getId(selected);
    const key = CONTROLS_PREFIX + id;
    const prev = localStorage.getItem(key);
    try {
      cssPanel.save();
      const parsed = readJson(key);
      return { id: id, values: parsed && parsed.values };
    } catch (_) {
      return null;
    } finally {
      if (prev == null) localStorage.removeItem(key);
      else localStorage.setItem(key, prev);
    }
  }
  function mountStylePanel(el, vars, onChange) {
    const id = getId(el);
    const storageKey = CONTROLS_PREFIX + id;
    const staged = stagedControls[id];
    const hidden = tombstones.has(storageKey);
    const prev = (staged || hidden) ? localStorage.getItem(storageKey) : null;
    if (staged || hidden) {
      if (root.CssControls.discardPending) root.CssControls.discardPending(storageKey);
      if (staged) localStorage.setItem(storageKey, JSON.stringify({ v: 1, values: staged }));
      else localStorage.removeItem(storageKey);
    }
    const api = root.CssControls.panel({ target: el, mount: controlsMount, storageKey: storageKey, vars: vars, autoSave: false, onChange: onChange });
    if (staged || hidden) {
      if (prev == null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, prev);
    }
    return api;
  }
  // 編輯面板的 range 改成「標籤本身就是滑桿」。原本的 range 留在 DOM，繼續把 input/change 交給共用元件。
  const sliderBars = new WeakMap();
  let sliderObserver = null;
  let sliderRaf = 0;
  function sliderStep(range) {
    const step = Number(range.step);
    return isFinite(step) && step > 0 ? step : 1;
  }
  function sliderDecimals(step) {
    const text = String(step);
    const dot = text.indexOf('.');
    return dot < 0 ? 0 : text.length - dot - 1;
  }
  function snapSlider(range, raw) {
    const min = Number(range.min);
    const max = Number(range.max);
    const step = sliderStep(range);
    let value = Number(raw);
    if (!isFinite(value)) value = isFinite(min) ? min : 0;
    if (isFinite(min) && isFinite(max) && max >= min) {
      value = min + Math.round((value - min) / step) * step;
      const places = sliderDecimals(step);
      value = places ? Number(value.toFixed(places)) : Math.round(value);
      if (value < min) value = min;
      if (value > max) value = max;
    }
    return value;
  }
  function cssEscapeId(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }
  function sliderLabelText(node) {
    if (!node) return '';
    const copy = node.cloneNode(true);
    copy.querySelectorAll('.tv-edit-mixed').forEach(badge => badge.remove());
    return (copy.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function sliderName(range, root) {
    const aria = (range.getAttribute('aria-label') || '').trim();
    if (aria) return aria;
    if (range.id) {
      const text = sliderLabelText(root.querySelector('label[for="' + cssEscapeId(range.id) + '"]'));
      if (text) return text;
    }
    const mini = range.closest('.csc-mini');
    const span = mini && mini.querySelector('span');
    const miniText = span ? (span.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return miniText || '數值';
  }
  function sliderUnit(range) {
    const host = range.closest('[data-csc-var]');
    if (host && host.getAttribute('data-csc-var') === '--edit-font-weight') return '';
    const line = range.closest('.csc-line');
    const unitEl = line && line.querySelector('select, .csc-unit');
    if (unitEl) {
      const raw = unitEl.tagName === 'SELECT' ? unitEl.value : (unitEl.textContent || '');
      const text = String(raw || '').trim();
      return text === '無' ? '' : text;
    }
    const block = range.closest('[data-csc-type]');
    const type = block ? block.getAttribute('data-csc-type') : '';
    if (type === 'size') return 'px';
    if (type === 'shadow' && (range.getAttribute('aria-label') || '').trim() === '透明度') return '%';
    return '';
  }
  function formatSlider(range) {
    const places = sliderDecimals(sliderStep(range));
    let n = Number(range.value);
    if (!isFinite(n)) n = 0;
    const text = places ? String(Number(n.toFixed(places))) : String(Math.round(n));
    const unit = sliderUnit(range);
    return unit ? text + unit : text;
  }
  function sliderRatio(range) {
    const min = Number(range.min);
    const max = Number(range.max);
    const value = Number(range.value);
    if (!isFinite(min) || !isFinite(max) || !(max > min) || !isFinite(value)) return 0;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }
  function refreshSlider(range) {
    const bar = sliderBars.get(range);
    if (!bar) return;
    bar.setAttribute('aria-valuemin', range.min);
    bar.setAttribute('aria-valuemax', range.max);
    bar.setAttribute('aria-valuenow', range.value);
    const fill = bar.querySelector('.tv-slider-fill');
    const val = bar.querySelector('.tv-slider-val');
    if (fill) fill.style.width = (sliderRatio(range) * 100) + '%';
    if (val) val.textContent = formatSlider(range);
  }
  function hideSliderCaption(range, root, nameEl) {
    let lab = range.id ? root.querySelector('label[for="' + cssEscapeId(range.id) + '"]') : null;
    if (!lab) {
      const sizeBlock = range.closest('.csc-block[data-csc-type="size"]');
      lab = sizeBlock && sizeBlock.querySelector(':scope > .csc-label');
    }
    if (lab && lab.classList.contains('csc-label')) {
      const badge = lab.querySelector('.tv-edit-mixed');
      if (badge) nameEl.appendChild(badge);
      lab.classList.add('tv-slider-label-off');
    }
    const mini = range.closest('.csc-mini');
    const miniSpan = mini && mini.querySelector(':scope > span');
    if (miniSpan) miniSpan.classList.add('tv-slider-label-off');
    const line = range.closest('.csc-line');
    const key = line && line.querySelector(':scope > span.csc-k');
    if (key) key.classList.add('tv-slider-label-off');
  }
  function valueFromPointer(range, bar, event) {
    const rect = bar.getBoundingClientRect();
    const width = rect.width || 1;
    let t = (event.clientX - rect.left) / width;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    const min = Number(range.min);
    const max = Number(range.max);
    const start = isFinite(min) ? min : 0;
    const end = isFinite(max) ? max : start + 100;
    return snapSlider(range, start + t * (end - start));
  }
  function pushSlider(range, raw, how) {
    const next = snapSlider(range, raw);
    const prev = Number(range.value);
    const changed = !isFinite(prev) || Math.abs(prev - next) > 1e-9;
    if (changed) range.value = String(next);
    if (changed && (how === 'drag' || how === 'key')) range.dispatchEvent(new Event('input', { bubbles: true }));
    if ((how === 'key' && changed) || how === 'up') range.dispatchEvent(new Event('change', { bubbles: true }));
    refreshSlider(range);
  }
  function watchSliderScope(range) {
    const scope = range.closest('.csc-block') || range.parentElement;
    if (!scope || scope.dataset.tvSliderWatch === '1') return;
    scope.dataset.tvSliderWatch = '1';
    const sync = event => {
      const t = event.target;
      if (t && t.matches && t.matches('input[type="number"]') && event.type === 'change') {
        const line = t.closest('.csc-line');
        const src = line && line.querySelector('input[type="range"][data-tv-slider-bar]');
        if (src && t.value !== '' && t.value !== '-') {
          const n = Number(t.value);
          if (isFinite(n)) {
            const snapped = snapSlider(src, n);
            if (Number(src.value) !== snapped) src.value = String(snapped);
          }
        }
      }
      scope.querySelectorAll('input[type="range"][data-tv-slider-bar]').forEach(refreshSlider);
    };
    scope.addEventListener('input', sync);
    scope.addEventListener('change', sync);
  }
  function bindSlider(range, root) {
    if (range.dataset.tvSliderBar) return;
    range.dataset.tvSliderBar = '1';
    const line = range.closest('.csc-line') || range.parentElement;
    if (line) line.classList.add('tv-slider-line');
    const name = sliderName(range, root);
    const bar = document.createElement('div');
    bar.className = 'tv-slider-bar';
    bar.tabIndex = 0;
    bar.setAttribute('role', 'slider');
    bar.setAttribute('aria-label', name);
    const fill = document.createElement('span');
    fill.className = 'tv-slider-fill';
    fill.setAttribute('aria-hidden', 'true');
    const nameEl = document.createElement('span');
    nameEl.className = 'tv-slider-name';
    nameEl.textContent = name;
    const valEl = document.createElement('span');
    valEl.className = 'tv-slider-val';
    bar.appendChild(fill);
    bar.appendChild(nameEl);
    bar.appendChild(valEl);
    hideSliderCaption(range, root, nameEl);
    range.classList.add('tv-slider-src');
    range.setAttribute('aria-hidden', 'true');
    range.tabIndex = -1;
    line.insertBefore(bar, range);
    sliderBars.set(range, bar);
    watchSliderScope(range);
    refreshSlider(range);
    const focusBar = () => { try { bar.focus({ preventScroll: true }); } catch (_) { try { bar.focus(); } catch (__) {} } };
    range.addEventListener('focus', focusBar);
    let number = line && line.querySelector(':scope > input[type="number"]');
    if (!number) {
      number = document.createElement('input');
      number.type = 'number'; number.className = 'csc-num';
      number.min = range.min; number.max = range.max; number.step = range.step;
      number.setAttribute('aria-label', name);
      number.addEventListener('change', () => {
        armHistory('num'); pushSlider(range, Number(number.value), 'key'); flushHistory();
      });
      line.appendChild(number);
    }
    const closeNumber = () => { if (line) line.classList.remove('tv-slider-num-open'); };
    if (number) {
      number.addEventListener('blur', closeNumber);
      number.addEventListener('keydown', event => {
        if (event.key === 'Enter') { number.dispatchEvent(new Event('change', { bubbles: true })); number.blur(); }
        else if (event.key === 'Escape') { event.preventDefault(); number.value = bar._numberStart; number.dispatchEvent(new Event('input', { bubbles: true })); number.dispatchEvent(new Event('change', { bubbles: true })); pushSlider(range, Number(bar._numberStart), 'key'); number.blur(); focusBar(); }
      });
    }
    const clearHold = () => { if (bar._holdTimer) { clearTimeout(bar._holdTimer); bar._holdTimer = 0; } };
    bar.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      closeNumber();
      bar._pid = event.pointerId;
      bar._startX = event.clientX;
      bar._startY = event.clientY;
      bar._dragging = false;
      bar._held = false;
      bar.classList.add('is-active');
      focusBar();
      try { bar.setPointerCapture(event.pointerId); } catch (_) {}
      if (number) bar._holdTimer = setTimeout(() => {
        bar._holdTimer = 0;
        if (bar._pid !== event.pointerId || bar._dragging) return;
        bar._held = true;
        bar._suppressClick = true;
        bar._numberStart = range.value;
        number.value = range.value;
        line.classList.add('tv-slider-num-open');
        number.focus({ preventScroll: true });
        number.select();
      }, 550);
    });
    bar.addEventListener('pointermove', event => {
      if (bar._pid == null || event.pointerId !== bar._pid || bar._held) return;
      if (!bar._dragging && Math.hypot(event.clientX - bar._startX, event.clientY - bar._startY) < 6) return;
      if (!bar._dragging) { bar._dragging = true; clearHold(); armHistory('slider'); }
      pushSlider(range, valueFromPointer(range, bar, event), 'drag');
    });
    const endDrag = event => {
      if (bar._pid == null || event.pointerId !== bar._pid) return;
      clearHold();
      const held = bar._held;
      const dragging = bar._dragging;
      bar._pid = null;
      bar._dragging = false;
      bar._held = false;
      bar.classList.remove('is-active');
      try { if (bar.hasPointerCapture(event.pointerId)) bar.releasePointerCapture(event.pointerId); } catch (_) {}
      if (!held && event.type === 'pointerup') {
        if (!dragging) { armHistory('slider'); pushSlider(range, valueFromPointer(range, bar, event), 'drag'); }
        pushSlider(range, Number(range.value), 'up');
        if (pendingKind === 'slider') setTimeout(flushHistory, 0);
      }
    };
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);
    bar.addEventListener('click', event => { event.preventDefault(); if (bar._suppressClick) { bar._suppressClick = false; return; } focusBar(); });
    bar.addEventListener('keydown', event => {
      if (number && (event.key === 'Enter' || event.key === 'F2')) {
        event.preventDefault(); bar._numberStart = range.value; number.value = range.value;
        line.classList.add('tv-slider-num-open'); number.focus({ preventScroll:true }); number.select(); return;
      }
      const step = sliderStep(range);
      const min = Number(range.min);
      const max = Number(range.max);
      let cur = Number(range.value);
      if (!isFinite(cur)) cur = isFinite(min) ? min : 0;
      const jump = event.shiftKey ? 10 : 1;
      let next = null;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = cur - step * jump;
      else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = cur + step * jump;
      else if (event.key === 'Home') next = min;
      else if (event.key === 'End') next = max;
      else return;
      event.preventDefault();
      armHistory('slider');
      pushSlider(range, next, 'key');
      flushHistory();
    });
  }
  function enhanceSliders(rootEl) {
    if (!rootEl || !rootEl.querySelectorAll) return;
    rootEl.querySelectorAll('input[type="range"]').forEach(range => bindSlider(range, rootEl));
    rootEl.querySelectorAll('input[type="number"]').forEach(num => {
      if (num.dataset.tvHist) return;
      num.dataset.tvHist = '1';
      num.addEventListener('focus', () => armHistory('num'));
      num.addEventListener('blur', () => { if (pendingKind === 'num') flushHistory(); });
    });
  }
  function ensureSliderObserver() {
    if (sliderObserver || !controlsMount) return;
    sliderObserver = new MutationObserver(() => {
      if (sliderRaf) return;
      sliderRaf = requestAnimationFrame(() => {
        sliderRaf = 0;
        enhanceSliders(controlsMount);
      });
    });
    sliderObserver.observe(controlsMount, { childList: true, subtree: true });
  }
  ensureSliderObserver();
  if (lightOptions) {
    lightOptions.querySelectorAll('label').forEach(label => {
      const range = label.querySelector('input[type="range"]');
      if (!range) return;
      range.setAttribute('aria-label', label.firstChild.textContent.trim());
      label.firstChild.textContent = '';
      const output = label.querySelector('output');
      if (output) output.hidden = true;
    });
    enhanceSliders(lightOptions);
  }
  const MULTI_TEXT_PLACEHOLDER = '多個區塊文字不同，輸入後會全部改成同一段';
  const LOCKED_TEXT_REASON = '選取中有自動計算或含子元素的區塊';
  function syncTextField() {
    if (!textInput) return;
    const members = group.length ? group : (selected ? [selected] : []);
    const editable = members.length > 0 && members.every(isEditableText);
    if (editable) {
      textInput.disabled = false;
      const texts = members.map(n => n.textContent == null ? '' : String(n.textContent));
      const same = texts.every(text => text === texts[0]);
      textInput.value = same ? texts[0] : '';
      textInput.placeholder = same ? '' : MULTI_TEXT_PLACEHOLDER;
      textInput.removeAttribute('aria-describedby');
      if (textNote) { textNote.hidden = true; textNote.textContent = ''; }
      return;
    }
    textInput.disabled = true;
    textInput.value = '';
    if (members.length > 1) {
      textInput.placeholder = LOCKED_TEXT_REASON;
      if (textNote) { textNote.hidden = false; textNote.textContent = LOCKED_TEXT_REASON; }
      textInput.setAttribute('aria-describedby', 'tvEditTextNote');
    } else {
      textInput.placeholder = '';
      textInput.removeAttribute('aria-describedby');
      if (textNote) { textNote.hidden = true; textNote.textContent = ''; }
    }
  }
  function refreshWeightSlider() {
    if (!controlsMount) return;
    const range = controlsMount.querySelector('[data-csc-var="--edit-font-weight"] input[type="range"]');
    if (range) refreshSlider(range);
  }
  function syncFontPanelWeight(silent) {
    if (weightSyncLock || !editFontApi || !editFontRoot || editFontRoot.hidden || !selected) return;
    editFontApi.setWeight(numericWeight(computed(selected).fontWeight), silent !== false);
  }
  function pushFontWeight(raw) {
    if (weightSyncLock || historyMute || historyLock || !selected || !group.length) return;
    const value = String(numericWeight(raw));
    const painted = group.every(n => String(numericWeight(computed(n).fontWeight)) === value);
    const shown = cssPanel ? cssPanel.get('--edit-font-weight') : value;
    if (painted && shown === value) return;
    if (!painted && !fontBefore) fontBefore = captureSnap();
    weightSyncLock = true;
    try {
      if (!painted) group.forEach(n => { n.style.fontWeight = value; saveTarget(n); });
      if (cssPanel && shown !== value) cssPanel.set('--edit-font-weight', value);
    } finally {
      weightSyncLock = false;
    }
    refreshWeightSlider();
  }
  function bindFontWeightSync(rootEl) {
    if (!rootEl || fontWeightBound.has(rootEl)) return;
    fontWeightBound.add(rootEl);
    const weightTarget = event => {
      const target = event.target;
      if (!target || !target.matches || !target.matches('[data-act="weight"], [data-act="weight-range"]')) return null;
      return target;
    };
    const rememberWeight = event => {
      const target = weightTarget(event);
      if (!target || historyMute || historyLock || weightSyncLock || !selected || fontBefore) return;
      let raw = target.value;
      if (target.getAttribute('data-act') === 'weight') {
        if (raw === '' || (raw.length < 3 && Number(raw) < 100)) return;
      }
      const next = String(numericWeight(raw));
      const current = String(numericWeight(computed(selected).fontWeight));
      if (next !== current) fontBefore = captureSnap();
    };
    rootEl.addEventListener('input', rememberWeight, true);
    rootEl.addEventListener('change', rememberWeight, true);
    const pull = () => {
      const range = rootEl.querySelector('[data-act="weight-range"]');
      if (range) pushFontWeight(range.value);
    };
    rootEl.addEventListener('input', event => {
      if (!weightTarget(event)) return;
      pull();
    });
    rootEl.addEventListener('change', event => {
      if (!weightTarget(event)) return;
      pull();
    });
    rootEl.addEventListener('keyup', event => {
      const target = event.target;
      if (!target || !target.matches || !target.matches('[data-act="weight"], [data-act="weight-range"]')) return;
      if (fontBefore) flushFont();
    });
  }
  function renderControls() {
    historyMute += 1;
    try { renderControlsNow(); }
    finally { historyMute -= 1; }
  }
  function renderControlsNow() {
    if (cssPanel) { cssPanel.destroy(); cssPanel = null; }
    updateLayerButtons();
    if (!selected) return;
    const el = selected, id = getId(el), style = computed(el);
    label.textContent = '選取：' + labelFor(el);
    backgroundInput.disabled = false;
    syncBackgroundFields(el);
    const light = validLight(el.dataset.tvEditLight) ? el.dataset.tvEditLight.split(',') : ['50', '35', '45'];
    lightEnabled.checked = validLight(el.dataset.tvEditLight);
    [lightX, lightY, lightStrength].forEach((input, index) => { input.value = light[index]; input.nextElementSibling.value = input.value + '%'; });
    lightOptions.hidden = !lightEnabled.checked;
    const wasSelected = el.classList.contains('tv-edit-selected'); el.classList.remove('tv-edit-selected');
    const vars = props.map(([prop, name, fallback]) => {
      const cssName = '--edit-' + prop.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
      let value = style[prop];
      if (prop === 'fontSize' && el.classList.contains('cs-leaf') && !el.style.fontSize && el.firstElementChild) value = getComputedStyle(el.firstElementChild).fontSize;
      if (prop === 'color' || prop === 'borderColor') value = hexColor(value);
      const spec = { name: cssName, label: name, type: prop === 'color' || prop === 'borderColor' ? 'color' : prop === 'boxShadow' ? 'shadow' : 'size', value: value || fallback, group: '樣式' };
      if (prop === 'fontWeight') {
        spec.unit = '';
        spec.min = 100;
        spec.max = 900;
        spec.step = 100;
        spec.value = String(numericWeight(value || fallback));
      } else if (prop === 'letterSpacing') {
        spec.unit = 'px';
        spec.units = ['px', 'em'];
        spec.min = 0;
        spec.max = 30;
        spec.step = 1;
        spec.ranges = { px: { min: 0, max: 30, step: 1 }, em: { min: 0, max: 2, step: 0.05 } };
      } else if (spec.type === 'size') {
        spec.unit = 'px';
        spec.min = prop === 'fontSize' ? 6 : 0;
        spec.max = prop === 'fontSize' ? 96 : 40;
        spec.step = 1;
      }
      return spec;
    });
    if (wasSelected) el.classList.add('tv-edit-selected');
    const varNames = vars.map(v => v.name);
    let lastVars = {};
    cssPanel = mountStylePanel(el, vars, (value, name) => {
      const changed = name ? [name] : varNames.filter(v => cssPanel.get(v) !== lastVars[v]);
      group.forEach(n => { mapVars(n, changed); saveTarget(n); });
      const live = readLiveControlBag();
      if (live && isPlain(live.values)) group.forEach(n => { stagedControls[getId(n)] = live.values; tombstones.delete(CONTROLS_PREFIX + getId(n)); });
      varNames.forEach(v => { lastVars[v] = cssPanel.get(v); });
      (changed || []).forEach(v => { const badge = controlsMount.querySelector('[data-csc-var="' + v + '"] .tv-edit-mixed'); if (badge) badge.remove(); });
      if (changed.indexOf('--edit-font-weight') >= 0) {
        refreshWeightSlider();
        if (!weightSyncLock) syncFontPanelWeight(true);
      }
    });
    varNames.forEach(v => { lastVars[v] = cssPanel.get(v); });
    controlsMount.querySelectorAll('[data-csc-type="color"] .csc-color-input').forEach(field => {
      field.value = hexColor(field.value);
      field.setAttribute('data-color', field.value);
    });
    if (group.length > 1) {
      label.textContent = '選取：' + group.length + ' 個區塊（Ctrl+點選加選或取消）';
      props.forEach(([prop]) => {
        const values = new Set(group.map(n => computed(n)[prop]));
        const lab = values.size > 1 && controlsMount.querySelector('[data-csc-var="--edit-' + prop.replace(/[A-Z]/g, m => '-' + m.toLowerCase()) + '"] .csc-label');
        if (lab) { const badge = document.createElement('span'); badge.className = 'tv-edit-mixed'; badge.textContent = '混合'; lab.appendChild(badge); }
      });
    }
    const fontBtn = document.createElement('button');
    fontBtn.type = 'button'; fontBtn.className = 'tv-edit-font-button'; fontBtn.textContent = '選擇字型';
    fontBtn.addEventListener('click', () => {
      historyMute += 1;
      try { openFontPanel(false); }
      finally { historyMute -= 1; }
    });
    const wbBtn = document.createElement('button');
    wbBtn.type = 'button'; wbBtn.id = 'tvEditWorkbench'; wbBtn.className = 'tv-edit-workbench-button'; wbBtn.textContent = '工作台';
    wbBtn.addEventListener('click', () => {
      historyMute += 1;
      try { openFontPanel(true); }
      finally { historyMute -= 1; }
    });
    function readBridgeStyles(node) {
      if (!node) return {};
      const c = computed(node);
      let fs = node.style.fontSize || c.fontSize;
      if (node.classList && node.classList.contains('cs-leaf') && !node.style.fontSize && node.firstElementChild) {
        fs = getComputedStyle(node.firstElementChild).fontSize;
      }
      return {
        color: hexColor(node.style.color || c.color),
        fontFamily: node.style.fontFamily || c.fontFamily || '',
        fontWeight: String(numericWeight(node.style.fontWeight || c.fontWeight)),
        fontSize: fs || '16px',
        borderWidth: node.style.borderWidth || c.borderTopWidth || '0px',
        borderStyle: node.style.borderStyle || c.borderTopStyle || 'none',
        borderColor: hexColor(node.style.borderColor || c.borderColor || '#d4a64a'),
        borderRadius: node.style.borderRadius || c.borderTopLeftRadius || '0px',
        boxShadow: node.style.boxShadow || c.boxShadow || 'none'
      };
    }
    function resolveBridgeTarget(node, members) {
      const list = Array.isArray(members) && members.length ? members : (node ? [node] : []);
      const primary = node || list[0];
      if (!primary) return null;
      return {
        targetId: getId(primary) || 'target',
        label: list.length > 1 ? (list.length + ' 個區塊（' + labelFor(primary) + '）') : labelFor(primary),
        styles: readBridgeStyles(primary)
      };
    }
    function openFontPanel(workbenchMode) {
      const targets = group.filter(n => n && n.isConnected);
      if (!targets.length || !root.TvFontBridge) {
        status.textContent = '字型橋接未載入。';
        return;
      }
      const sample = selected && targets.indexOf(selected) >= 0 ? selected : targets[0];
      const info = resolveBridgeTarget(sample, targets);
      root.TvFontBridge.open({
        pageId: 'tv',
        workbench: workbenchMode !== false,
        targetId: info ? info.targetId : 'target',
        label: info ? info.label : labelFor(sample),
        initialStyles: info ? info.styles : {},
        targets: targets,
        statusEl: status,
        isCurrent: () => selected && targets.indexOf(selected) >= 0 && targets.every(n => n.isConnected),
        resolveTarget: (nextEl, nextTargets) => {
          targets.length = 0;
          (nextTargets || []).forEach(n => targets.push(n));
          return resolveBridgeTarget(nextEl, targets);
        },
        commit: (appliedStyles, committedTargets) => {
          const activeTargets = Array.isArray(committedTargets) && committedTargets.length ? committedTargets : targets;
          const before = fontBefore || captureSnap();
          fontBefore = null;
          activeTargets.forEach(n => {
            if (!n || !n.isConnected) return;
            if (appliedStyles && appliedStyles.borderWidth !== undefined && appliedStyles.borderStyle === undefined) {
              syncBorderStyle(n, n.style.borderWidth, true);
            }
            if (appliedStyles && appliedStyles.color !== undefined) {
              syncEditColorAttr(n);
            }
            tombstoneControl(getId(n));
            saveTarget(n);
          });
          writeSettings();
          if (selected && activeTargets.indexOf(selected) >= 0) {
            renderControls();
            const live = readLiveControlBag();
            if (live && isPlain(live.values)) {
              activeTargets.forEach(n => {
                const id = getId(n);
                stagedControls[id] = live.values;
                tombstones.delete(CONTROLS_PREFIX + id);
              });
            }
          }
          commitSnap(before);
        }
      });
    }
    controlsMount.querySelectorAll('.tv-edit-font-button, .tv-edit-workbench-button').forEach(node => node.remove());
    controlsMount.appendChild(fontBtn);
    controlsMount.appendChild(wbBtn);
    applySaved(el);
    enhanceSliders(controlsMount);
    syncTextField();
    syncFontPanelWeight(true);
  }
  function borderAmount(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text || text === 'transparent' || text === 'none' || text === 'hidden') return 0;
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)/.test(text)) { const n = parseFloat(text); return isFinite(n) ? n : 0; }
    const alpha = text.match(/rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/i);
    if (alpha) return parseFloat(alpha[1]) > 0 ? 1 : 0;
    return 1;
  }
  function ourBorderSolid(el) {
    if (el.style.borderStyle !== 'solid') return false;
    if (suppliedBorder.has(el)) return true;
    const origin = originals.get(el);
    if (!origin || origin.borderStyle) return false;
    const was = origin.computed && origin.computed.borderStyle;
    return was === 'none' || was === 'hidden';
  }
  function syncBorderStyle(el, value, allowClear) {
    const amount = borderAmount(value);
    if (amount > 0) {
      const top = computed(el).borderTopStyle;
      if (top === 'none' || top === 'hidden') { el.style.borderStyle = 'solid'; suppliedBorder.add(el); }
    } else if (allowClear && ourBorderSolid(el)) { el.style.borderStyle = ''; suppliedBorder.delete(el); }
  }
  function mapVars(el, only) {
    if (!cssPanel) return;
    const map = {
      '--edit-color': 'color', '--edit-border-color': 'borderColor',
      '--edit-border-width': 'borderWidth', '--edit-border-radius': 'borderRadius', '--edit-font-size': 'fontSize',
      '--edit-font-weight': 'fontWeight', '--edit-letter-spacing': 'letterSpacing', '--edit-box-shadow': 'boxShadow'
    };
    Object.entries(map).forEach(([variable, property]) => {
      if (only && only.indexOf(variable) < 0) return;
      let value = cssPanel.get(variable);
      if (value && property !== 'boxShadow' && property !== 'color' && property !== 'borderColor' && property !== 'fontWeight' && !/[a-z%)]$/i.test(value)) value += 'px';
      if (value) el.style[property] = value;
      if (property === 'borderWidth') syncBorderStyle(el, value, true);
      else if (property === 'borderColor' && parseFloat(el.style.borderWidth) > 0) syncBorderStyle(el, value, false);
    });
    if (!only || only.indexOf('--edit-color') >= 0) syncEditColorAttr(el);
  }
  function select(el, additive) {
    historyMute += 1;
    try { selectNow(el, additive); }
    finally { historyMute -= 1; }
  }
  function selectNow(el, additive) {
    if (!layerNav) descendStack = [];
    const index = group.indexOf(el);
    if (additive && selected && index >= 0) {
      if (group.length === 1) return;
      group.splice(index, 1); el.classList.remove('tv-edit-selected'); selected = group[group.length - 1];
    } else {
      if (!additive) { group.forEach(n => n.classList.remove('tv-edit-selected')); group = []; }
      if (index < 0 || !additive) group.push(el);
      selected = el; captureOriginal(el); applySaved(el); el.classList.add('tv-edit-selected');
    }
    renderControls(); placePanel(selected); if (splitTools) splitTools.update();
    if (root.TvFontBridge) root.TvFontBridge.noteSelection(selected, group);
  }
  function editableParent(el) {
    if (!el || !el.parentElement) return null;
    if (el.classList && el.classList.contains('cs-leaf')) {
      const cell = owningStatCell(el);
      return cell && cell !== el ? cell : null;
    }
    const parent = el.parentElement;
    if (!parent.matches || !parent.matches(ROOT)) return null;
    if (parent.closest && parent.closest('#tvEditPanel')) return null;
    return parent;
  }
  function firstEditableChild(el) {
    if (!el || !el.children) return null;
    if (el.classList && el.classList.contains('cs-split')) {
      const leaf = el.querySelector('.cs-leaf');
      if (leaf) return leaf;
    }
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      if (!child.matches || child.matches('.cs-root, .cs-bar')) continue;
      if (child.matches(ROOT)) return child;
    }
    return null;
  }
  function rememberedChild() {
    for (let i = descendStack.length - 1; i >= 0; i--) {
      const item = descendStack[i];
      if (item && item.isConnected && selected && selected.contains(item) && item !== selected) return item;
    }
    return null;
  }
  function updateLayerButtons() {
    if (!selectUpBtn || !selectDownBtn) return;
    selectUpBtn.disabled = !editableParent(selected);
    selectDownBtn.disabled = !(rememberedChild() || firstEditableChild(selected));
  }
  function selectParentLayer() {
    const parent = editableParent(selected);
    if (!parent) return;
    descendStack.push(selected);
    layerNav = true;
    select(parent, false);
    layerNav = false;
  }
  function selectChildLayer() {
    if (!selected) return;
    let child = null;
    while (descendStack.length) {
      const candidate = descendStack.pop();
      if (candidate && candidate.isConnected && selected.contains(candidate) && candidate !== selected) { child = candidate; break; }
    }
    if (!child) child = firstEditableChild(selected);
    if (!child) return;
    layerNav = true;
    select(child, false);
    layerNav = false;
  }
  if (selectUpBtn) selectUpBtn.addEventListener('click', selectParentLayer);
  if (selectDownBtn) selectDownBtn.addEventListener('click', selectChildLayer);
  if (undoBtn) undoBtn.addEventListener('click', undoHistory);
  if (redoBtn) redoBtn.addEventListener('click', redoHistory);
  const cpProps = { '--edit-color': 'color', '--edit-border-color': 'borderColor' };
  let cpLive = null;
  function cpOpen() { const cp = root.ColorPicker; return !!(cp && cp.popover && cp.popover.classList.contains('cp-open')); }
  function cpPreview() {
    const cp = root.ColorPicker; if (!cpLive || !cpOpen()) return;
    let h = String(cp.currentHex || '').replace('#', '');
    if (h.length === 3) h = h.replace(/./g, c => c + c);
    const n = parseInt(h.slice(0, 6), 16), a = cp.alpha == null ? 1 : cp.alpha;
    const value = h.length >= 6 && !isNaN(n) ? 'rgba(' + (n >> 16 & 255) + ', ' + (n >> 8 & 255) + ', ' + (n & 255) + ', ' + a + ')' : 'transparent';
    if (cpLive.gradientField || cpLive.solidField) {
      if (!/^[\da-f]{6}$/i.test(h)) return;
      const picked = '#' + h + (a < 0.999 ? Math.round(a * 255).toString(16).padStart(2, '0') : '');
      let paint = picked;
      if (cpLive.gradientField) {
        const start = hexColor(cpLive.gradientField === gradientStart ? picked : gradientStart.value);
        const end = hexColor(cpLive.gradientField === gradientEnd ? picked : gradientEnd.value);
        if (!isHexColor(start) || !isHexColor(end)) return;
        paint = gradientCss(start, end, gradientAngleValue);
      }
      if (!CSS.supports('background', paint)) return;
      cpLive.els.forEach(node => writeBackground(node, paint));
      return;
    }
    cpLive.els.forEach(node => {
      if (!cpLive.prop) return;
      node.style[cpLive.prop] = value;
      if (cpLive.prop === 'borderColor' && parseFloat(node.style.borderWidth) > 0) syncBorderStyle(node, value, false);
      if (cpLive.prop === 'color') syncEditColorAttr(node);
    });
  }
  function cpSchedule() { if (cpLive) requestAnimationFrame(cpPreview); }
  function cpEnd() {
    if (!cpLive || cpOpen()) return;
    const live = cpLive; cpLive = null;
    if (!live.applied) {
      live.els.forEach((node, k) => {
        node.style.background = live.before[k].background;
        node.style.backgroundColor = live.before[k].backgroundColor || '';
        if (live.before[k].baseBackground != null) node.dataset.tvEditBaseBackground = live.before[k].baseBackground;
        if (live.prop) node.style[live.prop] = live.before[k].value;
        if (live.prop === 'borderColor') {
          node.style.borderStyle = live.before[k].borderStyle || '';
          if (node.style.borderStyle !== 'solid') suppliedBorder.delete(node);
        }
        if (live.prop === 'color') syncEditColorAttr(node);
      });
      colorBefore = null;
    }
  }
  function onColorFieldClick(event) {
    const field = event.target.closest && event.target.closest('#tvEditControls [data-color-picker], #tvEditSolidColor, #tvEditGradientStart, #tvEditGradientEnd');
    const prop = field && cpProps[field.getAttribute('data-css-var')];
    const gradientField = field === gradientStart || field === gradientEnd ? field : null;
    const solidField = field === solidColor ? field : null;
    if ((!prop && !gradientField && !solidField) || !selected) return;
    cpLive = { els: group.slice(), prop: prop, gradientField: gradientField, solidField: solidField, applied: false, snap: captureSnap(), before: group.map(n => ({ background: n.style.background, backgroundColor: n.style.backgroundColor, baseBackground: n.dataset.tvEditLight ? n.dataset.tvEditBaseBackground : null, value: prop ? n.style[prop] : '', borderStyle: n.style.borderStyle })) };
    const live = cpLive;
    field.addEventListener('change', () => { live.applied = true; }, { once: true });
    const pop = root.ColorPicker && root.ColorPicker.popover;
    if (pop && !pop.dataset.tvEditLive) {
      pop.dataset.tvEditLive = '1';
      ['mousedown', 'click', 'input', 'keyup'].forEach(type => pop.addEventListener(type, cpSchedule));
      window.addEventListener('mousemove', cpSchedule);
      const view = pop.ownerDocument && pop.ownerDocument.defaultView;
      if (view && view !== window) view.addEventListener('mousemove', cpSchedule);
      new MutationObserver(() => requestAnimationFrame(cpEnd)).observe(pop, { attributes: true, attributeFilter: ['class'] });
    }
    requestAnimationFrame(cpPreview);
  }
  document.addEventListener('click', onColorFieldClick);
  function setActive(value) {
    active = value; app.classList.toggle('tv-editing', active); app.classList.toggle('cs-editing', active);
    document.querySelectorAll('.tv-table-board, .tv-limit, .tv-stats').forEach(node => node.classList.toggle('tv-edit-target', active));
    toggle.setAttribute('aria-pressed', String(active)); toggle.textContent = active ? '完成編輯' : '編輯';
    if (active) startTrackSel(); else stopTrackSel();
    if (!active) {
      if (isPopped()) dockPopout();
      group.forEach(n => n.classList.remove('tv-edit-selected')); group = []; selected = null; panel.hidden = true; closeFontPicker(); if (splitTools) splitTools.update();
    }
  }
  function askView(event) { return (event && event.view) || window; }
  function askConfirm(message, event) { return askView(event).confirm(message); }
  function askPrompt(message, value, event) { return askView(event).prompt(message, value); }
  function tryLeaveEdit(event) {
    const save = !dirty || askConfirm('有未儲存的變更。按「確定」儲存並結束編輯；按「取消」看其他選項。', event);
    const choice = decideClose(dirty, save);
    if (choice === 'stay') {
      if (!askConfirm('要放棄這些變更並結束編輯嗎？按「確定」放棄並重新載入；按「取消」留在編輯。', event)) return;
      discardAndReload();
      return;
    }
    if (choice === 'save-and-close') { commitAll(); status.textContent = '已儲存'; }
    setActive(false);
  }
  toggle.addEventListener('click', event => {
    if (active) { tryLeaveEdit(event); return; }
    setActive(true);
    // The entry button is hidden: opening by X must reveal the editor immediately.
    const initialTarget = document.querySelector('.tv-limit') || document.querySelector(ROOT);
    if (initialTarget) select(initialTarget, false);
    status.textContent = '點選左上桌牌、限紅表或左下統計區進行編輯';
  });
  document.getElementById('tvEditClose').addEventListener('click', tryLeaveEdit);
  document.addEventListener('click', event => {
    if (!active || event.target.closest('#tvEditPanel,#tvEditToggle')) return;
    if (event.target.closest('.cs-bar')) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    const target = event.target.closest('.cs-leaf') || event.target.closest(ROOT);
    if (!target || target.closest('#tvEditPanel')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    select(target, event.ctrlKey || event.metaKey);
  }, true);
  textInput.addEventListener('input', () => {
    if (!selected || !group.length || !group.every(isEditableText)) return;
    if (!textBefore) textBefore = captureSnap();
    group.forEach(n => { n.textContent = textInput.value; saveTarget(n); });
    if (group.length < 2) label.textContent = '選取：' + labelFor(selected);
    if (textTimer) clearTimeout(textTimer);
    textTimer = setTimeout(flushText, 600);
  });
  textInput.addEventListener('blur', () => flushText());
  textInput.addEventListener('change', () => flushText());
  backgroundInput.addEventListener('change', () => {
    if (!selected) return;
    const value = backgroundInput.value.trim();
    if (!value || !CSS.supports('background', value)) { status.textContent = '背景格式無效，請輸入色碼或 CSS 漸層'; syncBackgroundFields(selected); return; }
    const before = captureSnap();
    updateBackground(value);
    syncBackgroundFields(selected);
    commitSnap(before);
  });
  function commitBackgroundMode(mode) {
    if (!selected) return;
    if (group.every(el => backgroundMode(el) === mode)) return;
    const before = captureSnap();
    if (mode === 'gradient') {
      if (!isHexColor(hexColor(gradientStart.value))) gradientStart.value = isHexColor(hexColor(solidColor.value)) ? hexColor(solidColor.value) : '#15100A';
      if (!isHexColor(hexColor(gradientEnd.value))) gradientEnd.value = '#5A3B16';
      setBgMode('gradient');
      updateGradient();
    } else {
      const color = isHexColor(hexColor(solidColor.value)) ? hexColor(solidColor.value) : '#15100A';
      solidColor.value = color;
      setBgMode('solid');
      updateBackground(color);
    }
    commitSnap(before);
  }
  if (bgSolidBtn) bgSolidBtn.addEventListener('click', () => commitBackgroundMode('solid'));
  if (bgGradientBtn) bgGradientBtn.addEventListener('click', () => commitBackgroundMode('gradient'));
  panel.querySelectorAll('[data-bg-angle]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!selected) return;
      const angle = String(btn.getAttribute('data-bg-angle') || '');
      const sameDirection = group.every(el => {
        const gradient = readSimpleGradient(backgroundSource(el));
        return gradient && String(gradient.angle) === angle;
      });
      if (sameDirection) return;
      const before = captureSnap();
      setGradientAngle(angle);
      setBgMode('gradient');
      updateGradient();
      commitSnap(before);
    });
  });
  function previewGradientInputs() {
    const start = hexColor(gradientStart.value), end = hexColor(gradientEnd.value);
    if (!selected || !isHexColor(start) || !isHexColor(end)) return;
    const value = gradientCss(start, end, gradientAngleValue);
    if (!CSS.supports('background', value)) return;
    group.forEach(node => writeBackground(node, value));
  }
  [gradientStart, gradientEnd].forEach(field => {
    field.addEventListener('input', () => { if (!cpLive) previewGradientInputs(); });
  });
  function colorFieldOf(target) {
    return target && target.closest ? target.closest('[data-color-picker]') : null;
  }
  function armColorGesture() {
    if (historyMute || historyLock || !active || colorBefore || (cpLive && cpLive.snap)) return;
    colorBefore = captureSnap();
  }
  function applyBackgroundColorField(field) {
    if (field === solidColor) {
      const value = hexColor(solidColor.value);
      if (!isHexColor(value)) return;
      solidColor.value = value;
      updateBackground(value);
      return;
    }
    if (field === gradientStart || field === gradientEnd) updateGradient();
  }
  function commitColorField(field) {
    if (!field || !field.matches || !field.matches('[data-color-picker]')) return;
    const before = (cpLive && cpLive.snap) || colorBefore;
    if (!before) return;
    applyBackgroundColorField(field);
    if (snapKey(before) === snapKey(captureSnap())) return;
    colorBefore = null;
    if (cpLive) {
      cpLive.applied = true;
      cpLive.snap = null;
    }
    commitSnap(before);
  }
  panel.addEventListener('focusin', event => {
    if (!colorFieldOf(event.target)) return;
    armColorGesture();
  });
  panel.addEventListener('input', event => {
    const field = colorFieldOf(event.target);
    if (!field) return;
    armColorGesture();
  });
  panel.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const field = colorFieldOf(event.target);
    if (!field) return;
    commitColorField(field);
  });
  panel.addEventListener('change', event => { commitColorField(event.target); });
  panel.addEventListener('focusout', event => {
    const field = event.target && event.target.matches && event.target.matches('[data-color-picker]') ? event.target : null;
    if (!field) return;
    setTimeout(() => {
      if (cpOpen()) return;
      commitColorField(field);
    }, 0);
  });
  function updateLight() {
    if (!selected) return;
    if (!pendingBefore) armHistory('light');
    lightOptions.hidden = !lightEnabled.checked;
    [lightX, lightY, lightStrength].forEach(input => { input.nextElementSibling.value = input.value + '%'; });
    const value = [lightX.value, lightY.value, lightStrength.value].join(',');
    group.forEach(node => {
      if (lightEnabled.checked) paintLight(node, value);
      else clearLight(node);
      saveTarget(node);
    });
    status.textContent = lightEnabled.checked ? '光源已更新' : '光源已關閉';
  }
  lightEnabled.addEventListener('change', () => { updateLight(); flushHistory(); });
  [lightX, lightY, lightStrength].forEach(input => {
    input.addEventListener('input', updateLight);
    input.addEventListener('pointerup', () => { if (pendingKind === 'light') setTimeout(flushHistory, 0); });
    input.addEventListener('keyup', () => { if (pendingKind === 'light') setTimeout(flushHistory, 0); });
  });
  const actions = document.getElementById('tvEditReset').parentNode;
  const actionButton = (id, text, fn) => { const b = document.createElement('button'); b.type = 'button'; b.id = id; b.textContent = text; b.addEventListener('click', fn); actions.insertBefore(b, document.getElementById('tvEditReset')); return b; };
  actionButton('tvEditSave', '儲存', () => { commitAll(); status.textContent = '已儲存'; });
  actionButton('tvEditCancel', '取消', event => {
    const choice = decideCancel(dirty, dirty ? askConfirm('放棄未儲存的變更，還原成上次儲存的畫面？', event) : true);
    if (choice === 'reload') discardAndReload();
  });
  actionButton('tvEditResetAll', '全部還原', event => {
    if (!askConfirm('確定清除這頁的編輯設定（含切格、面板位置）並還原成原本的畫面？已存的版本會保留。', event)) return;
    collectResetKeys(storageKeys()).filter(key => key !== SNAPSHOT_KEY).forEach(key => localStorage.removeItem(key));
    if (panelMem && panelMem.clear) panelMem.clear();
    if (root.CssControls.discardPending) root.CssControls.discardPending(PAGE_PREFIX);
    panelRectRollback = undefined;
    dirty = false;
    clearHistory();
    location.reload();
  });
  document.getElementById('tvEditReset').addEventListener('click', () => {
    if (!selected) return;
    const before = captureSnap();
    historyLock = true;
    const items = group.slice();
    let didSplit = false;
    const focus = [];
    items.forEach(el => {
      if (!el.isConnected) return;
      const cell = owningStatCell(el);
      if (cell && splitter && cell.classList.contains('cs-split')) {
        didSplit = true;
        const index = [...statList.children].indexOf(cell);
        splitter.reset(cell);
        if (index >= 0) tombstoneControlPrefix('split-' + index + '-');
        cell.querySelectorAll('*').forEach(node => { if (originals.has(node)) restore(node); });
        restore(cell);
        focus.push(cell);
      } else {
        restore(el);
        focus.push(el);
      }
    });
    const next = focus.reverse().find(el => el.isConnected) || null;
    group.forEach(el => { if (el.classList) el.classList.remove('tv-edit-selected'); });
    group = [];
    selected = null;
    if (cssPanel) { cssPanel.destroy(); cssPanel = null; }
    if (next) select(next);
    else if (splitTools) splitTools.update();
    status.textContent = didSplit ? '此項已還原為原始樣式、文字與切格' : '此項已還原為原始樣式與文字';
    historyLock = false;
    commitSnap(before);
  });
  function collectControls() {
    const out = {};
    storageKeys().forEach(key => {
      if (key.indexOf(CONTROLS_PREFIX) !== 0 || tombstones.has(key)) return;
      const parsed = readJson(key);
      if (parsed && isPlain(parsed.values)) out[key.slice(CONTROLS_PREFIX.length)] = parsed.values;
    });
    Object.keys(stagedControls).forEach(id => { if (isPlain(stagedControls[id])) out[id] = stagedControls[id]; });
    const live = readLiveControlBag();
    if (live && isPlain(live.values)) { out[live.id] = live.values; stagedControls[live.id] = live.values; }
    return out;
  }
  function currentSplits() {
    if (!splitter || !statList) return {};
    const out = {};
    [...statList.querySelectorAll(':scope > li')].forEach((cell, index) => {
      const tree = splitter.tree(index);
      if (tree) out[String(index)] = JSON.parse(JSON.stringify(tree));
    });
    return out;
  }
  function currentBundle() {
    const panelSaved = readJson(PANEL_RECT_KEY);
    const fontSaved = readJson(FP_KEY);
    return makeVersionBundle({
      settings: settings,
      splits: currentSplits(),
      controls: collectControls(),
      panel: stagedPanelRect || (isPlain(panelSaved) ? panelSaved : null),
      fontPanel: fpPending || (isPlain(fontSaved) ? fontSaved : null)
    });
  }
  function currentPreviewEntries() {
    const bundle = currentBundle();
    return previewEntries({
      settings: bundle.settings,
      splits: bundle.splits,
      controls: bundle.controls,
      panel: bundle.panel,
      fontPanel: bundle.fontPanel,
      snapshots: snapshots.snapshots
    });
  }
  document.getElementById('tvEditExport').addEventListener('click', () => {
    const result = root.exportSettings({ download: true, filename: 'tv-edit-mode-settings.json', prefixes: ['tv-edit'], storage: storageFromEntries(currentPreviewEntries()) });
    status.textContent = '已匯出 ' + result.count + ' 項設定（含目前預覽）';
  });
  function reloadSplits(trees, persistSplits) {
    if (!splitter) return;
    const payload = JSON.stringify(trees || {});
    if (persistSplits) { localStorage.setItem(SPLITS_KEY, payload); splitter.reload(); return; }
    const prev = localStorage.getItem(SPLITS_KEY);
    localStorage.setItem(SPLITS_KEY, payload);
    try { splitter.reload(); }
    finally {
      if (prev == null) localStorage.removeItem(SPLITS_KEY);
      else localStorage.setItem(SPLITS_KEY, prev);
    }
  }
  function revertKnown() {
    document.querySelectorAll(ROOT).forEach(el => { if (originals.has(el)) writeBaseline(el, originals.get(el)); });
  }
  function repaint(trees, persistSplits) {
    revertKnown();
    document.querySelectorAll(ROOT).forEach(el => { if (!(el.closest && el.closest('.cs-root'))) applySaved(el); });
    reloadSplits(trees || {}, !!persistSplits);
    resyncSelection();
  }
  function findByEditId(id) {
    if (!id) return null;
    const all = document.querySelectorAll('[data-tv-edit-id]');
    for (const el of all) if (el.dataset.tvEditId === id) return el;
    return null;
  }
  function resyncSelection() {
    const selectedId = selected && selected.dataset ? selected.dataset.tvEditId : '';
    if (selected && !selected.isConnected) selected = findByEditId(selectedId);
    group = group.filter(el => el.isConnected);
    if (selected && group.indexOf(selected) < 0) group = [selected];
    if (!selected && group.length) selected = group[group.length - 1];
    group.forEach(el => { if (el !== selected && el.classList) el.classList.remove('tv-edit-selected'); });
    if (selected && selected.classList) selected.classList.add('tv-edit-selected');
    if (selected) { renderControls(); if (splitTools) splitTools.update(); }
    else { updateLayerButtons(); if (splitTools) splitTools.update(); }
  }
  function replaceStagedControls(controls) {
    if (root.CssControls.discardPending) root.CssControls.discardPending(CONTROLS_PREFIX);
    const keep = new Set(Object.keys(controls || {}));
    tombstones.clear();
    storageKeys().forEach(key => {
      if (key.indexOf(CONTROLS_PREFIX) !== 0) return;
      if (!keep.has(key.slice(CONTROLS_PREFIX.length))) tombstones.add(key);
    });
    stagedControls = {};
    Object.keys(controls || {}).forEach(id => { if (isPlain(controls[id])) stagedControls[id] = controls[id]; });
  }
  function stagePanelRect(rect) {
    if (!isPlain(rect)) return;
    if (panelRectRollback === undefined) panelRectRollback = localStorage.getItem(PANEL_RECT_KEY);
    stagedPanelRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    try { localStorage.setItem(PANEL_RECT_KEY, JSON.stringify(stagedPanelRect)); } catch (_) {}
    stagedPanelRect = null;
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
    panel.style.left = rect.left + 'px'; panel.style.top = rect.top + 'px';
    if (rect.width) panel.style.width = rect.width + 'px';
    if (rect.height) panel.style.height = rect.height + 'px';
  }
  function applyEditBundle(bundle, persistSplits) {
    const next = makeVersionBundle(bundle);
    settings = next.settings;
    fpPending = next.fontPanel;
    if (next.panel) stagePanelRect(next.panel);
    replaceStagedControls(next.controls);
    repaint(next.splits, persistSplits);
  }
  function reloadCommitted() {
    if (root.CssControls.discardPending) root.CssControls.discardPending(PAGE_PREFIX);
    stagedControls = {};
    tombstones.clear();
    stagedPanelRect = null;
    fpPending = null;
    try { settings = sanitizeSettings(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { settings = {}; }
    const splits = readJson(SPLITS_KEY);
    repaint(isPlain(splits) ? splits : {}, true);
    if (panelMem && localStorage.getItem(PANEL_RECT_KEY)) panelMem.restore();
    else { panel.style.left = ''; panel.style.top = ''; panel.style.width = ''; panel.style.height = ''; }
    dirty = false;
    savedSig = stateSignature();
    clearHistory();
  }
  const importFile = document.getElementById('tvEditImportFile');
  document.getElementById('tvEditImport').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async event => {
    const file = importFile.files && importFile.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const validateImport = root.SettingsIO && root.SettingsIO.validateImportData;
      if (validateImport) {
        const schema = validateImport(data);
        if (!schema.valid) throw new Error(schema.error);
      }
      const shape = validatePageSettings(data.settings || {});
      if (shape) throw new Error(shape);
      const plan = planStorageReplace(storageKeys(), data.settings || {});
      if (!plan.write.length) throw new Error('檔案沒有這頁的編輯設定');
      const removeKeys = plan.remove.filter(key => key !== SNAPSHOT_KEY);
      const mustConfirm = dirty || removeKeys.length > 0;
      const accepted = mustConfirm ? askConfirm('會用檔案內容取代這頁目前的編輯設定，檔案裡沒有的設定會被清除（已存的版本會保留）', event) : true;
      const choice = decideImport(dirty, accepted);
      if (!accepted || choice === 'stay') { status.textContent = '已取消匯入'; return; }
      const result = root.importSettings(data, plan.write, { prefixes: ['tv-edit'] });
      if (!result.success) throw new Error(result.error);
      removeKeys.forEach(key => localStorage.removeItem(key));
      reloadCommitted();
      snapshots.snapshots = snapshots.read();
      renderVersions();
      status.textContent = '已匯入 ' + result.importedCount + ' 項設定';
    } catch (error) { status.textContent = '匯入失敗：' + (error && error.message ? error.message : '格式不正確'); }
    finally { importFile.value = ''; }
  });
  function renderVersions() {
    const host = versionsHost || panel.querySelector('#tvEditVersions'); host.replaceChildren();
    snapshots.snapshots.forEach(item => {
      const row = document.createElement('div'); row.className = 'tv-edit-version-row';
      const b = document.createElement('button'); b.type = 'button'; b.textContent = '還原：' + item.name;
      b.addEventListener('click', event => restoreVersion(item.id, event));
      const del = document.createElement('button'); del.type = 'button'; del.className = 'tv-edit-version-delete'; del.textContent = '刪除';
      del.addEventListener('click', event => {
        if (!askConfirm('確定刪除版本「' + item.name + '」？', event)) return;
        snapshots.remove(item.id);
        renderVersions();
        status.textContent = '已刪除版本 ' + item.name;
      });
      row.appendChild(b); row.appendChild(del); host.appendChild(row);
    });
  }
  function restoreVersion(id, event) {
    const snap = snapshots.get(id);
    if (!snap) { status.textContent = '找不到快照'; return; }
    const choice = decideVersionRestore(dirty, dirty ? askConfirm('還原版本會取代目前未儲存的預覽，要按「儲存」才會寫入。按「確定」繼續。', event) : true);
    if (choice === 'stay') { status.textContent = '已取消還原版本'; return; }
    const before = captureSnap();
    historyLock = true;
    try {
      if (classifySnapshot(snap) === 'edit') {
        applyEditBundle(snap.edit, false);
        dirty = true;
        status.textContent = '已還原版本 ' + snap.name + '（尚未儲存）';
      } else {
        snapshots.restore(id);
        ['.tv-table-board', '.tv-limit', '.tv-stats'].forEach(selector => {
          const el = document.querySelector(selector);
          if (el) saveTarget(el);
        });
        dirty = true;
        if (selected) renderControls();
        status.textContent = '已還原舊版外層樣式 ' + snap.name + '（尚未儲存）';
      }
    } finally {
      historyLock = false;
      commitSnap(before);
    }
  }
  document.getElementById('tvEditSnapshot').addEventListener('click', event => {
    const name = askPrompt('版本名稱', '桌牌樣式 ' + new Date().toLocaleString(), event); if (!name) return;
    try { saveEditVersion(snapshots, name, currentBundle()); renderVersions(); status.textContent = '版本已儲存，按儲存才會寫入目前畫面'; }
    catch (error) { status.textContent = '無法儲存版本：' + error.message; }
  });
  renderVersions();
  panelHead.addEventListener('pointerdown', event => { if (event.button !== 0 || event.target.closest('button')) return; event.preventDefault(); const r = panel.getBoundingClientRect(); drag = { x: event.clientX - r.left, y: event.clientY - r.top }; panelHead.setPointerCapture(event.pointerId); });
  panelHead.addEventListener('pointermove', event => { if (!drag) return; panel.style.left = Math.max(0, Math.min(panelViewport().width - panel.offsetWidth, event.clientX - drag.x)) + 'px'; panel.style.top = Math.max(0, Math.min(panelViewport().height - panel.offsetHeight, event.clientY - drag.y)) + 'px'; });
  let onPanelHeadUp = () => { if (drag) avoidToggle(); drag = null; };
  panelHead.addEventListener('pointerup', () => onPanelHeadUp());
  panelMem = root.PanelMemory && root.PanelMemory.attach(panel, { handle: panelHead, key: PANEL_RECT_KEY, minWidth: 300, minHeight: 220 });
  const topResize = document.createElement('div');
  topResize.className = 'tv-edit-top-resize';
  topResize.title = '拖曳調整面板大小';
  topResize.setAttribute('role', 'separator');
  topResize.setAttribute('aria-orientation', 'horizontal');
  panel.insertBefore(topResize, panel.firstChild);
  const panelMinW = 300, panelMinH = 220, panelMargin = 8;
  function panelViewport() {
    const owner = panel.ownerDocument.defaultView || window;
    const visual = owner.visualViewport;
    const width = Math.min(owner.innerWidth, visual && visual.width ? visual.width : owner.innerWidth);
    const height = Math.min(owner.innerHeight, visual && visual.height ? visual.height : owner.innerHeight);
    const left = visual ? visual.offsetLeft : 0;
    const top = visual ? visual.offsetTop : 0;
    return { left: left, top: top, width: width, height: height };
  }
  let fittingPanel = false;
  let sizingPanel = null;
  function fitEditPanel() {
    if (fittingPanel || sizingPanel || !panel || panel.hidden || (!isPopped() && panel.hasAttribute('data-pm-suspend'))) return;
    const view = panelViewport();
    const maxW = Math.max(panelMinW, view.width - panelMargin * 2);
    const maxH = Math.max(panelMinH, view.height - panelMargin * 2);
    const rect = panel.getBoundingClientRect();
    let width = Math.min(Math.max(rect.width, panelMinW), maxW);
    let height = Math.min(Math.max(rect.height, panelMinH), maxH);
    let left = rect.left, top = rect.top;
    if (left + width > view.left + view.width - panelMargin) left = view.left + view.width - panelMargin - width;
    if (top + height > view.top + view.height - panelMargin) top = view.top + view.height - panelMargin - height;
    if (left < view.left + panelMargin) left = view.left + panelMargin;
    if (top < view.top + panelMargin) top = view.top + panelMargin;
    if (Math.abs(rect.left - left) < 0.5 && Math.abs(rect.top - top) < 0.5 && Math.abs(rect.width - width) < 0.5 && Math.abs(rect.height - height) < 0.5 && panel.style.maxHeight === maxH + 'px') return;
    fittingPanel = true;
    try {
      panel.style.left = left + 'px'; panel.style.top = top + 'px';
      panel.style.width = width + 'px'; panel.style.height = height + 'px';
      panel.style.maxWidth = maxW + 'px'; panel.style.maxHeight = maxH + 'px';
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
    } finally { fittingPanel = false; }
  }
  let fitFrame = 0;
  function scheduleFitPanel() { if (fitFrame) return; fitFrame = requestAnimationFrame(() => { fitFrame = 0; fitEditPanel(); }); }
  new MutationObserver(scheduleFitPanel).observe(panel, { attributes: true, attributeFilter: ['hidden', 'style'] });
  window.addEventListener('resize', scheduleFitPanel);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleFitPanel);
  function applyPanelBox(left, top, width, height) {
    const view = panelViewport();
    const maxW = Math.max(panelMinW, view.width - panelMargin * 2);
    const maxH = Math.max(panelMinH, view.height - panelMargin * 2);
    width = Math.min(Math.max(width, panelMinW), maxW);
    height = Math.min(Math.max(height, panelMinH), maxH);
    left = Math.max(view.left + panelMargin, Math.min(left, view.left + view.width - panelMargin - width));
    top = Math.max(view.top + panelMargin, Math.min(top, view.top + view.height - panelMargin - height));
    panel.style.left = left + 'px'; panel.style.top = top + 'px';
    panel.style.width = width + 'px'; panel.style.height = height + 'px';
    panel.style.maxWidth = maxW + 'px'; panel.style.maxHeight = maxH + 'px';
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
  }
  topResize.addEventListener('pointerdown', event => {
    if (event.button !== 0 || (!isPopped() && panel.hasAttribute('data-pm-suspend'))) return;
    event.preventDefault(); event.stopPropagation();
    const rect = panel.getBoundingClientRect();
    const edge = event.offsetX < 18 ? 'left' : (event.offsetX > topResize.clientWidth - 18 ? 'right' : '');
    sizingPanel = { x: event.clientX, y: event.clientY, l: rect.left, t: rect.top, w: rect.width, h: rect.height, b: rect.bottom, edge: edge };
    topResize.setPointerCapture(event.pointerId);
  });
  topResize.addEventListener('pointermove', event => {
    if (!sizingPanel) return;
    const dy = event.clientY - sizingPanel.y, dx = event.clientX - sizingPanel.x;
    let top = sizingPanel.t + dy, height = sizingPanel.b - top, left = sizingPanel.l, width = sizingPanel.w;
    if (height < panelMinH) { height = panelMinH; top = sizingPanel.b - panelMinH; }
    if (sizingPanel.edge === 'left') { left = sizingPanel.l + dx; width = sizingPanel.w - dx; if (width < panelMinW) { width = panelMinW; left = sizingPanel.l + sizingPanel.w - panelMinW; } }
    else if (sizingPanel.edge === 'right') width = Math.max(panelMinW, sizingPanel.w + dx);
    applyPanelBox(left, top, width, height);
  });
  topResize.addEventListener('pointerup', () => {
    if (!sizingPanel) return;
    sizingPanel = null;
    if (isPopped()) rememberPopoutPanel();
    else if (panelMem && panelMem.save) panelMem.save();
  });
  topResize.addEventListener('pointercancel', () => { sizingPanel = null; });
  onPanelHeadUp = () => { if (drag) { if (!isPopped()) avoidToggle(); fitEditPanel(); if (isPopped()) rememberPopoutPanel(); } drag = null; };
  panelHead.addEventListener('pointercancel', () => { drag = null; });
  // PanelMemory is suspended while detached, so use the popup viewport and its own geometry.
  const popoutGrip = panel.querySelector('.pm-grip');
  let popoutSizing = null;
  if (popoutGrip) {
    popoutGrip.addEventListener('pointerdown', event => {
      if (!isPopped() || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      const r = panel.getBoundingClientRect();
      popoutSizing = { x:event.clientX, y:event.clientY, left:r.left, top:r.top, width:r.width, height:r.height };
      popoutGrip.setPointerCapture(event.pointerId);
    });
    popoutGrip.addEventListener('pointermove', event => {
      if (!popoutSizing) return;
      const r = popoutSizing;
      applyPanelBox(r.left,r.top,r.width+event.clientX-r.x,r.height+event.clientY-r.y);
    });
    const finishPopoutResize = () => { if (!popoutSizing) return; popoutSizing=null; rememberPopoutPanel(); };
    popoutGrip.addEventListener('pointerup',finishPopoutResize);
    popoutGrip.addEventListener('pointercancel',finishPopoutResize);
  }
  function rememberPopoutPanel() {
    if (!isPopped()) return;
    const r=panel.getBoundingClientRect();
    try { localStorage.setItem(POPOUT_PANEL_RECT_KEY,JSON.stringify({left:r.left,top:r.top,width:r.width,height:r.height})); } catch (_) {}
  }
  function onEditKey(event) {
    const target = event.target;
    const typing = !!(target && (target.isContentEditable || (target.matches && target.matches('input, textarea, select'))));
    const inField = !!(target && target.matches && target.matches('input, textarea'));
    const key = event.key || '';
    const command = event.ctrlKey || event.metaKey;
    if (command && !event.altKey && active && (key === 'z' || key === 'Z' || key === 'y' || key === 'Y')) {
      if (typing) return;
      event.preventDefault();
      if (key === 'y' || key === 'Y' || event.shiftKey) redoHistory();
      else undoHistory();
      return;
    }
    if (event.altKey && !command && active && (key === 'ArrowUp' || key === 'ArrowDown')) {
      if (typing) return;
      event.preventDefault();
      if (key === 'ArrowUp') selectParentLayer();
      else selectChildLayer();
      return;
    }
    if (event.altKey && key.toLowerCase() === 'e') {
      if (inField) return;
      event.preventDefault(); toggle.click();
    }
    if (event.key !== 'Escape') return;
    if (fontRoots().some(node => !node.hidden)) { closeFontPicker(); return; }
    if (typing || !active || cpOpen()) return;
    tryLeaveEdit(event);
  }
  document.addEventListener('keydown', onEditKey);
  window.addEventListener('beforeunload', event => { if (!dirty) return; event.preventDefault(); event.returnValue = ''; });
  window.addEventListener('pagehide', event => {
    if (!event.persisted) rollbackPanelRect();
    if (popoutWin && !popoutWin.closed) {
      const win = popoutWin;
      popoutWin = null;
      try { win.close(); } catch (_) {}
    }
  });
  function copyStyleSheet(node, doc) {
    if (!node || !doc || node.nodeType !== 1) return;
    if (node.tagName === 'LINK') {
      if (String(node.rel || '').toLowerCase() !== 'stylesheet') return;
      const href = node.href || '';
      if (!href) return;
      if ([...doc.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === href)) return;
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      if (node.media) link.media = node.media;
      if (node.crossOrigin) link.crossOrigin = node.crossOrigin;
      doc.head.appendChild(link);
      return;
    }
    if (node.tagName === 'STYLE') {
      const style = doc.createElement('style');
      if (node.media) style.media = node.media;
      style.textContent = node.textContent;
      doc.head.appendChild(style);
    }
  }
  function readPopoutRect() {
    const saved = readJson(POPOUT_RECT_KEY);
    if (!isPlain(saved)) return null;
    const width = Number(saved.width), height = Number(saved.height);
    if (!(width >= 320) || !(height >= 240)) return null;
    const rect = { width: Math.round(width), height: Math.round(height) };
    if (isFinite(Number(saved.left)) && isFinite(Number(saved.top))) {
      rect.left = Math.round(Number(saved.left));
      rect.top = Math.round(Number(saved.top));
    }
    return rect;
  }
  function rememberPopoutNow() {
    const win = popoutWin;
    if (!win || win.closed) return;
    let rect;
    try {
      rect = { left: Math.round(win.screenX), top: Math.round(win.screenY), width: Math.max(320, Math.round(win.innerWidth)), height: Math.max(240, Math.round(win.innerHeight)) };
    } catch (_) { return; }
    try { localStorage.setItem(POPOUT_RECT_KEY, JSON.stringify(rect)); } catch (_) {}
  }
  function syncPopoutButton() {
    if (!popoutBtn) return;
    const on = isPopped();
    popoutBtn.textContent = on ? '收回面板' : '彈出面板';
    popoutBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  function stopStyleObserver() {
    if (!popoutStyleObserver) return;
    popoutStyleObserver.disconnect();
    popoutStyleObserver = null;
  }
  function suspendPanelChrome() {
    panel.setAttribute('data-pm-suspend', '');
    ['left', 'top', 'right', 'bottom', 'width', 'height', 'maxWidth', 'maxHeight'].forEach(key => { panel.style[key] = ''; });
  }
  function resumePanelChrome() {
    ['left','top','right','bottom','width','height','maxWidth','maxHeight'].forEach(key => { panel.style[key] = ''; });
    panel.removeAttribute('data-pm-suspend');
    if (panelMem && panelMem.restore()) return;
    if (selected && active) placePanel(selected);
  }
  function movePopoverTo(doc) {
    const picker = root.ColorPicker;
    const pop = picker && picker.popover;
    if (!pop || !doc || !doc.body || pop.ownerDocument === doc) return;
    doc.body.appendChild(doc.adoptNode(pop));
    if (pop.classList.contains('cp-open') && picker.targetInput && picker.positionPopover) picker.positionPopover(picker.targetInput);
  }
  function restorePopoutNodes() {
    if (panel.ownerDocument !== document && panelHome && panelHome.parent) {
      const node = document.adoptNode(panel);
      if (panelHome.next && panelHome.next.parentNode === panelHome.parent) panelHome.parent.insertBefore(node, panelHome.next);
      else panelHome.parent.appendChild(node);
    }
    fontRoots().forEach(fp => {
      if (fp.ownerDocument !== document) document.body.appendChild(document.adoptNode(fp));
      placeFontPicker(fp);
    });
    movePopoverTo(document);
    if (panel.ownerDocument === document) resumePanelChrome();
  }
  function onPopoutHide() {
    if (!popoutWin) return;
    rememberPopoutNow();
    rememberPopoutPanel();
    restorePopoutNodes();
    stopStyleObserver();
    popoutWin = null;
    syncPopoutButton();
  }
  function watchMainStyles(doc) {
    stopStyleObserver();
    popoutStyleObserver = new MutationObserver(records => {
      if (!popoutWin || popoutWin.closed || popoutWin.document !== doc) return;
      records.forEach(record => record.addedNodes.forEach(node => copyStyleSheet(node, doc)));
    });
    popoutStyleObserver.observe(document.head, { childList: true });
  }
  function moveIntoPopout(doc) {
    suspendPanelChrome();
    doc.body.appendChild(doc.adoptNode(panel));
    const saved = readJson(POPOUT_PANEL_RECT_KEY);
    const r = isPlain(saved) ? saved : {left:16,top:16,width:380,height:720};
    applyPanelBox(Number(r.left)||16,Number(r.top)||16,Number(r.width)||380,Number(r.height)||720);
    fontRoots().forEach(fp => {
      if (fp.ownerDocument !== doc) doc.body.appendChild(doc.adoptNode(fp));
      parkFontPicker(fp);
    });
    movePopoverTo(doc);
  }
  function bindPopoutWindow(win) {
    const doc = win.document;
    if (root.ColorPicker && root.ColorPicker.attachDocument) root.ColorPicker.attachDocument(doc);
    doc.addEventListener('click', onColorFieldClick);
    doc.addEventListener('keydown', onEditKey);
    win.addEventListener('pointerup', () => { if (fontBefore) setTimeout(flushFont, 0); });
    win.addEventListener('mousemove', cpSchedule);
    win.addEventListener('resize', () => { rememberPopoutNow(); scheduleFitPanel(); });
    if (win.visualViewport) win.visualViewport.addEventListener('resize', scheduleFitPanel);
    win.addEventListener('pagehide', onPopoutHide);
  }
  function preparePopoutDocument(win) {
    const doc = win.document;
    doc.open();
    doc.write('<!DOCTYPE html><html lang="zh-Hant" class="tv-edit-popout"><head><meta charset="utf-8"><title>edit</title><link rel="icon" href="data:,"></head><body></body></html>');
    doc.close();
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => copyStyleSheet(node, doc));
    doc.documentElement.classList.add('tv-edit-popout');
    doc.title = '編輯面板';
    moveIntoPopout(doc);
    bindPopoutWindow(win);
    watchMainStyles(doc);
  }
  function openPopout() {
    if (isPopped()) { try { popoutWin.focus(); } catch (_) {} return; }
    historyMute += 1;
    try { openPopoutNow(); }
    finally { historyMute -= 1; }
  }
  function openPopoutNow() {
    const saved = readPopoutRect();
    const width = saved ? saved.width : 1280;
    const height = saved ? saved.height : 900;
    let features = 'popup=yes,resizable=yes,scrollbars=yes,width=' + width + ',height=' + height;
    if (saved && saved.left != null && saved.top != null) features += ',left=' + saved.left + ',top=' + saved.top;
    let win = null;
    try { win = window.open('', 'tvEditPopout', features); } catch (_) { win = null; }
    if (!win || win.closed) {
      status.textContent = '瀏覽器擋住了彈出視窗，請允許此網站的彈出視窗';
      return;
    }
    popoutWin = win;
    try { preparePopoutDocument(win); }
    catch (_) {
      popoutWin = null;
      try { win.close(); } catch (__) {}
      status.textContent = '瀏覽器擋住了彈出視窗，請允許此網站的彈出視窗';
      return;
    }
    syncPopoutButton();
    setTimeout(rememberPopoutNow, 300);
  }
  function dockPopout() {
    historyMute += 1;
    try { dockPopoutNow(); }
    finally { historyMute -= 1; }
  }
  function dockPopoutNow() {
    const win = popoutWin;
    if (!win) return;
    rememberPopoutNow();
    rememberPopoutPanel();
    restorePopoutNodes();
    stopStyleObserver();
    popoutWin = null;
    syncPopoutButton();
    if (!win.closed) { try { win.close(); } catch (_) {} }
  }
  if (popoutBtn) popoutBtn.addEventListener('click', () => { if (isPopped()) dockPopout(); else openPopout(); });
  // 先記住真正的預設 DOM／樣式，再套用已存編輯。重開後重設才不會把已改樣式當成原點。
  function restoreSavedAfterBaseline() {
    const elements = [...document.querySelectorAll(ROOT)];
    captureThenApply(elements, captureOriginal, applySaved);
  }
  window.addEventListener('load', restoreSavedAfterBaseline);
  const statList = document.querySelector('.tv-stats .stats-list');
  const splitter = root.CellSplitter && statList ? root.CellSplitter.create({
    cells: () => statList.querySelectorAll(':scope > li'), observe: statList, storageKey: SPLITS_KEY,
    parts: {
      prefix: { source: li => li.querySelector(':scope > .k .tv-stat-prefix'), className: 'tv-stat-prefix' },
      main: { source: li => li.querySelector(':scope > .k .tv-stat-main'), className: 'tv-stat-main' },
      label: { source: li => (li.querySelector(':scope > .k .tv-stat-main') ? null : li.querySelector(':scope > .k')) },
      count: { source: li => li.querySelector(':scope > b') }
    },
    leafKind: parts => (parts.length === 1 && parts[0] === 'count' ? 'count' : 'label'),
    fontSource: (li, kind) => li.querySelector(kind === 'count' ? ':scope > b' : ':scope > .k'),
    autoSave: false, idAttr: 'data-tv-edit-id', leafId: (i, path) => 'split-' + i + '-' + path,
    isEditing: () => active, onLeafCreated: el => { captureOriginal(el); applySaved(el); },
    onDropIds: prefix => { Object.keys(settings).forEach(k => { if (k.startsWith(prefix)) delete settings[k]; }); persist(); },
    styleStore: { get: id => (settings[id] ? JSON.parse(JSON.stringify(settings[id])) : null), set: (id, value) => { const clean = sanitizeSettings({ [id]: value })[id]; if (clean) settings[id] = clean; else delete settings[id]; persist(); } },
    onStatus: message => {
      if (message && message !== '請先選一個切出來的小塊') persist();
      status.textContent = message === '切線位置已儲存' ? '切線位置已更新（尚未儲存）' : message;
    }
  }) : null;
  if (splitter) {
    ['split', 'merge', 'reset', 'setContent'].forEach(name => {
      const orig = splitter[name];
      if (typeof orig !== 'function') return;
      splitter[name] = function () {
        const before = historyLock ? null : captureSnap();
        const result = orig.apply(splitter, arguments);
        if (name === 'setContent') persist();
        commitSnap(before);
        return result;
      };
    });
    if (typeof splitter.setText === 'function') {
      const origText = splitter.setText;
      splitter.setText = function () {
        if (!historyLock && !textBefore) textBefore = captureSnap();
        const result = origText.apply(splitter, arguments);
        persist();
        if (textTimer) clearTimeout(textTimer);
        textTimer = setTimeout(flushText, 600);
        return result;
      };
    }
  }
  document.addEventListener('pointerdown', event => {
    const node = event.target;
    if (!active || !node || !node.closest || !node.closest('.cs-bar')) return;
    armHistory('split');
  }, true);
  window.addEventListener('pointerup', () => {
    if (fontBefore) setTimeout(flushFont, 0);
    if (pendingKind === 'split') setTimeout(flushHistory, 0);
  });
  controlsMount.addEventListener('pointerdown', event => {
    const node = event.target;
    if (!node || !node.closest) return;
    if (node.closest('.tv-slider-bar, input[type="number"], input[type="range"], [data-color-picker], .tv-edit-font-button, .tv-edit-workbench-button')) return;
    if (node.closest('button, input[type="checkbox"]')) armHistory('control');
  }, true);
  controlsMount.addEventListener('click', () => { if (pendingKind === 'control') setTimeout(flushHistory, 0); });
  controlsMount.addEventListener('change', () => { if (pendingKind === 'control') setTimeout(flushHistory, 0); });
  savedSig = stateSignature();
  updateHistoryButtons();
  updateLayerButtons();
  const splitTools = splitter ? root.CellSplitter.createTools(splitter, {
    getSelected: () => (group.length < 2 ? selected : null), isActive: () => active, onSelect: el => select(el), onStatus: message => { status.textContent = message; }
  }) : null;
  if (splitTools) controlsMount.parentNode.insertBefore(splitTools.el, controlsMount);
  if (new URLSearchParams(location.search).get('check') === '1') {
    window.tvEditModeCheck = async function () {
      const board = document.querySelector('.tv-table-board'), cell = board && board.querySelector('.tv-board-title-en');
      const checks = []; const check = (name, ok) => checks.push({ name: name, ok: !!ok });
      const realKey = KEY; KEY = 'tv-edit-mode-check:settings';
      try {
        const checkSnapshots = new root.VersionSnapshot({ key: 'tv-edit-mode-check:snapshots', selectors: ['.tv-table-board'], properties: ['color'] });
        check('共用元件已載入', !!(root.CssControls && root.ColorPicker && root.FontPicker && root.VersionSnapshot && root.exportSettings && root.importSettings));
        setActive(true); if (cell) select(cell); check('牌桌標題可被選取', selected === cell);
        if (cell) {
          const origin = captureOriginal(cell);
          cell.style.color = 'rgb(15, 35, 55)'; syncEditColorAttr(cell); saveTarget(cell); writeSettings(); check('字色變更作用於目標', getComputedStyle(cell).color === 'rgb(15, 35, 55)');
          cell.style.fontSize = '29px'; cell.style.border = '2px solid rgb(5, 15, 25)'; cell.style.backgroundColor = 'rgb(210, 220, 230)';
          check('字級、背景與框線可調', getComputedStyle(cell).fontSize === '29px' && getComputedStyle(cell).borderTopWidth === '2px' && getComputedStyle(cell).backgroundColor === 'rgb(210, 220, 230)');
          const exported = root.exportSettings({ download: false, prefixes: [KEY] }); check('匯出包含設定', exported.count > 0 && !!exported.settings[KEY]);
          check('設定寫入 localStorage', !!JSON.parse(localStorage.getItem(KEY) || '{}')[getId(cell)]);
          restore(cell); check('重設恢復原始值', getComputedStyle(cell).color === origin.computed.color && getComputedStyle(cell).fontSize === origin.computed.fontSize);
          check('版本快照可儲存', !!checkSnapshots.capture('自動檢查').id);
        }
        check('動態局數欄位鎖定', !editableText(document.getElementById('tvTopRoundCount')));
        setActive(false); document.body.classList.add('tv-edit-export');
      } finally {
        KEY = realKey; dirty = false; try { localStorage.removeItem('tv-edit-mode-check:settings'); localStorage.removeItem('tv-edit-mode-check:snapshots'); } catch (_) {}
      }
      const box = document.createElement('div'); box.id = 'tvEditCheckResult'; box.style.cssText = 'position:fixed;z-index:20000;right:8px;bottom:8px;background:#10110f;color:#f4dfa4;border:1px solid #a67c35;padding:10px 14px;font:14px "Noto Serif TC"';
      box.textContent = checks.map(x => (x.ok ? 'OK' : 'FAIL') + ' ' + x.name).join(' · '); document.body.appendChild(box); window.tvEditModeCheckResults = checks;
      return checks;
    };
    window.addEventListener('load', () => setTimeout(() => window.tvEditModeCheck(), 350));
  }
})(typeof window !== 'undefined' ? window : globalThis);
