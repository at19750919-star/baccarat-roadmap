/* 百家樂電視路單・布局提案 JS（隔離副本）
   在官方 applyLayout() 之後覆寫列高與格網變數，不改路單演算法、存檔或投注。
   底列不再用 --tv-bottom-scale 整區縮放；格子先定正方形與固定欄數，
   剩餘高度由頂列吸收，統計／下局指示在各自區域內適應。 */
(function () {
  const TITLE_MIN = 156;
  const APP_PAD = 20;
  const ROW_GAPS = 24;
  const BOARD_BORDER = 2;
  const DERIVED_COLS = 46;
  const BEAD_COLS = 19;
  const STAR_COLS = 23;
  const STATS_W = 622;
  const PREDICT_W = 162;
  const BOTTOM_GAP = 6;
  let applying = false;
  let scheduled = false;
  let lastSignature = '';
  let hooked = false;

  function px(cs, prop) {
    return parseFloat(cs.getPropertyValue(prop)) || 0;
  }

  function box(el) {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const padL = px(cs, 'padding-left');
    const padR = px(cs, 'padding-right');
    const padT = px(cs, 'padding-top');
    const padB = px(cs, 'padding-bottom');
    const bL = px(cs, 'border-left-width');
    const bR = px(cs, 'border-right-width');
    const bT = px(cs, 'border-top-width');
    const bB = px(cs, 'border-bottom-width');
    return {
      boxSizing: cs.boxSizing,
      offsetW: el.offsetWidth,
      offsetH: el.offsetHeight,
      clientW: el.clientWidth,
      clientH: el.clientHeight,
      padX: padL + padR,
      padY: padT + padB,
      borderX: bL + bR,
      borderY: bT + bB,
      contentW: el.clientWidth - padL - padR,
      contentH: el.clientHeight - padT - padB
    };
  }

  // Re-render using the proposal column counts without touching tv.js closures.
  // renderDerived/renderBead with a target skip tv.js's 45/16 window and hit app.js.
  function syncRoadColumns(cols) {
    if (!cols || typeof state !== 'object' || !state.rounds) return;
    if (typeof buildBigRoad === 'function' && typeof buildDerivedRoad === 'function' && typeof renderDerived === 'function' && typeof layoutDerivedMarks === 'function') {
      const big = buildBigRoad(state.rounds);
      const roads = [
        ['bigEye', buildDerivedRoad(big.grid, 1, big.cols, big.rows), 'hollow'],
        ['smallRoad', buildDerivedRoad(big.grid, 2, big.cols, big.rows), 'solid'],
        ['cockroachRoad', buildDerivedRoad(big.grid, 3, big.cols, big.rows), 'slash']
      ];
      for (const [id, marks, shape] of roads) {
        const el = document.getElementById(id);
        if (!el) continue;
        const laid = layoutDerivedMarks(marks, 6);
        const offset = Math.max(0, laid.cols - cols.derived);
        renderDerived(id, marks, shape, { target: el, cols: Math.max(cols.derived, laid.cols) });
        for (const cell of el.children) {
          const col = Number(cell.style.gridColumn) - offset;
          if (col > 0) cell.style.gridColumn = String(col);
        }
        if (offset) {
          for (let i = 0; i < offset * 6; i += 1) {
            if (el.firstElementChild) el.firstElementChild.remove();
          }
        }
      }
    }
    const beadEl = document.getElementById('beadBoard');
    if (beadEl && typeof renderBead === 'function') {
      const visible = state.rounds.slice(-cols.bead * 6);
      renderBead(visible, beadEl, cols.bead);
    }
    queueMicrotask(() => {
      if (window.BaccaratTVView && typeof BaccaratTVView.renderStarRoad === 'function') {
        BaccaratTVView.renderStarRoad({ cols: cols.star });
      }
    });
  }

  function hookRenderAll() {
    if (hooked || typeof renderAll !== 'function') return;
    const orig = renderAll;
    renderAll = function () {
      orig();
      if (window.__tvProposalCols) syncRoadColumns(window.__tvProposalCols);
    };
    hooked = true;
  }

  function applyProposalLayout() {
    const app = document.querySelector('.tv-app');
    if (!app || applying) return;
    const bigBoard = document.getElementById('bigRoad');
    const eye = document.getElementById('bigEye');
    const bead = document.getElementById('beadBoard');
    const star = document.getElementById('starRoad');
    if (!bigBoard || !eye || !bead) return;

    applying = true;
    try {
      hookRenderAll();
      const set = (key, value) => { app.style.setProperty(key, value); };
      const contentH = app.clientHeight - APP_PAD;
      const contentW = app.clientWidth - APP_PAD;
      const officialColsBig = parseFloat(getComputedStyle(app).getPropertyValue('--cols-big')) || 46;

      const bigPanel = bigBoard.parentElement;
      const bigPanelBox = box(bigPanel);
      const bigAvailW = bigPanelBox.contentW - BOARD_BORDER;
      const bigCell = bigAvailW / officialColsBig;
      const bigHeight = bigCell * 6 + bigPanelBox.borderY + bigPanelBox.padY + BOARD_BORDER;

      const eyePanel = eye.parentElement;
      const eyeBox = box(eyePanel);
      const derivedAvailW = eyeBox.contentW - BOARD_BORDER;
      // 下三路小格連動大路：大路 1 格 = 4 小格
      const derivedCell = bigCell / 2;
      const derivedCols = Math.max(1, Math.floor((derivedAvailW + 0.01) / derivedCell));
      const derivedHeight = derivedCell * 6 + eyeBox.borderY + eyeBox.padY + BOARD_BORDER;

      // Real design px: no nested scale on the whole bottom row.
      set('--tv-bottom-scale', '1');
      set('--tv-bottom-width', `${contentW}px`);
      set('--tv-stats-width', `${STATS_W}px`);
      set('--tv-predict-width', `${PREDICT_W}px`);
      set('--tv-bottom-gap', `${BOTTOM_GAP}px`);
      set('--cell-big', `${bigCell}px`);
      set('--cell-derived', `${derivedCell}px`);
      set('--cols-big', String(officialColsBig));
      set('--cols-derived', String(derivedCols));

      // Temporary track so the bead panel gets its final unscaled width.
      const tentativeBottom = Math.max(200, contentH - TITLE_MIN - bigHeight - 2 * derivedHeight - ROW_GAPS);
      app.style.gridTemplateRows = `${TITLE_MIN}px ${bigHeight}px ${derivedHeight}px ${derivedHeight}px ${tentativeBottom}px`;

      void bead.offsetWidth;
      const beadPanel = bead.parentElement;
      const beadBox = box(beadPanel);
      const beadAvailW = beadBox.contentW - BOARD_BORDER;
      const beadCols = BEAD_COLS;
      const beadCell = beadAvailW / beadCols;
      const beadBoardH = beadCell * 6 + BOARD_BORDER;
      const bottomHeight = beadBoardH + beadBox.borderY + beadBox.padY;
      set('--cell-bead', `${beadCell}px`);
      set('--cols-bead', String(beadCols));

      let starCols = STAR_COLS;
      let starCell = derivedCell * 2;
      if (star) {
        const starPanel = star.parentElement;
        const starBox = box(starPanel);
        const starAvailW = starBox.contentW - BOARD_BORDER;
        // 三星路格子跟大路同大
        starCell = bigCell;
        starCols = Math.max(1, Math.floor((starAvailW + 0.01) / starCell));
        set('--cols-star', String(starCols));
        set('--cell-star-fit', `${starCell}px`);
      }

      const titleH = contentH - bigHeight - 2 * derivedHeight - bottomHeight - ROW_GAPS;
      app.style.gridTemplateRows = `${titleH}px ${bigHeight}px ${derivedHeight}px ${derivedHeight}px ${bottomHeight}px`;
      set('--tv-logo-slot-h', `${titleH}px`);
      // Keep only the text below the header; the dragon video and stage stay put.
      const dragonOverlay = document.getElementById('dragonOverlay');
      const titleBar = app.querySelector('.title-bar');
      if (dragonOverlay && titleBar) {
        const scale = app.getBoundingClientRect().width / (app.offsetWidth || 1);
        dragonOverlay.style.setProperty('--tv-dragon-text-top', `${titleBar.getBoundingClientRect().bottom + 24 * scale}px`);
      }
      const slot = document.querySelector('.tv-brand-slot');
      const sizeEl = document.querySelector('.tv-brand-placeholder-size');
      const ph = document.querySelector('.tv-brand-placeholder');
      if (slot) {
        const appScale = app.getBoundingClientRect().width / (app.offsetWidth || 1);
        const sr = slot.getBoundingClientRect();
        const sw = +(sr.width / appScale).toFixed(1);
        const sh = +(sr.height / appScale).toFixed(1);
        if (sizeEl) sizeEl.textContent = `${Math.round(sw)} × ${Math.round(sh)}`;
        if (ph) ph.setAttribute('aria-label', `品牌 logo 佔位 ${Math.round(sw)} × ${Math.round(sh)}`);
      }

      const cols = { derived: derivedCols, bead: beadCols, star: starCols };
      window.__tvProposalCols = cols;

      const signature = [titleH, officialColsBig, bigCell, derivedCols, derivedCell, derivedHeight, bottomHeight, beadCols, beadCell].map((n) => Number(n).toFixed(4)).join('|');
      if (signature !== lastSignature) {
        lastSignature = signature;
        if (typeof renderAll === 'function') renderAll();
        else syncRoadColumns(cols);
      } else {
        syncRoadColumns(cols);
      }

      if (window.BaccaratTVView && typeof BaccaratTVView.fitStats === 'function') {
        requestAnimationFrame(() => BaccaratTVView.fitStats());
      }
    } finally {
      applying = false;
    }
  }

  function schedule() {
    if (scheduled || applying) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyProposalLayout();
    });
  }

  function install() {
    const app = document.querySelector('.tv-app');
    if (!app) return;
    hookRenderAll();
    const origSet = app.style.setProperty.bind(app.style);
    app.style.setProperty = function (key, value, priority) {
      origSet(key, value, priority);
      if (!applying) schedule();
    };
    window.addEventListener('resize', schedule);
    applyProposalLayout();
    window.__tvLayoutProposal = { apply: applyProposalLayout, TITLE_MIN, box, syncRoadColumns };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();

/* 莊閒完整影片均加速至 5.5 秒後自然淡出。限紅僅能從黑桃設定修改。 */
(function () {
  const LIMIT_STORE_KEY = 'baccarat_tv_limits_v1';

  function installDragonPlayback() {
    const overlay = document.getElementById('dragonOverlay');
    const video = document.getElementById('dragonVideo');
    if (!overlay || typeof DragonFx === 'undefined' || typeof DragonFx.triggerShowcase !== 'function') {
      if (!installDragonPlayback.scheduled) {
        installDragonPlayback.scheduled = true;
        setTimeout(installDragonPlayback, 0);
      }
      return;
    }
    if (installDragonPlayback.ready) return;
    installDragonPlayback.ready = true;
    if (video) {
      video.loop = false;
      video.removeAttribute('loop');
    }

    const origFade = DragonFx.fadeOut.bind(DragonFx);

    DragonFx.fadeOut = function () {
      origFade();
    };

    const origTrigger = DragonFx.triggerShowcase.bind(DragonFx);
    DragonFx.triggerShowcase = function (color, len, isComboHit) {
      if (overlay.classList.contains('active') && !overlay.classList.contains('fading-out')) {
        const comboEl = document.getElementById('dragonCombo');
        if (comboEl) comboEl.textContent = String(len);
        return;
      }
      origTrigger(color, len, isComboHit);
    };

    if (window.BaccaratDragonVideo && typeof BaccaratDragonVideo.play === 'function') {
      const origPlay = BaccaratDragonVideo.play.bind(BaccaratDragonVideo);
      BaccaratDragonVideo.play = function (color, onEnded, onFallback) {
        if (video) {
          video.loop = false;
          video.removeAttribute('loop');
        }
        return origPlay(color, function () {
          DragonFx.fadeOut();
        }, onFallback);
      };
    }
  }

  function formatLimitValue(raw) {
    const digits = String(raw == null ? '' : raw).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function displayInputs() {
    return [...document.querySelectorAll('.tv-app .tv-limit .limit-input')];
  }

  function collectLimits() {
    const out = {};
    displayInputs().forEach((input) => {
      if (input.dataset.k) out[input.dataset.k] = input.value;
    });
    return out;
  }

  function writeDisplay(map) {
    displayInputs().forEach((input) => {
      const key = input.dataset.k;
      if (!key || map[key] == null) return;
      input.value = formatLimitValue(map[key]);
    });
  }

  function persistLimits() {
    try { localStorage.setItem(LIMIT_STORE_KEY, JSON.stringify(collectLimits())); } catch (_) {}
  }

  function restoreLimits() {
    try {
      const saved = JSON.parse(localStorage.getItem(LIMIT_STORE_KEY) || 'null');
      if (saved && typeof saved === 'object') writeDisplay(saved);
    } catch (_) {}
  }

  function lockDisplayLimits() {
    displayInputs().forEach((input) => {
      input.readOnly = true;
      input.tabIndex = -1;
      input.setAttribute('aria-readonly', 'true');
      const block = (event) => {
        event.preventDefault();
        event.stopPropagation();
        input.blur();
      };
      ['mousedown', 'click', 'dblclick', 'touchstart', 'keydown', 'paste'].forEach((type) => {
        input.addEventListener(type, block, true);
      });
      input.addEventListener('focus', () => input.blur(), true);
    });
  }

  function installLimitSettings() {
    restoreLimits();
    lockDisplayLimits();
    const panel = document.getElementById('tvBasicPanel');
    const form = document.getElementById('tvSettingsForm');
    const dialog = document.getElementById('tvSettings');
    if (!panel || !form || !dialog) return;
    if (document.getElementById('tvProposalLimitSettings')) return;

    const wrap = document.createElement('div');
    wrap.id = 'tvProposalLimitSettings';
    const grid = document.createElement('div');
    grid.className = 'tv-size-settings';
    displayInputs().forEach((input) => {
      const label = document.createElement('label');
      const caption = document.createElement('span');
      caption.textContent = input.getAttribute('aria-label') || input.dataset.k || '限紅';
      const editor = document.createElement('input');
      editor.type = 'text';
      editor.inputMode = 'numeric';
      editor.dataset.limitKey = input.dataset.k;
      editor.value = input.value;
      editor.addEventListener('input', () => {
        editor.value = editor.value.replace(/\D/g, '');
        writeDisplay({ [input.dataset.k]: editor.value });
      });
      editor.addEventListener('blur', () => {
        editor.value = formatLimitValue(editor.value);
        writeDisplay({ [input.dataset.k]: editor.value });
      });
      label.append(caption, editor);
      grid.append(label);
    });
    wrap.append(grid);
    const help = panel.querySelector('.tv-settings-help');
    if (help) panel.insertBefore(wrap, help);
    else panel.append(wrap);

    let snapshot = null;
    let savedThisOpen = false;
    const button = document.getElementById('tvSettingsButton');
    if (button) {
      button.addEventListener('click', () => {
        snapshot = collectLimits();
        savedThisOpen = false;
        wrap.querySelectorAll('input[data-limit-key]').forEach((editor) => {
          const src = displayInputs().find((item) => item.dataset.k === editor.dataset.limitKey);
          if (src) editor.value = src.value;
        });
      });
    }
    form.addEventListener('submit', () => {
      wrap.querySelectorAll('input[data-limit-key]').forEach((editor) => {
        writeDisplay({ [editor.dataset.limitKey]: editor.value });
      });
      persistLimits();
      savedThisOpen = true;
    });
    document.getElementById('tvSettingsCancel')?.addEventListener('click', () => {
      if (snapshot) writeDisplay(snapshot);
    });
    dialog.addEventListener('close', () => {
      if (!savedThisOpen && snapshot) writeDisplay(snapshot);
    });
  }

  function install() {
    installDragonPlayback();
    installLimitSettings();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
