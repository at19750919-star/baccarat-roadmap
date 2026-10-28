// TV-only layout and settings; road rules and rendering remain in app.js.
(function () {
  const animalArt = Object.freeze({
    small: Object.freeze({ src: 'assets/beads/cat-v2.png', label: '小老虎', english: 'SMALL TIGER' }),
    big: Object.freeze({ src: 'assets/beads/tiger-v4.png', label: '大老虎', english: 'BIG TIGER' })
  });
  window.BaccaratAnimalArt = animalArt;
  const STORAGE_KEY = 'baccarat_tv_settings_v1';
  const KEY_BINDINGS_STORAGE_KEY = 'baccarat_key_bindings_v1';
  const defaultKeyBindings = Object.freeze({
    keyB: '1',
    keyP: '2',
    keyT: '3',
    keyBP: '4',
    keyPP: '5',
    keyL6: '6',
    keyTiger: '6',
    keySeven: '2',
    keyConfirm: 'Enter',
    keyUndo: 'Backspace',
    keyLimit: '7',
    keyBoss: '8',
    keyClear: '9',
    keyFullscreen: 'F',
    autoCommit: true,
    autoCommitDelay: 0.38
  });
  let currentKeyBindings = { ...defaultKeyBindings };
  try {
    const savedKeys = localStorage.getItem(KEY_BINDINGS_STORAGE_KEY);
    if (savedKeys) currentKeyBindings = Object.assign({}, defaultKeyBindings, JSON.parse(savedKeys));
  } catch (_) {}

  function updateKeyLegend(b) {
    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    const kb = b || currentKeyBindings;
    const tigerKey = kb.keyTiger || kb.keyL6 || '6';
    const sevenKey = kb.keySeven || kb.keyP || '2';
    setTxt('legendKeyB', kb.keyB);
    setTxt('legendKeyP', kb.keyP);
    setTxt('legendKeyT', kb.keyT);
    setTxt('legendKeyBP', kb.keyBP);
    setTxt('legendKeyPP', kb.keyPP);
    setTxt('legendKeyL6', kb.keyL6);
    setTxt('legendKeyST', String(tigerKey).repeat(2));
    setTxt('legendKeyBT', String(tigerKey).repeat(3));
    setTxt('legendKeyL72', String(sevenKey).repeat(2));
    setTxt('legendKeyL73', String(sevenKey).repeat(3));
    setTxt('legendKeyS7', String(sevenKey).repeat(4) + '~');

    const fmtKey = k => {
      if (!k) return '';
      if (k === 'Enter' || k === 'NumpadEnter') return '⏎';
      if (k === 'Backspace') return '⌫';
      return k;
    };
    const fmtDoubleKey = (k, fallback) => {
      const val = String(k || fallback || '').trim();
      if (!val) return '';
      if (val.length === 1) return val.repeat(2);
      if (val.length === 2 && val[0] === val[1]) return val;
      return val;
    };
    setTxt('legendKeyConfirm', fmtKey(kb.keyConfirm || 'Enter'));
    setTxt('legendKeyUndo', fmtKey(kb.keyUndo || 'Backspace'));
    setTxt('legendKeyLimit', fmtDoubleKey(kb.keyLimit, '7'));
    setTxt('legendKeyBoss', fmtDoubleKey(kb.keyBoss, '8'));
    setTxt('legendKeyClear', fmtDoubleKey(kb.keyClear, '9'));
    setTxt('legendKeyFullscreen', String(kb.keyFullscreen || 'F'));
  }
  const statsFontKeys = ["statsNameSize", "statsNumberSize", "statsHeaderSize"];
  const defaults = { columns: 46, bigStroke: 4, eyeStroke: 2, cockroachStroke: 3, starStroke: 3, dragonThreshold: 6, statsNameSize: 32, statsNumberSize: 32, statsHeaderSize: 22 };
  const limits = { columns: [38, 48, 1], bigStroke: [1, 10, 0.5], eyeStroke: [1, 10, 0.5], cockroachStroke: [1, 10, 0.5], starStroke: [1, 10, 0.5], dragonThreshold: [2, 100, 1], statsNameSize: [16, 48, 1], statsNumberSize: [18, 40, 1], statsHeaderSize: [16, 36, 1] };
  const colorGroups = [
    ["畫面與文字", [
      ["page", "整體背景", "#7a0b0b"],
      ["panel", "面板背景", "#ffffff"],
      ["frame", "外框", "#ffd700"],
      ["grid", "路單底色", "#ffffff"],
      ["gridLine", "格線", "#d8d8d8"],
      ["watermark", "路單浮水印", "#787878"],
      ["text", "一般文字", "#fff8e0"],
      ["accent", "重點文字", "#ffd700"],
      ["predictText", "下局指示標題", "#222222"],
      ["limitHigh", "最高限額文字", "#ffe296"],
      ["limitLow", "最低限額文字", "#a8e6b0"],
      ["settings", "設定視窗背景", "#650c0c"],
      ["button", "設定按鈕背景", "#8b1010"]
    ]],
    ["路單標記", [
      ["red", "莊／紅色標記", "#d62121"],
      ["blue", "閒／藍色標記", "#1e5ec9"],
      ["green", "和局標記", "#2ea94a"],
      ["markText", "珠子文字", "#ffffff"],
      ["pairBanker", "莊對小圓點", "#d62121"],
      ["pairPlayer", "閒對小圓點", "#1e5ec9"]
    ]],
    ["統計區", [
      ["statBanker", "莊贏", "#d62121"],
      ["statPlayer", "閒贏", "#1e5ec9"],
      ["statTie", "和局", "#2ea94a"],
      ["statSix", "幸運6／老虎", "#d62121"],
      ["statBankerPair", "莊對", "#7a2aa0"],
      ["statPlayerPair", "閒對", "#2f6fd6"],
      ["statSeven", "幸運7", "#0241af"],
      ["statSuperSeven", "超級幸運7", "#540593"],
      ["statEmpty", "空白統計格", "#5a0d0d"],
      ["statHeader", "桌號／局數背景", "#9c1414"],
      ["statText", "統計文字", "#ffffff"]
    ]]
  ];
  const colorFields = colorGroups.flatMap(([, fields]) => fields);
  let settings = { ...defaults, colors: {}, symbols: BaccaratSymbolSettings.normalize() };
  let derivedColumns = 46;
  let beadColumns = 16;
  function normalize(value) {
    const result = {};
    for (const [key, [min, max, step]] of Object.entries(limits)) {
      const number = Number(value?.[key]);
      result[key] = Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number / step) * step)) : defaults[key];
    }
    result.colors = {};
    for (const [key] of colorFields) {
      const color = value?.colors?.[key];
      if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) result.colors[key] = color.toLowerCase();
    }
    result.symbols = BaccaratSymbolSettings.normalize(value?.symbols);
    return result;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) settings = normalize(JSON.parse(saved));
  } catch (_) { /* Unavailable or damaged storage keeps the defaults. */ }

  // Set the saved threshold before app.js performs its first DOM-ready render.
  document.querySelector('.tv-app').dataset.dragonThreshold = settings.dragonThreshold;

  const originalBig = renderBigRoad;
  renderBigRoad = function (big, options = {}) {
    if (options.target) return originalBig(big, options);
    const offset = Math.max(0, big.cols - settings.columns);
    const visible = { ...big, grid: big.grid.map(row => Object.fromEntries(
      Object.entries(row).filter(([col]) => Number(col) >= offset).map(([col, mark]) => [Number(col) - offset, mark])
    )) };
    return originalBig(visible, { ...options, cols: settings.columns });
  };
  const originalDerived = renderDerived;
  renderDerived = function (id, marks, shape, options = {}) {
    if (options.target) return originalDerived(id, marks, shape, options);
    const laid = layoutDerivedMarks(marks, 6);
    const offset = Math.max(0, laid.cols - derivedColumns);
    originalDerived(id, marks, shape, { ...options, cols: Math.max(derivedColumns, laid.cols) });
    for (const cell of document.getElementById(id).children) {
      const col = Number(cell.style.gridColumn) - offset;
      if (col > 0) cell.style.gridColumn = col;
    }
    if (offset) {
      const board = document.getElementById(id);
      // Remove the old left edge after translating the newest visible columns.
      for (let i = 0; i < offset * 6; i++) board.firstElementChild.remove();
    }
  };
  let enteringEffectIndex = -1;
  const originalAddRoundForBeads = addRound;
  addRound = function (r, mods, ...rest) {
    enteringEffectIndex = ((r === 'P' && mods?.s7 === 6) || (r === 'B' && mods?.tiger === 'big')) ? state.rounds.length : -1;
    try {
      return originalAddRoundForBeads.call(this, r, mods, ...rest);
    } finally {
      enteringEffectIndex = -1;
    }
  };
  const originalBead = renderBead;
  renderBead = function (rounds = state.rounds, target = null, columns) {
    const visible = target ? rounds : rounds.slice(-beadColumns * 6);
    originalBead(visible, target, target ? columns : beadColumns);
    const board = target || document.getElementById('beadBoard');
    Array.from(board.children).forEach((cell, index) => {
      const rd = visible[index];
      if (!rd) return;
      const tiger = rd.r === 'B' && ['small', 'big'].includes(rd.tiger) ? rd.tiger : null;
      const cards = rd.r === 'P' ? (rd.s7 || rd.l7) : null;
      const seven = rd.r === 'P' && ((rd.s7 && [4, 5, 6].includes(rd.s7)) || (!rd.s7 && [2, 3].includes(rd.l7)));
      if (!tiger && !seven) return;
      const bead = cell.querySelector('.bead');
      bead.classList.remove('l6'); // Preserve the separate ordinary Lucky Six animation.
      bead.classList.add('tv-art-bead');
      bead.textContent = '';
      const image = document.createElement('img');
      image.className = 'bead-art';
      image.alt = '';
      image.draggable = false;
      image.src = tiger ? animalArt[tiger].src : 'assets/beads/' + (rd.s7 ? 'purple-seven' : 'blue-seven') + '.png';
      bead.appendChild(image);
      bead.title = tiger ? (tiger === 'small' ? '小老虎' : '大老虎') : (rd.s7 ? '超級幸運七 · 閒7贏莊6 · 雙方合計 ' : '幸運七 · 閒家 ') + cards + ' 張';
      bead.setAttribute('aria-label', bead.title);
      if (seven) {
        const digit = document.createElement('span');
        digit.className = 'seven-cards';
        digit.textContent = String(cards);
        digit.setAttribute('aria-hidden', 'true');
        bead.appendChild(digit);
      }
      // Final decision: all big tigers; only SIX-card Super Lucky Seven.
      if (tiger === 'big' || (seven && rd.s7 === 6)) {
        bead.classList.add(tiger === 'big' ? 'bead-effect-tiger' : 'bead-effect-seven');
        const orbit = document.createElement('span');
        orbit.className = 'bead-orbit';
        orbit.setAttribute('aria-hidden', 'true');
        orbit.innerHTML = '<i class="orbit-dot orbit-main"></i><i class="orbit-dot orbit-tail-one"></i><i class="orbit-dot orbit-tail-two"></i>';
        bead.appendChild(orbit);
        const glow = tiger === 'big' ? document.createElement('span') : image.cloneNode();
        glow.className = 'bead-local-glow ' + (tiger === 'big' ? 'bead-local-eyes' : 'bead-local-seven');
        glow.setAttribute('aria-hidden', 'true');
        if (tiger === 'big') glow.innerHTML = '<i class="tiger-eye tiger-eye-left"></i><i class="tiger-eye tiger-eye-right"></i>';
        bead.appendChild(glow);
      }
      if (tiger === 'big' || (seven && rd.s7 === 6)) {
        const effectKind = tiger === 'big' ? 'tiger' : 'seven';
        const sweep = document.createElement('span');
        sweep.className = `bead-${effectKind}-sweep`;
        sweep.setAttribute('aria-hidden', 'true');
        bead.appendChild(sweep);
        // A redraw, restored history or export must never replay the entrance.
        if (!target && rounds === state.rounds && rounds.length - visible.length + index === enteringEffectIndex) {
          bead.classList.add(`bead-${effectKind}-enter`);
          const flash = document.createElement('span');
          flash.className = `bead-${effectKind}-flash`;
          flash.setAttribute('aria-hidden', 'true');
          bead.appendChild(flash);
        }
      }
    });
    if (!target) {
      for (const [kind, id] of [['small', 'cntST'], ['big', 'cntBT']]) {
        const counter = document.getElementById(id);
        if (counter) counter.textContent = state.rounds.filter(rd => rd.r === 'B' && rd.tiger === kind).length;
      }
    }
  };

  function renderStarRoad(options = {}) {
    const el = options.target || document.getElementById('starRoad');
    if (!el) return;
    const cols = options.cols || Math.floor(derivedColumns / 2);
    const seq = (options.rounds || state.rounds).filter(x => x.r === 'B' || x.r === 'P').map(x => x.r);
    const offset = Math.max(0, Math.ceil(seq.length / 3) - cols);
    const frag = document.createDocumentFragment();
    seq.forEach((r, i) => {
      const col = Math.floor(i / 3) - offset;
      if (col < 0) return;
      const mark = document.createElement('div');
      mark.className = 'tv-star-mark ' + r;
      mark.style.gridColumn = String(col + 1);
      mark.style.gridRow = String(i % 3 + 1);
      frag.appendChild(mark);
    });
    el.replaceChildren(frag);
  }
  window.BaccaratTVView = { renderStarRoad };

  function initStatsTypography() {
    const list = document.querySelector('.tv-stats .stats-list');
    if (!list) return;
    let pendingFrame = 0;
    function fits({ cell, label }) {
      const box = cell.getBoundingClientRect();
      const column = label.getBoundingClientRect();
      const padding = 4 * box.height / Math.max(1, cell.offsetHeight);
      const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let text;
      while ((text = walker.nextNode())) {
        if (!text.textContent.trim()) continue;
        range.selectNodeContents(text);
        for (const rect of range.getClientRects()) {
          if (rect.left < column.left - .1 || rect.right > column.right + .1 ||
              rect.top < box.top + padding || rect.bottom > box.bottom - padding) return false;
        }
      }
      return true;
    }
    function fit(targetList = list) {
      const items = [...targetList.children].flatMap(cell => {
        const label = cell.querySelector('.k');
        return label && label.clientWidth && cell.clientHeight ? [{ cell, label, low: 12, high: settings.statsNameSize }] : [];
      });
      // Batch writes before reads: short labels grow, long/multiline labels fit
      // the real glyph widths and the space remaining beside the count.
      for (let pass = 0; pass < 8; pass++) {
        for (const item of items) {
          item.middle = (item.low + item.high) / 2;
          item.label.style.setProperty('--tv-stat-label-size', item.middle + 'px');
        }
        for (const item of items) {
          if (fits(item)) item.low = item.middle;
          else item.high = item.middle;
        }
      }
      for (const item of items) item.label.style.setProperty('--tv-stat-label-size', item.low.toFixed(2) + 'px');
      if (targetList === list) document.dispatchEvent(new Event('baccarat:stats-typography'));
    }
    window.BaccaratTVView.fitStats = fit;
    const schedule = () => {
      if (pendingFrame) return;
      pendingFrame = requestAnimationFrame(() => { pendingFrame = 0; fit(); });
    };
    new ResizeObserver(schedule).observe(list);
    // Style writes are deliberately excluded to avoid feeding back into fitting.
    new MutationObserver(schedule).observe(list, { childList: true, characterData: true, subtree: true });
    if (document.fonts) {
      document.fonts.ready.then(schedule);
      document.fonts.addEventListener('loadingdone', schedule);
    }
    schedule();
  }

  function initStatsFontControls(dialog, form) {
    const panel = document.getElementById('tvStatsFontPanel');
    const preview = document.getElementById('tvStatsFontPreview');
    const source = document.querySelector('.bottom-row > .tv-stats');
    const inputs = statsFontKeys.map(key => ({ input: form.elements.namedItem(key), range: panel.querySelector(`[data-stats-font="${key}"]`) }));
    function sync() {
      for (const { input, range } of inputs) range.value = input.value;
    }
    function refresh() {
      if (!dialog.open || panel.hidden || !preview.clientWidth || !source.offsetWidth) return;
      const width = source.offsetWidth, height = source.offsetHeight;
      const scale = Math.min(1, preview.clientWidth / width, 240 / height);
      const copy = source.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
      Object.assign(copy.style, { width: width + 'px', height: height + 'px', left: (preview.clientWidth - width * scale) / 2 + 'px', boxSizing: 'border-box', transform: `scale(${scale})` });
      preview.style.height = Math.ceil(height * scale) + 'px';
      preview.replaceChildren(copy);
    }
    function clear() { preview.replaceChildren(); preview.style.height = ''; }
    for (const { input, range } of inputs) {
      range.addEventListener('input', () => {
        input.value = range.value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      input.addEventListener('input', () => { if (input.validity.valid) range.value = input.value; });
    }
    document.addEventListener('baccarat:stats-typography', refresh);
    new ResizeObserver(refresh).observe(preview);
    dialog.addEventListener('close', clear);
    return {
      sync,
      setActive(active) {
        panel.hidden = !active;
        if (active) { sync(); refresh(); }
        else clear();
      }
    };
  }

  function applyColors() {
    const root = document.documentElement;
    for (const [key] of colorFields) {
      const color = settings.colors[key];
      root.classList.toggle('tv-color-' + key, !!color);
      if (color) root.style.setProperty('--tv-color-' + key, color);
      else root.style.removeProperty('--tv-color-' + key);
    }
  }

  function applyLayout() {
    const app = document.querySelector('.tv-app');
    const set = (key, value) => app.style.setProperty(key, value);
    app.dataset.dragonThreshold = settings.dragonThreshold;
    applyColors();
    document.documentElement.style.setProperty('--tv-stat-count-size', settings.statsNumberSize + 'px');
    document.documentElement.style.setProperty('--tv-stat-header-size', settings.statsHeaderSize + 'px');
    BaccaratSymbolSettings.apply(settings.symbols);
    // Subtract panel borders (4px) and board borders (2px); six square rows.
    const width = app.clientWidth - 20;
    const bigCell = (document.getElementById('bigRoad').parentElement.clientWidth - 2) / settings.columns;
    const derivedCell = bigCell / 2;
    derivedColumns = Math.floor((document.getElementById('bigEye').parentElement.clientWidth - 2) / derivedCell);
    const bigHeight = bigCell * 6 + 6;
    const derivedHeight = derivedCell * 6 + 6;
    const bottomHeight = app.clientHeight - 20 - 4 * 6 - 120 - bigHeight - 2 * derivedHeight;
    const scale = bottomHeight / 412;
    set('--cell-big', `${bigCell}px`);
    set('--cell-derived', `${derivedCell}px`);
    set('--cols-big', settings.columns);
    set('--cols-derived', derivedColumns);
    set('--cols-star', Math.floor(derivedColumns / 2));
    set('--tv-big-stroke', `${settings.bigStroke}px`);
    set('--tv-eye-stroke', `${settings.eyeStroke}px`);
    set('--tv-cockroach-stroke', `${settings.cockroachStroke}px`);
    set('--tv-star-stroke', `${settings.starStroke}px`);
    app.style.gridTemplateRows = `120px ${bigHeight}px ${derivedHeight}px ${derivedHeight}px ${bottomHeight}px`;
    set('--tv-bottom-scale', scale);
    set('--tv-bottom-width', `${width / scale}px`);
    set('--tv-stats-width', `${622 / scale}px`);
    set('--tv-predict-width', `${162 / scale}px`);
    set('--tv-bottom-gap', `${6 / scale}px`);
    const beadPanel = document.getElementById('beadBoard').parentElement;
    const beadCell = (412 - 6) / 6;
    set('--cell-bead', `${beadCell}px`);
    beadColumns = Math.max(1, Math.floor((beadPanel.clientWidth - 2) / beadCell));
    set('--cols-bead', beadColumns);
    renderAll();
    renderStarRoad();
  }

  function init() {
    const dialog = document.getElementById('tvSettings');
    // Keep viewport positioning, but share the road scale to compensate for browser zoom.
    document.body.appendChild(dialog);
    const form = document.getElementById('tvSettingsForm');
    const button = document.getElementById('tvSettingsButton');
    const status = document.getElementById('tvSettingsStatus');
    let draftColors = {};
    let editBaseline = null;
    function previewColors() {
      if (!dialog.open) return;
      settings = { ...settings, colors: { ...draftColors } };
      applyColors();
    }
    function previewSettings() {
      if (!dialog.open) return;
      const next = { ...settings, colors: { ...draftColors } };
      for (const key of Object.keys(defaults)) {
        const input = form.elements.namedItem(key);
        if (input.validity.valid) next[key] = Number(input.value);
      }
      settings = next; applyLayout();
    }
    for (const key of Object.keys(defaults)) form.elements.namedItem(key).addEventListener('input', previewSettings);
    const symbolEditor = BaccaratSymbolSettings.init({ onChange(symbols) {
      settings = { ...settings, symbols };
      BaccaratSymbolSettings.apply(symbols);
    } });
    const statsFontEditor = initStatsFontControls(dialog, form);
    let activeColor = null;
    let activeTab = 'basic';
    let hsv = { h: 0, s: 1, v: 1 };
    const colorContainer = document.getElementById('tvColorSettings');
    const colorTarget = document.getElementById('tvColorTarget');
    const colorOptions = document.getElementById('tvColorOptions');
    const targetPicker = colorTarget.parentElement;
    function closeTargetMenu(focus = false) {
      colorOptions.hidden = true; colorTarget.setAttribute('aria-expanded', 'false');
      if (focus) colorTarget.focus();
    }
    function openTargetMenu() {
      colorOptions.hidden = false; colorTarget.setAttribute('aria-expanded', 'true');
      const selected = colorOptions.querySelector('[aria-selected="true"]');
      if (selected) { selected.focus({ preventScroll: true }); selected.scrollIntoView({ block: 'nearest' }); }
    }
    colorTarget.addEventListener('click', () => { if (colorOptions.hidden) openTargetMenu(); else closeTargetMenu(true); });
    document.addEventListener('pointerdown', event => { if (!targetPicker.contains(event.target)) closeTargetMenu(); });
    function handleTargetKey(event) {
      if (event.key === 'Escape' && !colorOptions.hidden) { event.preventDefault(); closeTargetMenu(true); return true; }
      if (event.target !== colorTarget && !colorOptions.contains(event.target)) return false;
      if (event.key === 'Tab') { closeTargetMenu(true); return false; }
      const options = [...colorOptions.children];
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const wasClosed = colorOptions.hidden;
        if (wasClosed) openTargetMenu();
        let index = options.indexOf(document.activeElement);
        if (event.key === 'Home') index = 0;
        else if (event.key === 'End') index = options.length - 1;
        else if (!wasClosed) index = (index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length;
        if (options[index]) { options[index].focus({ preventScroll: true }); options[index].scrollIntoView({ block: 'nearest' }); }
        return true;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (colorOptions.hidden) openTargetMenu();
        else if (event.target.dataset.colorOption) { openColor(event.target.dataset.colorOption); closeTargetMenu(true); }
        return true;
      }
      return false;
    }
    const swatches = new Map();
    const groups = [];
    // Local editing stays complete; the hosted version exposes only approved tabs.
    const localSettings = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const allTabs = [...dialog.querySelectorAll('[data-settings-tab]')];
    const tabs = allTabs.filter(button => localSettings || ['basic', 'keys'].includes(button.dataset.settingsTab));
    for (const tab of allTabs) tab.hidden = !tabs.includes(tab);
    dialog.classList.toggle('tv-settings-limited', !localSettings);
    const editor = document.createElement('section');
    editor.id = 'tvColorEditor'; editor.className = 'tv-color-editor';
    editor.setAttribute('aria-labelledby', 'tvColorEditorTitle');
    editor.innerHTML = `
      <strong id="tvColorEditorTitle"></strong>
      <div id="tvColorSpectrum" class="tv-color-spectrum" tabindex="0" role="slider" aria-label="色彩明暗與濃淡" aria-valuemin="0" aria-valuemax="100"><i></i></div>
      <label class="tv-hue-label" for="tvColorHue">色相<input id="tvColorHue" type="range" min="0" max="359" value="0" aria-label="色相"/></label>
      <div class="tv-color-presets" aria-label="常用顏色"></div>
      <label class="tv-color-hex-label" for="tvColorHex">色碼<input id="tvColorHex" type="text" pattern="#[0-9a-fA-F]{6}" maxlength="7" spellcheck="false" autocomplete="off" required disabled/></label>`;
    document.getElementById('tvColorEditorHost').appendChild(editor);
    const hexInput = editor.querySelector('#tvColorHex');
    const hueInput = editor.querySelector('#tvColorHue');
    const spectrum = editor.querySelector('#tvColorSpectrum');
    function paintSwatch(key, color) {
      const swatch = swatches.get(key);
      swatch.style.setProperty('--swatch-color', color); swatch.title = color;
    }
    function renderSpectrum() {
      spectrum.style.setProperty('--picker-hue', hsv.h);
      spectrum.firstElementChild.style.left = (hsv.s * 100) + '%';
      spectrum.firstElementChild.style.top = ((1 - hsv.v) * 100) + '%';
      spectrum.setAttribute('aria-valuenow', String(Math.round(hsv.v * 100)));
      spectrum.setAttribute('aria-valuetext', `濃度 ${Math.round(hsv.s * 100)}%，亮度 ${Math.round(hsv.v * 100)}%`);
      hueInput.value = hsv.h;
    }
    function syncEditor(color) {
      hexInput.value = color;
      const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
      let h = hsv.h;
      if (delta) h = ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
      hsv = { h, s: max ? delta / max : 0, v: max }; renderSpectrum();
    }
    function selectColor(color, fromSpectrum = false) {
      if (!activeColor || !/^#[0-9a-f]{6}$/i.test(color)) return;
      color = color.toLowerCase(); draftColors[activeColor] = color;
      form.elements.namedItem('color-' + activeColor).value = color;
      paintSwatch(activeColor, color);
      if (fromSpectrum) { hexInput.value = color; renderSpectrum(); }
      else syncEditor(color);
      previewColors();
    }
    function selectHSV() {
      const c = hsv.v * hsv.s, x = c * (1 - Math.abs((hsv.h / 60) % 2 - 1)), m = hsv.v - c;
      const rgb = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.min(5, Math.floor(hsv.h / 60))];
      selectColor('#' + rgb.map(n => Math.round((n + m) * 255).toString(16).padStart(2, '0')).join(''), true);
    }
    function pointColor(event) {
      const rect = spectrum.getBoundingClientRect();
      hsv.s = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      hsv.v = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      selectHSV();
    }
    spectrum.addEventListener('pointerdown', event => { if (event.button !== 0) return; spectrum.setPointerCapture(event.pointerId); spectrum.focus(); pointColor(event); });
    spectrum.addEventListener('pointermove', event => { if (spectrum.hasPointerCapture(event.pointerId)) pointColor(event); });
    spectrum.addEventListener('pointerup', event => { if (spectrum.hasPointerCapture(event.pointerId)) spectrum.releasePointerCapture(event.pointerId); });
    hueInput.addEventListener('input', () => { hsv.h = Number(hueInput.value); selectHSV(); });
    hexInput.addEventListener('input', () => { if (hexInput.validity.valid) selectColor(hexInput.value); });
    for (const color of ['#ffffff', '#787878', '#222222', '#000000', '#d62121', '#ff8c00', '#ffd700', '#2ea94a', '#008b8b', '#1e5ec9', '#7a2aa0', '#f080a0']) {
      const preset = document.createElement('button'); preset.type = 'button'; preset.dataset.color = color;
      preset.style.setProperty('--swatch-color', color); preset.setAttribute('aria-label', '選擇 ' + color); preset.title = color;
      preset.addEventListener('click', () => selectColor(color)); editor.querySelector('.tv-color-presets').appendChild(preset);
    }
    function openColor(key) {
      activeColor = key;
      colorTarget.value = key;
      colorTarget.firstElementChild.textContent = colorFields.find(([name]) => name === key)[1];
      for (const option of colorOptions.children) option.setAttribute('aria-selected', String(option.dataset.colorOption === key));
      for (const [name, swatch] of swatches) swatch.setAttribute('aria-pressed', String(name === key));
      editor.querySelector('#tvColorEditorTitle').textContent = colorFields.find(([name]) => name === key)[1];
      hexInput.disabled = false; syncEditor(form.elements.namedItem('color-' + key).value);
    }
    colorGroups.forEach(([title, fields], index) => {
      const grid = document.createElement('div'); grid.className = 'tv-color-grid'; grid.hidden = true;
      grid.dataset.colorGroup = index;
      for (const [key, labelText, fallback] of fields) {
        const input = document.createElement('input'); input.type = 'hidden'; input.className = 'tv-color-value'; input.name = 'color-' + key; input.value = fallback;
        const swatch = document.createElement('button'); swatch.type = 'button'; swatch.className = 'tv-color-swatch'; swatch.dataset.colorKey = key;
        swatch.setAttribute('aria-pressed', 'false'); swatch.innerHTML = '<span></span><i aria-hidden="true"></i>'; swatch.firstElementChild.textContent = labelText;
        swatches.set(key, swatch); paintSwatch(key, fallback);
        input.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(input.value)) { draftColors[key] = input.value.toLowerCase(); paintSwatch(key, input.value); if (activeColor === key) syncEditor(input.value); previewColors(); } });
        swatch.addEventListener('click', () => openColor(key)); grid.append(input, swatch);
      }
      groups.push(grid); colorContainer.appendChild(grid);
    });
    function showTab(tab) {
      if (!tabs.some(button => button.dataset.settingsTab === tab)) return;
      closeTargetMenu();
      activeTab = tab;
      tabs.forEach(button => { const selected = button.dataset.settingsTab === tab; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; });
      const isColorTab = ['0', '1', '2'].includes(tab);
      document.getElementById('tvBasicPanel').hidden = tab !== 'basic';
      const keysPanel = document.getElementById('tvKeysPanel');
      if (keysPanel) keysPanel.hidden = tab !== 'keys';
      document.getElementById('tvColorPanel').hidden = !isColorTab;
      document.getElementById('tvSymbolsPanel').hidden = tab !== 'symbols';
      if (tab === 'symbols') symbolEditor.show();
      statsFontEditor.setActive(tab === 'statsFont');
      document.getElementById('tvSettingsReset').hidden = tab !== 'basic' && tab !== 'keys' && tab !== 'symbols' && tab !== 'statsFont';
      document.getElementById('tvColorsReset').hidden = !isColorTab;
      groups.forEach((group, index) => { group.hidden = String(index) !== tab; });
      hexInput.disabled = true; activeColor = null;
      if (isColorTab) {
        document.getElementById('tvColorPanel').setAttribute('aria-labelledby', tabs.find(button => button.dataset.settingsTab === tab).id);
        colorOptions.replaceChildren(...colorGroups[Number(tab)][1].map(([key, title]) => {
          const option = document.createElement('button'); option.type = 'button'; option.tabIndex = -1;
          option.dataset.colorOption = key; option.textContent = title; option.setAttribute('role', 'option');
          option.addEventListener('click', () => { openColor(key); closeTargetMenu(true); });
          return option;
        }));
        openColor(colorGroups[Number(tab)][1][0][0]);
      }
    }
    tabs.forEach(button => button.addEventListener('click', () => showTab(button.dataset.settingsTab)));
    function fillColors(colors = {}) {
      draftColors = { ...colors };
      for (const [key, , fallback] of colorFields) { const color = colors[key] || fallback; form.elements.namedItem('color-' + key).value = color; paintSwatch(key, color); }
      if (activeColor) syncEditor(form.elements.namedItem('color-' + activeColor).value);
    }
    document.getElementById('tvColorReset').addEventListener('click', () => {
      if (!activeColor) return;
      delete draftColors[activeColor];
      const fallback = colorFields.find(([key]) => key === activeColor)[2];
      form.elements.namedItem('color-' + activeColor).value = fallback;
      paintSwatch(activeColor, fallback); syncEditor(fallback); previewColors();
    });
    document.getElementById('tvColorsReset').addEventListener('click', () => { fillColors(); previewColors(); });
    function cancelSettings() {
      closeTargetMenu();
      if (editBaseline) { settings = editBaseline; editBaseline = null; applyLayout(); }
      dialog.close();
    }
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      activeColor = null; hexInput.disabled = true;
      if (editBaseline) { settings = editBaseline; editBaseline = null; applyLayout(); }
    });
    const dragHandle = dialog.querySelector('.tv-settings-header');
    let panelPositioned = false;
    const panelScale = () => Math.min(innerWidth / 1920, innerHeight / 1080);
    const SETTINGS_SIZE_KEY = 'baccarat_tv_settings_size_v1';
    function applyDialogSize(w, h) {
      if (w) dialog.style.width = Math.round(w) + 'px';
      if (h) dialog.style.height = Math.round(h) + 'px';
      clampPanel();
    }
    try {
      const savedSz = localStorage.getItem(SETTINGS_SIZE_KEY);
      if (savedSz) {
        const { width, height } = JSON.parse(savedSz);
        const w = width && width >= 360 ? width : 520;
        const h = height && height >= 640 ? height : 820;
        applyDialogSize(w, h);
      }
    } catch (_) {}

    function clampPanel() {
      if (!dialog.open) return;
      const r = dialog.getBoundingClientRect();
      const gap = 8 * panelScale();
      dialog.style.left = Math.max(gap, Math.min(innerWidth - r.width - gap, r.left)) + 'px';
      dialog.style.top = Math.max(gap, Math.min(innerHeight - r.height - gap, r.top)) + 'px';
      dialog.style.right = 'auto';
    }
    dragHandle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')) return;
      const r = dialog.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = r.left;
      const startTop = r.top;
      dialog.classList.add('is-dragging');
      event.preventDefault();

      const onDragMove = e => {
        dialog.style.left = startLeft + (e.clientX - startX) + 'px';
        dialog.style.top = startTop + (e.clientY - startY) + 'px';
        clampPanel();
      };
      const onDragEnd = () => {
        window.removeEventListener('pointermove', onDragMove);
        window.removeEventListener('pointerup', onDragEnd);
        window.removeEventListener('pointercancel', onDragEnd);
        dialog.classList.remove('is-dragging');
        clampPanel();
      };
      window.addEventListener('pointermove', onDragMove);
      window.addEventListener('pointerup', onDragEnd);
      window.addEventListener('pointercancel', onDragEnd);
    });

    function toggleSettingsSize() {
      const isExpanded = parseInt(dialog.style.width, 10) > 550;
      const targetW = isExpanded ? 420 : 680;
      const targetH = isExpanded ? 660 : 820;
      applyDialogSize(targetW, targetH);
      const btn = document.getElementById('tvSettingsSizeToggle');
      if (btn) btn.textContent = isExpanded ? '⛶' : '🗗';
      try { localStorage.setItem(SETTINGS_SIZE_KEY, JSON.stringify({ width: targetW, height: targetH })); } catch (_) {}
    }
    const sizeToggleBtn = document.getElementById('tvSettingsSizeToggle');
    if (sizeToggleBtn) sizeToggleBtn.addEventListener('click', toggleSettingsSize);
    dragHandle.addEventListener('dblclick', event => {
      if (event.target.closest('button')) return;
      toggleSettingsSize();
    });

    const resizers = dialog.querySelectorAll('.tv-resizer');
    resizers.forEach(handle => {
      handle.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        const rect = dialog.getBoundingClientRect();
        const scale = panelScale() || 1;
        const dir = handle.dataset.dir || 'se';
        const startX = event.clientX;
        const startY = event.clientY;
        const startW = rect.width / scale;
        const startH = rect.height / scale;
        const startL = rect.left;
        dialog.classList.add('is-resizing');
        event.preventDefault();
        event.stopPropagation();

        const onResizeMove = e => {
          const deltaX = (e.clientX - startX) / scale;
          const deltaY = (e.clientY - startY) / scale;
          let newW = startW;
          let newH = startH;
          let newL = startL;

          if (dir.includes('e')) {
            newW = Math.max(360, startW + deltaX);
          }
          if (dir.includes('w')) {
            const expand = Math.max(-startW + 360, -deltaX);
            newW = startW + expand;
            newL = startL - expand * scale;
          }
          if (dir.includes('s')) {
            newH = Math.max(480, startH + deltaY);
          }

          dialog.style.width = Math.round(newW) + 'px';
          dialog.style.height = Math.round(newH) + 'px';
          if (dir.includes('w')) {
            dialog.style.left = Math.round(newL) + 'px';
          }
        };

        const onResizeEnd = () => {
          window.removeEventListener('pointermove', onResizeMove);
          window.removeEventListener('pointerup', onResizeEnd);
          window.removeEventListener('pointercancel', onResizeEnd);
          const r = dialog.getBoundingClientRect();
          const curScale = panelScale() || 1;
          const sz = { width: Math.round(r.width / curScale), height: Math.round(r.height / curScale) };
          try { localStorage.setItem(SETTINGS_SIZE_KEY, JSON.stringify(sz)); } catch (_) {}
          dialog.classList.remove('is-resizing');
          clampPanel();
        };

        window.addEventListener('pointermove', onResizeMove, { passive: false });
        window.addEventListener('pointerup', onResizeEnd);
        window.addEventListener('pointercancel', onResizeEnd);
      });
    });
    window.addEventListener('resize', clampPanel);
    // 連按輸入：66 小老虎、666 大老虎；22 小 lucky seven、222 大 lucky seven、2222～222222 四～六張超級；一律 Enter 送出。
    let special = null;
    let seq = [];
    const hint = document.querySelector('.tv-lucky7-key-hint');
    const defaultHint = hint.textContent;
    const CARD_WORDS = { 4: '四', 5: '五', 6: '六' };
    function resetInput() { special = null; seq = []; hint.textContent = defaultHint; }
    function cancelOrdinary() {
      const detail = {};
      document.dispatchEvent(new CustomEvent('baccarat:cancel-pending', { detail }));
      return detail.pairs || { bp: false, pp: false };
    }
    function comboFromSeq() {
      const count = d => seq.filter(x => x === d).length;
      const tigerKey = currentKeyBindings.keyTiger || currentKeyBindings.keyL6 || '6';
      const sevenKey = currentKeyBindings.keySeven || currentKeyBindings.keyP || '2';
      const sixes = count(tigerKey), twos = count(sevenKey);
      if (special) return { r: 'B', tiger: special, text: special === 'small' ? '恭喜中幸運六點小老虎' : '恭喜中幸運六點大老虎' };
      if (sixes >= 2) {
        const tiger = sixes === 2 ? 'small' : 'big';
        return { r: 'B', tiger, text: tiger === 'small' ? '恭喜中幸運六點小老虎' : '恭喜中幸運六點大老虎' };
      }
      if (twos >= 2) {
        const cards = Math.min(twos, 6);
        if (cards <= 3) return { r: 'P', l7: cards, text: cards === 2 ? '恭喜中小lucky seven 閒贏' : '恭喜中大lucky seven 閒贏' };
        return { r: 'P', s7: cards, text: '恭喜中' + CARD_WORDS[cards] + '張超級lucky seven 閒贏' };
      }
      return null;
    }
    function codeToKeyChar(code) {
      if (!code) return null;
      if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
      if (/^Digit[0-9]$/.test(code)) return code.slice(5);
      if (/^Key[A-Z]$/.test(code)) return code.slice(3).toUpperCase();
      return null;
    }
    function isMatchKey(targetKey, e) {
      if (!targetKey) return false;
      let t = String(targetKey).trim().toUpperCase();
      if (t.length === 2 && t[0] === t[1]) t = t[0];
      if (t === 'ENTER') return e.code === 'Enter' || e.code === 'NumpadEnter';
      if (t === 'BACKSPACE') return e.code === 'Backspace';
      if (t === 'SPACE') return e.code === 'Space';
      const c = codeToKeyChar(e.code);
      return (c && c.toUpperCase() === t) || (e.key && e.key.toUpperCase() === t);
    }
    document.addEventListener('keydown', event => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) || event.target?.isContentEditable || dialog.open || event.ctrlKey || event.altKey || event.metaKey) return;
      const code = event.code;
      const isCustomKeyUsed = [
        currentKeyBindings.keyConfirm, currentKeyBindings.keyUndo,
        currentKeyBindings.keyLimit, currentKeyBindings.keyBoss, currentKeyBindings.keyClear,
        currentKeyBindings.keyFullscreen
      ].some(k => isMatchKey(k, event));
      if (!isCustomKeyUsed && (code === 'KeyC' || code === 'KeyT')) {
        if (!event.repeat) {
          cancelOrdinary();
          special = code === 'KeyC' ? 'small' : 'big';
          seq = [];
          hint.textContent = (special === 'small' ? '小老虎' : '大老虎') + '：Enter 記錄；Esc 取消';
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (code === 'Escape') { if (special || seq.length) { resetInput(); cancelOrdinary(); event.preventDefault(); } return; }
      if ((isMatchKey(currentKeyBindings.keyUndo || 'Backspace', event) || code === 'Backspace') && !event.repeat) { resetInput(); return; }
      const keyChar = codeToKeyChar(code);
      const validKeyList = [
        currentKeyBindings.keyB,
        currentKeyBindings.keyP,
        currentKeyBindings.keyT,
        currentKeyBindings.keyBP,
        currentKeyBindings.keyPP,
        currentKeyBindings.keyL6,
        currentKeyBindings.keyTiger || '6',
        currentKeyBindings.keySeven || '2'
      ];
      if (keyChar && validKeyList.some(k => String(k).toUpperCase() === keyChar.toUpperCase())) {
        const match = validKeyList.find(k => String(k).toUpperCase() === keyChar.toUpperCase());
        if (!event.repeat) seq.push(match || keyChar);
        return; // 交給 app.js 照常累積
      }
      if ((isMatchKey(currentKeyBindings.keyConfirm || 'Enter', event) || code === 'Enter' || code === 'NumpadEnter') && !event.repeat) {
        const combo = comboFromSeq();
        if (!combo) { resetInput(); return; } // 一般輸入交給 app.js
        const pairs = cancelOrdinary();
        const { r, text, ...mods } = combo;
        if (r === 'B') mods.l6 = true;
        Object.assign(mods, pairs);
        speak(text);
        addRound(r, mods);
        resetInput();
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    document.addEventListener('baccarat:auto-commit', event => {
      const combo = comboFromSeq();
      if (combo) {
        event.preventDefault(); // 阻止 app.js 執行普通提交
        const pairs = cancelOrdinary();
        const { r, text, ...mods } = combo;
        if (r === 'B') mods.l6 = true;
        Object.assign(mods, pairs);
        speak(text);
        addRound(r, mods);
        resetInput();
      } else {
        resetInput();
      }
    });
    dialog.addEventListener('close', () => { resetInput(); cancelOrdinary(); });
    document.querySelectorAll('.tv-limit .limit-input').forEach(input => {
      input.addEventListener('focus', () => { input.value = input.value.replace(/,/g, ''); });
      input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); });
      input.addEventListener('blur', () => {
        const digits = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
        input.value = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      });
      input.dispatchEvent(new Event('blur'));
    });
    function fillKeyBindings(kb) {
      const b = kb || currentKeyBindings;
      const allFields = [
        'keyB', 'keyP', 'keyT', 'keyBP', 'keyPP', 'keyL6', 'keyTiger', 'keySeven',
        'keyConfirm', 'keyUndo', 'keyLimit', 'keyBoss', 'keyClear', 'keyFullscreen'
      ];
      for (const k of allFields) {
        const el = form.elements.namedItem(k);
        if (el) el.value = b[k] || defaultKeyBindings[k];
      }
      const ac = form.elements.namedItem('autoCommit');
      if (ac) ac.checked = b.autoCommit !== false;
      const acd = form.elements.namedItem('autoCommitDelay');
      if (acd) acd.value = b.autoCommitDelay || 0.38;

      const sndEn = document.getElementById('tvSoundEnabled');
      if (sndEn && typeof speech !== 'undefined') sndEn.checked = !!speech.enabled;
      const sndVol = document.getElementById('tvSoundVolume');
      const sndVolTxt = document.getElementById('tvSoundVolumeText');
      if (sndVol && typeof speech !== 'undefined') {
        const pct = Math.round((speech.volume ?? 1) * 100);
        sndVol.value = pct;
        if (sndVolTxt) sndVolTxt.textContent = pct + '%';
      }
    }
    function fill(values) {
      for (const key of Object.keys(defaults)) form.elements.namedItem(key).value = values[key];
      fillColors(values.colors);
      symbolEditor.setValue(values.symbols);
      fillKeyBindings(currentKeyBindings);
      statsFontEditor.sync();
    }
    dialog.showModal = function() { this.show(); };
    button.addEventListener('click', () => {
      if (dialog.open) { dialog.focus(); return; }
      editBaseline = structuredClone(settings);
      fill(settings);
      status.hidden = true;
      showTab('basic');
      dialog.show();
      if (!panelPositioned) {
        const gap = 20 * panelScale();
        dialog.style.left = innerWidth - dialog.getBoundingClientRect().width - gap + 'px';
        dialog.style.top = gap + 'px';
        panelPositioned = true;
      }
      clampPanel();
    });
    document.getElementById('tvSettingsCancel').addEventListener('click', cancelSettings);
    document.getElementById('tvSettingsClose').addEventListener('click', cancelSettings);
    document.getElementById('tvSettingsReset').addEventListener('click', () => {
      if (activeTab === 'keys') {
        fillKeyBindings(defaultKeyBindings);
      } else if (activeTab === 'symbols') {
        symbolEditor.reset();
      } else if (activeTab === 'statsFont') {
        for (const key of statsFontKeys) form.elements.namedItem(key).value = defaults[key];
        statsFontEditor.sync(); previewSettings();
      } else {
        fill({ ...defaults, ...Object.fromEntries(statsFontKeys.map(key => [key, settings[key]])), symbols: settings.symbols });
        applyDialogSize(520, 820);
        try { localStorage.removeItem(SETTINGS_SIZE_KEY); } catch (_) {}
        previewSettings();
      }
    });

    const sndVol = document.getElementById('tvSoundVolume');
    const sndVolTxt = document.getElementById('tvSoundVolumeText');
    if (sndVol) {
      sndVol.addEventListener('input', () => {
        const pct = sndVol.value;
        if (sndVolTxt) sndVolTxt.textContent = pct + '%';
        if (typeof speech !== 'undefined') {
          speech.volume = pct / 100;
          try { localStorage.setItem('baccarat_sound_volume_v1', String(speech.volume)); } catch (_) {}
        }
      });
    }
    const sndEn = document.getElementById('tvSoundEnabled');
    if (sndEn) {
      sndEn.addEventListener('change', () => {
        if (typeof speech !== 'undefined') {
          speech.enabled = sndEn.checked;
          try { localStorage.setItem('baccarat_sound_enabled_v1', speech.enabled ? '1' : '0'); } catch (_) {}
          if (typeof applySoundUI === 'function') applySoundUI();
        }
      });
    }
    document.querySelectorAll('.tv-mini-audio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const audioName = btn.dataset.audio;
        if (audioName && typeof playSoundFile === 'function') {
          playSoundFile(audioName);
        }
      });
    });
    // Prevent game shortcuts while the dialog is open, including Enter on buttons.
    document.addEventListener('keydown', event => {
      if (dialog.open) {
        if (handleTargetKey(event)) { event.stopImmediatePropagation(); return; }
        if (event.key === 'Escape') { event.preventDefault(); cancelSettings(); }
        if (event.target === spectrum && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault();
          if (event.key === 'ArrowLeft') hsv.s = Math.max(0, hsv.s - .01);
          if (event.key === 'ArrowRight') hsv.s = Math.min(1, hsv.s + .01);
          if (event.key === 'ArrowUp') hsv.v = Math.min(1, hsv.v + .01);
          if (event.key === 'ArrowDown') hsv.v = Math.max(0, hsv.v - .01);
          selectHSV();
        }
        if (tabs.includes(event.target) && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
          event.preventDefault(); const index = (tabs.indexOf(event.target) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
          showTab(tabs[index].dataset.settingsTab); tabs[index].focus();
        }
        if (event.key === 'Tab') {
          const focusable = [...dialog.querySelectorAll('button,input,select,[tabindex]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (event.shiftKey && event.target === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && event.target === last) { event.preventDefault(); first.focus(); }
        }
        event.stopImmediatePropagation();
      }
    }, true);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (document.getElementById('tvStatsFontPanel').querySelector('input:invalid')) { showTab('statsFont'); form.reportValidity(); return; }
      if (document.getElementById('tvSymbolsPanel').querySelector('input:invalid')) { showTab('symbols'); form.reportValidity(); return; }
      if (!document.getElementById('tvBasicPanel').querySelector('input:invalid')) { if (!form.reportValidity()) return; }
      else { showTab('basic'); form.reportValidity(); return; }
      settings = normalize({ ...Object.fromEntries(new FormData(form)), colors: draftColors, symbols: settings.symbols });
      applyLayout();

      const fd = new FormData(form);
      const newKeyBindings = {
        keyB: (fd.get('keyB') || defaultKeyBindings.keyB).toString().trim(),
        keyP: (fd.get('keyP') || defaultKeyBindings.keyP).toString().trim(),
        keyT: (fd.get('keyT') || defaultKeyBindings.keyT).toString().trim(),
        keyBP: (fd.get('keyBP') || defaultKeyBindings.keyBP).toString().trim(),
        keyPP: (fd.get('keyPP') || defaultKeyBindings.keyPP).toString().trim(),
        keyL6: (fd.get('keyL6') || defaultKeyBindings.keyL6).toString().trim(),
        keyTiger: (fd.get('keyTiger') || defaultKeyBindings.keyTiger).toString().trim(),
        keySeven: (fd.get('keySeven') || defaultKeyBindings.keySeven).toString().trim(),
        keyConfirm: (fd.get('keyConfirm') || defaultKeyBindings.keyConfirm).toString().trim(),
        keyUndo: (fd.get('keyUndo') || defaultKeyBindings.keyUndo).toString().trim(),
        keyLimit: (fd.get('keyLimit') || defaultKeyBindings.keyLimit).toString().trim(),
        keyBoss: (fd.get('keyBoss') || defaultKeyBindings.keyBoss).toString().trim(),
        keyClear: (fd.get('keyClear') || defaultKeyBindings.keyClear).toString().trim(),
        keyFullscreen: (fd.get('keyFullscreen') || defaultKeyBindings.keyFullscreen).toString().trim(),
        autoCommit: form.elements.namedItem('autoCommit')?.checked ?? true,
        autoCommitDelay: parseFloat(fd.get('autoCommitDelay')) || 0.38
      };
      currentKeyBindings = newKeyBindings;
      updateKeyLegend(currentKeyBindings);
      document.dispatchEvent(new CustomEvent('baccarat:keybindings-updated', { detail: currentKeyBindings }));

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        localStorage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(currentKeyBindings));
        editBaseline = null;
        dialog.close();
      } catch (_) {
        status.textContent = '已套用，但瀏覽器無法儲存設定；重新開啟後可能恢復預設。';
        status.hidden = false;
      }
    });
    ['tvKeyConfirm', 'tvKeyUndo', 'tvKeyLimit', 'tvKeyBoss', 'tvKeyClear', 'tvKeyFullscreen'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('keydown', e => {
          if (['Tab', 'Escape'].includes(e.key)) return;
          e.preventDefault();
          e.stopPropagation();
          let keyVal = e.key;
          if (e.code === 'Enter' || e.code === 'NumpadEnter') keyVal = 'Enter';
          else if (e.code === 'Backspace') keyVal = 'Backspace';
          else if (e.code === 'Space') keyVal = 'Space';
          else if (/^Numpad[0-9]$/.test(e.code)) keyVal = e.code.slice(6);
          else if (/^Digit[0-9]$/.test(e.code)) keyVal = e.code.slice(5);
          else if (/^Key[A-Z]$/.test(e.code)) keyVal = e.code.slice(3).toUpperCase();
          input.value = keyVal;
        });
      }
    });
    dialog.addEventListener('close', () => button.focus());
    applyLayout();
    initStatsTypography();
    updateKeyLegend(currentKeyBindings);
    document.dispatchEvent(new CustomEvent('baccarat:keybindings-updated', { detail: currentKeyBindings }));
    new MutationObserver(renderStarRoad).observe(document.getElementById('beadBoard'), { childList: true });
    const totalCountEl = document.getElementById('totalCount');
    const topRoundEl = document.getElementById('tvTopRoundCount');
    if (totalCountEl && topRoundEl) {
      const syncRound = () => { topRoundEl.textContent = totalCountEl.textContent || '0'; };
      syncRound();
      new MutationObserver(syncRound).observe(totalCountEl, { childList: true, characterData: true, subtree: true });
    }
    if (localSettings && new URLSearchParams(location.search).get('settings') === 'statsFont') {
      button.click(); showTab('statsFont');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
