// Symbol controls share the existing TV settings save/cancel transaction.
(function () {
  'use strict';
  const defaults = {
    bead: {
      number: { x: 7, y: 9, size: 38, halo: 18, opacity: 100 },
      banker: { x: -4, y: -4, size: 38 },
      player: { x: -4, y: -4, size: 38 }
    },
    result: {
      number: { x: 7, y: 9, size: 89, halo: 0, opacity: 100 },
      banker: { x: 9, y: 9, size: 13 },
      player: { x: 9, y: 9, size: 13 }
    }
  };
  function bounds(scope, target, key) {
    if (key === 'size') return target === 'number' ? (scope === 'bead' ? [12, 80, 1] : [20, 180, 1]) : [5, 60, .5];
    if (key === 'halo') return [0, 50, 1];
    if (key === 'opacity') return [0, 100, 1];
    return [-20, 60, .5];
  }
  function normalize(value) {
    const result = structuredClone(defaults);
    for (const scope of Object.keys(defaults)) {
      for (const target of Object.keys(defaults[scope])) {
        for (const key of Object.keys(defaults[scope][target])) {
          const raw = value?.[scope]?.[target]?.[key];
          if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
          const [min, max, step] = bounds(scope, target, key);
          result[scope][target][key] = Math.max(min, Math.min(max, Math.round(raw / step) * step));
        }
      }
      // Old mismatched saves use banker values; player-only saves remain usable.
      for (const axis of ['x', 'y', 'size']) {
        const banker = value?.[scope]?.banker?.[axis];
        const anchor = typeof banker === 'number' && Number.isFinite(banker) ? 'banker' : 'player';
        const distance = result[scope][anchor][axis];
        result[scope].banker[axis] = distance;
        result[scope].player[axis] = distance;
      }
    }
    result.captions = BaccaratCaptionSettings.normalize(value?.captions);
    return result;
  }
  function apply(value) {
    const config = normalize(value);
    const style = document.documentElement.style;
    for (const scope of Object.keys(defaults)) {
      const targets = config[scope];
      for (const [target, fields] of Object.entries(targets)) {
        const prefix = `--tv-symbol-${scope}-${target}-`;
        style.setProperty(prefix + 'x', fields.x + '%');
        style.setProperty(prefix + 'y', fields.y + '%');
        style.setProperty(prefix + 'size', target === 'number'
          ? (scope === 'bead' ? fields.size / 100 : fields.size + 'px') : fields.size + '%');
        if (target === 'number') {
          const a = fields.opacity / 100;
          const shadow = !fields.halo || !a ? 'none' : [1 / 3, 2 / 3, 1].map((scale, index) =>
            `0 0 ${fields.halo / 100 * scale}em rgba(16,16,24,${a * (index === 2 ? .8 : 1)})`).join(', ');
          style.setProperty(prefix + 'shadow', shadow);
        }
      }
    }
    BaccaratCaptionSettings.apply(config.captions);
  }
  function init({ onChange }) {
    const panel = document.getElementById('tvSymbolsPanel');
    let value = normalize();
    let scope = 'bead';
    let target = 'number';
    let category = 'super';
    let previewReady = false;
    const fields = [
      ['x', 'X', '距右側'], ['y', 'Y', '距上緣'], ['size', 'Size', '字級'],
      ['halo', 'Halo', '光暈範圍'], ['opacity', 'Opacity', '光暈深度']
    ];
    panel.innerHTML = `
      <div class="tv-symbol-preview-head">
        <div class="tv-symbol-scopes" role="group" aria-label="調整範圍">
          <button type="button" data-symbol-scope="bead" aria-pressed="true">珠子路</button>
          <button type="button" data-symbol-scope="result" aria-pressed="false">開獎提示</button>
        </div>
        <div id="tvSymbolBeadPreview" class="tv-symbol-beads tv-app" aria-label="珠子路符號預覽"></div>
        <div id="tvSymbolResultPreview" class="tv-symbol-result result-announcement has-art has-seven is-visible" data-kind="super" hidden>
          <div class="tv-symbol-result-road" aria-hidden="true"><span>大路</span><span>大眼仔</span><span>小路</span></div>
          <div class="tv-symbol-result-stage"><div class="result-ribbon"></div><div class="result-medallion">
            <div class="result-disc"><img class="result-art" src="assets/beads/purple-seven.png" alt="超級幸運7"/></div>
            <span class="result-card-count">5</span>
            <span class="result-orbit"><i></i><i></i><i></i></span>
            <span class="result-pair-marker result-pair-marker-bp"></span>
            <span class="result-pair-marker result-pair-marker-pp"></span>
          </div><div class="result-title"></div><div class="result-english"></div></div>
        </div>
        <label class="tv-symbol-sample" hidden>符號類型 <select id="tvSymbolSample" aria-label="示範符號">
          <option value="lucky">幸運7</option><option value="super" selected>超級幸運7</option>
          <option value="small-tiger">小老虎</option><option value="big-tiger">大老虎</option>
        </select></label>
      </div>
      <label class="tv-symbol-target">調整項目 <select id="tvSymbolTarget">
        <option value="number">右上角數字</option><option value="banker">莊閒對圓點</option>
        <option value="title" data-caption-target>中文標題</option><option value="english" data-caption-target>英文副標</option>
      </select></label>
      <p id="tvSymbolPairHint" hidden>兩個圓點共用大小與距離，左上、右下鏡像對稱。</p>
      <div class="tv-symbol-controls">${fields.map(([key, id, label]) => `
        <div class="tv-symbol-control" data-symbol-row="${key}">
          <label for="tvSymbol${id}" data-symbol-label="${key}">${label}</label>
          <input id="tvSymbol${id}" type="range" data-symbol-field="${key}"/>
          <input id="tvSymbol${id}Value" type="number" data-symbol-value="${key}" aria-label="${label}數值" required/>
          <span class="tv-symbol-unit" data-symbol-unit="${key}">%</span>
        </div>`).join('')}</div>
      <div id="tvCaptionControls" hidden></div>
      <p class="tv-symbol-help">右上角數字固定白色。中文與英文可按四種符號分開設定；「恢復預設」只還原目前範圍。</p>`;
    const beadPreview = panel.querySelector('#tvSymbolBeadPreview');
    const resultPreview = panel.querySelector('#tvSymbolResultPreview');
    const targetInput = panel.querySelector('#tvSymbolTarget');
    const captionEditor = BaccaratCaptionSettings.init({ host: panel.querySelector('#tvCaptionControls'), onChange(captions) {
      value.captions = captions;
      onChange(normalize(value));
    } });
    const stage = resultPreview.querySelector('.tv-symbol-result-stage');
    function fitPreview() {
      if (!resultPreview.clientWidth) return;
      const scale = Math.min(.5, (resultPreview.clientWidth - 12) / 920, 210 / Math.max(1, stage.offsetHeight));
      stage.style.transform = `scale(${scale})`;
      resultPreview.style.height = Math.ceil(stage.offsetHeight * scale + 24) + 'px';
    }
    const observer = new ResizeObserver(fitPreview);
    observer.observe(stage); observer.observe(resultPreview);
    function buildBeadPreview() {
      if (previewReady) return;
      const board = document.createElement('div');
      const rounds = [3, 5].map(n => ({ r: 'P', ...(n < 4 ? { l7: n } : { s7: n }), bp: true, pp: true }));
      renderBead(rounds, board, 2);
      board.querySelectorAll('.bead').forEach(bead => {
        const cell = document.createElement('div');
        cell.className = 'tv-symbol-bead-cell';
        cell.appendChild(bead);
        beadPreview.appendChild(cell);
      });
      previewReady = true;
    }
    function sync() {
      panel.querySelectorAll('[data-symbol-scope]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.symbolScope === scope)));
      beadPreview.hidden = scope !== 'bead';
      resultPreview.hidden = scope !== 'result';
      panel.querySelector('.tv-symbol-sample').hidden = scope !== 'result';
      const animal = category === 'small-tiger' || category === 'big-tiger';
      const countOption = targetInput.querySelector('[value=number]');
      countOption.disabled = scope === 'result' && animal; countOption.hidden = countOption.disabled;
      if (countOption.disabled && target === 'number') target = 'title';
      targetInput.querySelectorAll('[data-caption-target]').forEach(option => { option.hidden = scope !== 'result'; option.disabled = scope !== 'result'; });
      targetInput.value = target;
      const pairTarget = target === 'banker';
      panel.querySelector('#tvSymbolPairHint').hidden = !pairTarget;
      captionEditor.show(['title', 'english'].includes(target) ? target : null, category);
      for (const [key, id] of fields) {
        const row = panel.querySelector(`[data-symbol-row="${key}"]`);
        const enabled = Object.hasOwn(value[scope][target] || {}, key);
        row.hidden = !enabled;
        const label = key === 'x' ? (pairTarget ? '左右距離' : '距右側')
          : key === 'y' ? (pairTarget ? '上下距離' : '距上緣')
          : key === 'size' ? (target === 'number' ? '字級' : '圓點大小')
          : fields.find(f => f[0] === key)[2];
        panel.querySelector(`[data-symbol-label="${key}"]`).textContent = label;
        panel.querySelector(`[data-symbol-unit="${key}"]`).textContent = key === 'size' && target === 'number' && scope === 'result' ? 'px' : '%';
        for (const input of [panel.querySelector('#tvSymbol' + id), panel.querySelector('#tvSymbol' + id + 'Value')]) {
          const [min, max, step] = bounds(scope, target, key);
          input.min = min; input.max = max; input.step = step; input.disabled = !enabled;
          input.value = enabled ? value[scope][target][key] : 0;
          if (input.type === 'number') input.setAttribute('aria-label', label + '數值');
        }
      }
      fitPreview();
    }
    for (const button of panel.querySelectorAll('[data-symbol-scope]')) {
      button.addEventListener('click', () => { scope = button.dataset.symbolScope; if (scope === 'bead' && ['title', 'english'].includes(target)) target = 'number'; sync(); });
    }
    targetInput.addEventListener('change', () => { target = targetInput.value; sync(); });
    for (const [key, id] of fields) {
      const range = panel.querySelector('#tvSymbol' + id);
      const number = panel.querySelector('#tvSymbol' + id + 'Value');
      for (const input of [range, number]) input.addEventListener('input', () => {
        if (!input.validity.valid || input.value === '') return;
        value[scope][target][key] = Number(input.value);
        if (target === 'banker' && ['x', 'y', 'size'].includes(key)) {
          value[scope].player[key] = Number(input.value);
        }
        (input === range ? number : range).value = input.value;
        onChange(normalize(value));
      });
    }
    panel.querySelector('#tvSymbolSample').addEventListener('change', event => {
      category = event.target.value;
      const isSuper = category === 'super';
      const animal = category.endsWith('-tiger') ? window.BaccaratAnimalArt[category.split('-')[0]] : null;
      resultPreview.dataset.kind = category;
      resultPreview.classList.toggle('has-seven', !animal);
      resultPreview.classList.toggle('has-orbit', category === 'big-tiger');
      const art = resultPreview.querySelector('img');
      art.src = animal ? animal.src : `assets/beads/${isSuper ? 'purple-seven' : 'blue-seven'}.png`;
      art.alt = animal ? animal.label : isSuper ? '超級幸運7' : '幸運7';
      resultPreview.querySelector('.result-card-count').textContent = animal ? '' : isSuper ? '5' : '3';
      BaccaratCaptionSettings.render(resultPreview);
      sync();
    });
    sync();
    return {
      show() { buildBeadPreview(); },
      setValue(next) { value = normalize(next); captionEditor.setValue(value.captions); scope = 'bead'; target = 'number'; sync(); },
      reset() { value[scope] = structuredClone(defaults[scope]); if (scope === 'result') { value.captions = BaccaratCaptionSettings.normalize(); captionEditor.setValue(value.captions); } sync(); onChange(normalize(value)); }
    };
  }
  window.BaccaratSymbolSettings = { normalize, apply, init };
})();
