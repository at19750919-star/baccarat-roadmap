/* 路單「選擇字型／雙螢幕工作台」接到風格編輯器。支援字色、字型、大小、邊框、陰影 LIVE 預覽與確定提交。 */
(function (root) {
  'use strict';

  const EDITOR = 'http://127.0.0.1:5199';
  const KIND = 'tv-font-bridge';
  const ALLOWED_PROPS = ['color', 'fontFamily', 'fontWeight', 'fontSize', 'borderWidth', 'borderStyle', 'borderColor', 'borderRadius', 'boxShadow'];
  const BORDER_STYLES = { none: 1, solid: 1, dashed: 1, dotted: 1, double: 1 };
  const GENERICS = { serif: 1, 'sans-serif': 1, 'system-ui': 1, 'ui-monospace': 1, monospace: 1, cursive: 1, fantasy: 1 };
  const FORBIDDEN_TOKEN = /url\s*\(|https?:|javascript:|expression\s*\(|@import|[;{}<>\\]/i;
  const WEB = {
    'Noto Sans TC': ':wght@400;500;700;900',
    'Noto Serif TC': ':wght@400;700;900',
    'LXGW WenKai TC': '',
    'Zen Old Mincho': ':wght@400;700',
    'Zen Maru Gothic': ':wght@400;700',
    'Zen Kaku Gothic New': ':wght@400;700',
    'Chocolate Classical Sans': '',
    'Shippori Mincho': ':wght@400;700',
    'Hina Mincho': '',
    'Klee One': ':wght@400;600',
    'Kaisei Decol': ':wght@400;700',
    'Yuji Syuku': '',
    'Dela Gothic One': '',
    'RocknRoll One': '',
    'Potta One': '',
    'Reggae One': '',
    'Yusei Magic': '',
    'DotGothic16': '',
    'Stick': '',
    'Yomogi': '',
    'Hachi Maru Pop': '',
    'Pacifico': '',
    'Caveat': ':wght@400;700',
    'Lobster': '',
    'Playfair Display': ':wght@400;700;900',
    Fraunces: ':opsz,wght@9..144,400;9..144,900',
    'DM Serif Display': '',
    'Abril Fatface': '',
    'Bebas Neue': '',
    Anton: '',
    'Archivo Black': '',
    'Bricolage Grotesque': ':wght@400;800',
    Syne: ':wght@600;800',
    Orbitron: ':wght@500;800',
    'Russo One': '',
    'Righteous': '',
    Unbounded: ':wght@500;800',
    Monoton: '',
    'Press Start 2P': '',
    'Space Mono': ':wght@400;700',
    'JetBrains Mono': ':wght@400;700',
    Sora: ':wght@400;700'
  };

  const ADAPTERS = {
    tv: {
      pageId: 'tv',
      label: '百家樂路單・電視版',
      settingsKey: 'tv-edit-mode:settings',
      editorOrigin: EDITOR,
      allowedProps: ALLOWED_PROPS.slice()
    }
  };

  function registerPageAdapter(config) {
    if (!config || typeof config !== 'object') throw new Error('無效的 adapter 設定');
    const pageId = String(config.pageId || '').trim();
    if (!pageId || !/^[a-z0-9_-]{1,40}$/i.test(pageId)) throw new Error('無效的 pageId');
    const entry = {
      pageId: pageId,
      label: String(config.label || pageId),
      settingsKey: String(config.settingsKey || (pageId + '-edit-mode:settings')),
      editorOrigin: String(config.editorOrigin || EDITOR),
      allowedProps: Array.isArray(config.allowedProps) && config.allowedProps.length ? config.allowedProps.slice() : ALLOWED_PROPS.slice()
    };
    ADAPTERS[pageId] = entry;
    return entry;
  }

  function getPageAdapter(pageId) {
    const key = String(pageId || 'tv').trim();
    return ADAPTERS[key] || ADAPTERS.tv;
  }

  let session = null;
  let targetCounter = 0;

  function splitFamilies(stack) {
    const out = [];
    const text = String(stack);
    let i = 0;
    while (i < text.length) {
      while (i < text.length && (text[i] === ' ' || text[i] === ',')) i += 1;
      if (i >= text.length) break;
      if (text[i] === '"') {
        const end = text.indexOf('"', i + 1);
        if (end < 0) return null;
        out.push(text.slice(i + 1, end));
        i = end + 1;
      } else {
        const start = i;
        while (i < text.length && text[i] !== ',') i += 1;
        out.push(text.slice(start, i).trim());
      }
    }
    return out;
  }

  function validFamily(stack) {
    if (typeof stack !== 'string' || stack.length < 1 || stack.length > 400) return false;
    if (FORBIDDEN_TOKEN.test(stack)) return false;
    const names = splitFamilies(stack);
    if (!names || !names.length) return false;
    return names.every(function (name) {
      if (!name || name.length > 80) return false;
      if (GENERICS[name]) return true;
      return /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(name);
    });
  }

  function validWeight(weight) {
    const n = typeof weight === 'string' && weight.trim() !== '' ? Number(weight) : weight;
    return typeof n === 'number' && Number.isInteger(n) && n >= 100 && n <= 900 && n % 100 === 0;
  }

  function validColor(value) {
    if (typeof value !== 'string') return false;
    const text = value.trim();
    if (!text || text.length > 64 || FORBIDDEN_TOKEN.test(text)) return false;
    if (text.toLowerCase() === 'transparent') return true;
    if (/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(text)) return true;
    const m = text.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+|1\.0+))?\s*\)$/i);
    if (!m) return false;
    return Number(m[1]) <= 255 && Number(m[2]) <= 255 && Number(m[3]) <= 255;
  }

  function validPx(value, min, max) {
    if (typeof value === 'number') {
      if (!isFinite(value) || value < min || value > max) return null;
      return (Math.round(value * 10) / 10) + 'px';
    }
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (FORBIDDEN_TOKEN.test(text)) return null;
    const m = text.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/i);
    if (!m) return null;
    const n = Number(m[1]);
    if (!isFinite(n) || n < min || n > max) return null;
    return (Math.round(n * 10) / 10) + 'px';
  }

  function validBorderStyle(value) {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BORDER_STYLES, value);
  }

  function splitShadowLayers(raw) {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === ',' && depth === 0) {
        out.push(raw.slice(start, i).trim());
        start = i + 1;
      }
    }
    const tail = raw.slice(start).trim();
    if (tail) out.push(tail);
    return out;
  }

  function parseSingleShadow(layer) {
    let rest = String(layer || '').trim();
    if (!rest) return null;
    let inset = false;
    if (/^inset\b/i.test(rest)) {
      inset = true;
      rest = rest.replace(/^inset\s+/i, '').trim();
    } else if (/\binset$/i.test(rest)) {
      inset = true;
      rest = rest.replace(/\s+inset$/i, '').trim();
    }
    let color = '';
    const cStart = rest.match(/^(#[\da-f]{3,8}|rgba?\([^)]+\)|transparent)\s+(.*)$/i);
    if (cStart) {
      color = cStart[1].trim();
      rest = cStart[2].trim();
    } else {
      const cEnd = rest.match(/^(.*?)\s+(#[\da-f]{3,8}|rgba?\([^)]+\)|transparent)$/i);
      if (cEnd) {
        rest = cEnd[1].trim();
        color = cEnd[2].trim();
      }
    }
    if (!color || !validColor(color)) return null;
    const parts = rest.split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 4) return null;
    const pxs = [];
    for (let i = 0; i < parts.length; i++) {
      const px = validPx(parts[i], i === 2 ? 0 : -200, 200);
      if (!px) return null;
      pxs.push(px);
    }
    while (pxs.length < 4) pxs.push('0px');
    return (inset ? 'inset ' : '') + pxs.join(' ') + ' ' + color;
  }

  function validBoxShadow(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text || text.length > 320 || FORBIDDEN_TOKEN.test(text)) return null;
    if (text.toLowerCase() === 'none') return 'none';
    const layers = splitShadowLayers(text);
    if (!layers.length || layers.length > 4) return null;
    const out = [];
    for (let i = 0; i < layers.length; i++) {
      const one = parseSingleShadow(layers[i]);
      if (!one) return null;
      out.push(one);
    }
    return out.join(', ');
  }

  function hasWebFamily(stack) {
    const names = splitFamilies(stack) || [];
    return names.some(function (name) { return Object.prototype.hasOwnProperty.call(WEB, name); });
  }

  function sanitizeStylePayload(data, pageId) {
    if (!data || typeof data !== 'object') return { ok: false, styles: {}, error: '樣式資料無效，已略過。' };
    const adapter = getPageAdapter(pageId || data.pageId || 'tv');
    const allow = {};
    adapter.allowedProps.forEach(function (k) { allow[k] = 1; });

    const src = data.styles && typeof data.styles === 'object' && !Array.isArray(data.styles)
      ? Object.assign({}, data.styles)
      : {};
    if (data.family !== undefined && src.fontFamily === undefined) src.fontFamily = data.family;
    if (data.weight !== undefined && src.fontWeight === undefined) src.fontWeight = data.weight;
    if (data.source !== undefined && src.fontSource === undefined) src.fontSource = data.source;

    if (src.fontSource === 'upload' || data.source === 'upload') {
      return { ok: false, styles: {}, error: '上傳的字型檔無法在路單頁使用。' };
    }

    const out = {};

    if (src.color !== undefined && src.color !== '' && allow.color) {
      if (!validColor(src.color)) return { ok: false, styles: {}, error: '字色格式無效，已略過。' };
      out.color = String(src.color).trim();
    }
    if (src.fontFamily !== undefined && src.fontFamily !== '' && allow.fontFamily) {
      if (!validFamily(src.fontFamily)) return { ok: false, styles: {}, error: '字型資料無效，已略過。' };
      out.fontFamily = src.fontFamily;
      out.fontSource = src.fontSource === 'web' || hasWebFamily(src.fontFamily) ? 'web' : 'local';
    }
    if (src.fontWeight !== undefined && src.fontWeight !== '' && allow.fontWeight) {
      if (!validWeight(src.fontWeight)) return { ok: false, styles: {}, error: '字重資料無效，已略過。' };
      out.fontWeight = String(Number(src.fontWeight));
    }
    if (src.fontSize !== undefined && src.fontSize !== '' && allow.fontSize) {
      const fs = validPx(src.fontSize, 6, 160);
      if (!fs) return { ok: false, styles: {}, error: '文字大小無效，已略過。' };
      out.fontSize = fs;
    }
    if (src.borderWidth !== undefined && src.borderWidth !== '' && allow.borderWidth) {
      const bw = validPx(src.borderWidth, 0, 40);
      if (!bw) return { ok: false, styles: {}, error: '邊框粗細無效，已略過。' };
      out.borderWidth = bw;
    }
    if (src.borderStyle !== undefined && src.borderStyle !== '' && allow.borderStyle) {
      if (!validBorderStyle(src.borderStyle)) return { ok: false, styles: {}, error: '邊框樣式無效，已略過。' };
      out.borderStyle = src.borderStyle;
    }
    if (src.borderColor !== undefined && src.borderColor !== '' && allow.borderColor) {
      if (!validColor(src.borderColor)) return { ok: false, styles: {}, error: '邊框顏色無效，已略過。' };
      out.borderColor = String(src.borderColor).trim();
    }
    if (src.borderRadius !== undefined && src.borderRadius !== '' && allow.borderRadius) {
      const br = validPx(src.borderRadius, 0, 200);
      if (!br) return { ok: false, styles: {}, error: '邊框圓角無效，已略過。' };
      out.borderRadius = br;
    }
    if (src.boxShadow !== undefined && src.boxShadow !== '' && allow.boxShadow) {
      const bs = validBoxShadow(src.boxShadow);
      if (!bs) return { ok: false, styles: {}, error: '陰影格式無效，已略過。' };
      out.boxShadow = bs;
    }

    if (!Object.keys(out).length) {
      return { ok: false, styles: {}, error: '沒有可套用的樣式欄位。' };
    }
    return { ok: true, styles: out };
  }

  function syncColorAttr(el) {
    if (!el || !el.style) return;
    if (el.style.color) {
      if (typeof el.setAttribute === 'function') el.setAttribute('data-tv-edit-color', '');
    } else if (typeof el.removeAttribute === 'function') {
      el.removeAttribute('data-tv-edit-color');
    }
  }

  function captureSnapshot(targets) {
    return (targets || []).map(function (el) {
      const item = {
        el: el,
        hadEditColor: typeof el.hasAttribute === 'function' ? el.hasAttribute('data-tv-edit-color') : false
      };
      ALLOWED_PROPS.forEach(function (prop) {
        item[prop] = (el.style && el.style[prop]) || '';
      });
      return item;
    });
  }

  function restore(snapshot) {
    (snapshot || []).forEach(function (item) {
      if (!item || !item.el || item.el.isConnected === false) return;
      ALLOWED_PROPS.forEach(function (prop) {
        item.el.style[prop] = item[prop] || '';
      });
      if (item.hadEditColor || item.el.style.color) {
        if (typeof item.el.setAttribute === 'function') item.el.setAttribute('data-tv-edit-color', '');
      } else if (typeof item.el.removeAttribute === 'function') {
        item.el.removeAttribute('data-tv-edit-color');
      }
    });
  }

  function applyStyles(targets, snapshot, styles) {
    if (snapshot) restore(snapshot);
    (targets || []).forEach(function (el) {
      if (!el || el.isConnected === false) return;
      const keepFontSize = el.style.fontSize;
      ALLOWED_PROPS.forEach(function (prop) {
        if (styles[prop] !== undefined) {
          el.style[prop] = String(styles[prop]);
        }
      });
      if (styles.fontSize === undefined && styles.fontFamily !== undefined) {
        el.style.fontSize = keepFontSize;
      }
      if (styles.borderWidth !== undefined && parseFloat(styles.borderWidth) > 0 && styles.borderStyle === undefined) {
        const curStyle = el.style.borderStyle;
        if (!curStyle || curStyle === 'none' || curStyle === 'hidden') {
          el.style.borderStyle = 'solid';
        }
      }
      if (styles.color !== undefined) {
        syncColorAttr(el);
      }
    });
  }

  function ensureWeb(stack, current, epoch, targetId, stylesCopy) {
    if (typeof document === 'undefined') return;
    const names = (splitFamilies(stack) || []).filter(function (name) { return Object.prototype.hasOwnProperty.call(WEB, name); });
    if (!names.length) return;
    let link = document.getElementById('tv-bridge-web-fonts');
    if (!link) {
      link = document.createElement('link');
      link.id = 'tv-bridge-web-fonts';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    const have = (link.getAttribute('data-families') || '').split('|').filter(Boolean);
    names.forEach(function (name) { if (have.indexOf(name) < 0) have.push(name); });
    link.setAttribute('data-families', have.join('|'));
    const href = 'https://fonts.googleapis.com/css2?' + have.map(function (name) {
      return 'family=' + name.replace(/ /g, '+') + WEB[name];
    }).join('&') + '&display=swap';
    if (link.href !== href) link.href = href;
    link.addEventListener('load', function () {
      if (session !== current || current.epoch !== epoch || current.targetId !== targetId || current.committed || stale(current)) return;
      applyStyles(current.targets, current.snapshot, stylesCopy);
    });
  }

  function stale(current) {
    if (!current.targets.length || !current.targets.every(function (el) { return el && el.isConnected !== false; })) return true;
    return current.isCurrent ? !current.isCurrent() : false;
  }

  function sendTargetState(current) {
    if (!current || !current.win || current.win.closed) return;
    try {
      current.win.postMessage({
        kind: KIND,
        nonce: current.nonce,
        action: 'target',
        pageId: current.pageId,
        targetId: current.targetId,
        label: current.label,
        styles: current.initialStyles
      }, current.editorOrigin);
    } catch (_) { /* 視窗可能尚未完成載入 */ }
  }

  function end(current, mode) {
    if (!session || session !== current) return;
    if (typeof window !== 'undefined' && current.onMessage) {
      window.removeEventListener('message', current.onMessage);
    }
    if (current.timer) clearInterval(current.timer);
    if (mode === 'restore' && !current.committed) restore(current.snapshot);
    if (current.win && !current.win.closed) {
      try { current.win.close(); } catch (err) { /* 視窗可能已經關掉 */ }
    }
    session = null;
  }

  function makeNonce() {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function open(opts) {
    if (session) end(session, 'restore');
    const status = opts.statusEl;
    const adapter = getPageAdapter(opts.pageId || 'tv');
    const nonce = opts.nonce && /^[a-f0-9]{32}$/.test(opts.nonce) ? opts.nonce : makeNonce();
    const win = opts.win || (typeof window !== 'undefined' ? window.open('about:blank', 'tvFontBridge') : null);
    if (!win) {
      if (status) status.textContent = '瀏覽器擋住了風格編輯器視窗。請允許彈出視窗後再試。';
      return null;
    }
    targetCounter += 1;
    const targetId = opts.targetId || ('target-' + targetCounter);
    const current = {
      nonce: nonce,
      win: win,
      pageId: adapter.pageId,
      editorOrigin: adapter.editorOrigin,
      workbench: opts.workbench !== false,
      targetId: targetId,
      label: opts.label || '目前選取元素',
      initialStyles: opts.initialStyles || {},
      targets: (opts.targets || []).slice(),
      snapshot: captureSnapshot(opts.targets || []),
      activeStyles: {},
      committed: false,
      epoch: 0,
      lastSeq: 0,
      isCurrent: opts.isCurrent,
      commit: opts.commit,
      resolveTarget: opts.resolveTarget,
      status: status,
      timer: 0,
      onMessage: null
    };

    current.onMessage = function (event) {
      if (!session || session !== current) return;
      if (event.source !== current.win) return;
      if (event.origin !== current.editorOrigin) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || data.kind !== KIND || data.nonce !== current.nonce) return;

      if (data.action === 'ready') {
        sendTargetState(current);
        return;
      }

      if (data.targetId && data.targetId !== current.targetId) {
        return;
      }

      if (data.action === 'cancel') {
        if (!current.committed) restore(current.snapshot);
        current.activeStyles = {};
        if (data.keepOpen) {
          current.committed = false;
          if (status) status.textContent = '已取消預覽並還原樣式';
          return;
        }
        end(current, 'restore');
        if (status) status.textContent = '已取消字型';
        return;
      }

      if (stale(current)) {
        end(current, 'restore');
        if (status) status.textContent = '選取已變更，已還原字型。';
        return;
      }

      if (data.action === 'unavailable') {
        if (status) status.textContent = '上傳的字型檔無法在路單頁使用。';
        return;
      }

      if (data.action !== 'preview' && data.action !== 'commit') return;
      if (typeof data.seq !== 'number' || !Number.isInteger(data.seq) || data.seq <= current.lastSeq) return;

      const checked = sanitizeStylePayload(data, current.pageId);
      if (!checked.ok) {
        if (status) status.textContent = checked.error;
        return;
      }

      current.lastSeq = data.seq;
      current.epoch += 1;
      const epoch = current.epoch;
      const activeTargetId = current.targetId;
      current.committed = false;
      current.activeStyles = Object.assign({}, current.activeStyles, checked.styles);
      const stylesCopy = Object.assign({}, current.activeStyles);

      if (stylesCopy.fontFamily && stylesCopy.fontSource === 'web') {
        ensureWeb(stylesCopy.fontFamily, current, epoch, activeTargetId, stylesCopy);
      }
      applyStyles(current.targets, current.snapshot, stylesCopy);

      if (data.action === 'preview') {
        if (status) status.textContent = '預覽中。按編輯器的「確定」才會保留。';
        return;
      }

      current.committed = true;
      try {
        if (current.commit) current.commit(stylesCopy, current.targets.slice());
      } catch (err) {
        current.committed = false;
        restore(current.snapshot);
        console.error(err);
        if (status) status.textContent = '套用失敗';
        return;
      }

      current.snapshot = captureSnapshot(current.targets);
      current.activeStyles = {};
      if (data.keepOpen) {
        if (status) status.textContent = '已套用工作台樣式';
        return;
      }
      end(current, 'keep');
      if (status) status.textContent = '已套用字型';
    };

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('message', current.onMessage);
    }
    if (typeof setInterval === 'function' && !opts.skipPoll) {
      current.timer = setInterval(function () {
        if (current.win.closed) end(current, current.committed ? 'keep' : 'restore');
      }, 400);
    }
    session = current;

    if (opts.skipNavigate || typeof fetch !== 'function') {
      return current;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 1200);
    fetch(adapter.editorOrigin + '/?tvFontBridge=1', { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal }).then(function () {
      clearTimeout(timer);
      return true;
    }, function () {
      clearTimeout(timer);
      return false;
    }).then(function (up) {
      if (session !== current) return;
      if (!up || current.win.closed) {
        end(current, 'restore');
        if (status) status.textContent = '風格編輯器未開啟。請先啟動 http://127.0.0.1:5199/ ，再按選擇字型或工作台。';
        return;
      }
      const originParam = (typeof location !== 'undefined' && location.origin && location.origin !== 'null')
        ? '&origin=' + encodeURIComponent(location.origin)
        : '';
      const initParam = current.initialStyles && Object.keys(current.initialStyles).length
        ? '&init=' + encodeURIComponent(JSON.stringify(current.initialStyles))
        : '';
      const labelParam = current.label ? '&label=' + encodeURIComponent(current.label) : '';
      const url = adapter.editorOrigin +
        '/?tvFontBridge=1&workbench=1&page=' + encodeURIComponent(current.pageId) +
        '&nonce=' + nonce +
        '&targetId=' + encodeURIComponent(current.targetId) +
        labelParam +
        originParam +
        initParam;
      current.win.location.replace(url);
    });
    return current;
  }

  function abandon() {
    if (session) end(session, 'restore');
  }

  function noteSelection(el, nextGroup) {
    if (!session) return;
    if (!el || el.isConnected === false) {
      end(session, 'restore');
      return;
    }
    const nextTargets = Array.isArray(nextGroup) && nextGroup.length
      ? nextGroup.filter(function (n) { return n && n.isConnected !== false; })
      : [el];
    const sameTargets = nextTargets.length === session.targets.length &&
      nextTargets.every(function (n, idx) { return session.targets[idx] === n; });
    if (sameTargets) return;

    if (!session.committed) {
      restore(session.snapshot);
    }

    if (session.win && !session.win.closed && typeof session.resolveTarget === 'function') {
      targetCounter += 1;
      const info = session.resolveTarget(el, nextTargets) || {};
      session.targets = nextTargets;
      session.snapshot = captureSnapshot(nextTargets);
      session.targetId = info.targetId || ('target-' + targetCounter);
      session.label = info.label || '目前選取元素';
      session.initialStyles = info.styles || {};
      session.activeStyles = {};
      session.committed = false;
      session.epoch += 1;
      sendTargetState(session);
      if (session.status) session.status.textContent = '目標已變更，未確定預覽已還原並切換至：' + session.label;
      return;
    }

    end(session, 'restore');
  }

  root.TvFontBridge = {
    open: open,
    abandon: abandon,
    noteSelection: noteSelection,
    registerPageAdapter: registerPageAdapter,
    getPageAdapter: getPageAdapter,
    sanitizeStylePayload: sanitizeStylePayload,
    validFamily: validFamily,
    validWeight: validWeight,
    validColor: validColor,
    validPx: validPx,
    validBorderStyle: validBorderStyle,
    validBoxShadow: validBoxShadow
  };
})(typeof window !== 'undefined' ? window : globalThis);
