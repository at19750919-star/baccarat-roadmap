// Editable captions for seven and tiger categories; never changes game records.
(function () {
  'use strict';
  const fonts = {
    serif: '"Noto Serif TC", "PMingLiU", serif',
    sans: '"Microsoft JhengHei", sans-serif',
    cinzel: '"Cinzel", "Noto Serif TC", Georgia, serif',
    abril: '"Abril Fatface", "Noto Serif TC", Georgia, serif'
  };
  const labels = { lucky: ['幸運 7', 'LUCKY'], super: ['超級幸運 7', 'SUPER LUCKY'], 'small-tiger': ['小老虎', 'SMALL TIGER'], 'big-tiger': ['大老虎', 'BIG TIGER'] };
  const defaults = Object.fromEntries(Object.entries(labels).map(([kind, [title, english]]) => [kind, {
    title: { text: title, font: 'serif', size: 35, color: '#ffebba', weight: 700, spacing: 5, effect: 'none', strength: 50 },
    english: { text: english, font: 'cinzel', size: 23, color: '#fff1c9', weight: 700, spacing: 5, effect: 'shadow', strength: 50 }
  }]));
  const effects = ['none', 'shadow', 'glow', 'emboss'];
  const limits = { size: [14, 80, 1], spacing: [0, 20, .5], strength: [0, 100, 1] };
  function normalize(value) {
    const result = structuredClone(defaults);
    for (const kind of Object.keys(defaults)) {
      for (const target of ['title', 'english']) {
        const raw = value?.[kind]?.[target];
        if (!raw || typeof raw !== 'object') continue;
        const next = result[kind][target];
        if (typeof raw.text === 'string') next.text = raw.text.slice(0, 80);
        if (typeof raw.font === 'string' && Object.hasOwn(fonts, raw.font)) next.font = raw.font;
        if (effects.includes(raw.effect)) next.effect = raw.effect;
        if ([400, 700, 900].includes(raw.weight)) next.weight = raw.weight;
        if (typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color)) next.color = raw.color.toLowerCase();
        for (const [key, [min, max, step]] of Object.entries(limits)) {
          if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) {
            next[key] = Math.max(min, Math.min(max, Math.round(raw[key] / step) * step));
          }
        }
      }
    }
    return result;
  }
  let current = normalize();
  function shadow(config) {
    const amount = config.strength / 100;
    if (!amount || config.effect === 'none') return 'none';
    if (config.effect === 'shadow') return `0 2px 8px rgba(0,0,0,${Math.min(1, amount * 1.066)})`;
    if (config.effect === 'glow') return `0 0 ${amount * 12}px ${config.color}, 0 0 ${amount * 24}px ${config.color}`;
    return `0 1px 0 rgba(255,255,255,${amount}), 0 -1px 0 rgba(0,0,0,${amount}), 0 3px 4px rgba(0,0,0,${amount})`;
  }
  function render(overlay) {
    const kind = overlay.dataset.kind;
    for (const target of ['title', 'english']) {
      const element = overlay.querySelector('.result-' + target);
      if (!element) continue;
      if (!Object.hasOwn(current, kind)) {
        for (const key of ['font-family', 'font-size', 'color', 'font-weight', 'letter-spacing', 'text-shadow']) element.style.removeProperty(key);
        continue;
      }
      const config = current[kind][target];
      element.textContent = config.text;
      Object.assign(element.style, {
        fontFamily: fonts[config.font], fontSize: config.size + 'px', color: config.color,
        fontWeight: config.weight, letterSpacing: config.spacing + 'px', textShadow: shadow(config)
      });
    }
  }
  function apply(value) {
    current = normalize(value);
    document.querySelectorAll('.result-announcement').forEach(render);
  }
  function init({ host, onChange }) {
    let value = normalize();
    let target = null;
    let kind = 'super';
    host.className = 'tv-caption-controls';
    host.innerHTML = `
      <label class="tv-caption-field" for="tvCaptionText">文字內容<input id="tvCaptionText" type="text" maxlength="80" autocomplete="off"/></label>
      <label class="tv-caption-field" for="tvCaptionFont">字型<select id="tvCaptionFont">
        <option value="serif">明體</option><option value="sans">黑體</option><option value="cinzel">典雅襯線</option><option value="abril">粗襯線</option>
      </select></label>
      <label class="tv-caption-field" for="tvCaptionWeight">字重<select id="tvCaptionWeight"><option value="400">一般</option><option value="700">粗體</option><option value="900">特粗</option></select></label>
      <label class="tv-caption-field" for="tvCaptionColor">文字顏色<input id="tvCaptionColor" type="color"/></label>
      <label class="tv-caption-field" for="tvCaptionEffect">文字效果<select id="tvCaptionEffect">
        <option value="none">無效果</option><option value="shadow">陰影</option><option value="glow">光暈</option><option value="emboss">浮雕</option>
      </select></label>
      ${[['size', 'Size', '字級', 'px'], ['spacing', 'Spacing', '字距', 'px'], ['strength', 'Strength', '效果強度', '%']].map(([key, id, label, unit]) => `
        <div class="tv-symbol-control" data-caption-row="${key}">
          <label for="tvCaption${id}">${label}</label>
          <input id="tvCaption${id}" type="range" data-caption-key="${key}"/>
          <input id="tvCaption${id}Value" type="number" data-caption-value="${key}" aria-label="${label}數值" required/>
          <span class="tv-symbol-unit">${unit}</span>
        </div>`).join('')}`;
    const controls = {
      text: host.querySelector('#tvCaptionText'), font: host.querySelector('#tvCaptionFont'),
      weight: host.querySelector('#tvCaptionWeight'), color: host.querySelector('#tvCaptionColor'), effect: host.querySelector('#tvCaptionEffect')
    };
    function sync() {
      host.hidden = !target;
      host.querySelectorAll('input,select').forEach(input => { input.disabled = !target; });
      if (!target) return;
      const config = value[kind][target];
      for (const [key, input] of Object.entries(controls)) input.value = config[key];
      for (const [key, [min, max, step]] of Object.entries(limits)) {
        for (const input of host.querySelectorAll(`[data-caption-key="${key}"],[data-caption-value="${key}"]`)) {
          input.min = min; input.max = max; input.step = step; input.value = config[key];
        }
      }
      syncStrength();
    }
    function syncStrength() {
      const enabled = !!target && value[kind][target].effect !== 'none';
      const row = host.querySelector('[data-caption-row="strength"]');
      row.hidden = !enabled;
      row.querySelectorAll('input').forEach(input => { input.disabled = !enabled; });
    }
    for (const [key, input] of Object.entries(controls)) {
      input.addEventListener(key === 'text' || key === 'color' ? 'input' : 'change', () => {
        if (!target) return;
        value[kind][target][key] = key === 'weight' ? Number(input.value) : input.value;
        if (key === 'effect') syncStrength();
        onChange(normalize(value));
      });
    }
    for (const key of Object.keys(limits)) {
      const range = host.querySelector(`[data-caption-key="${key}"]`);
      const number = host.querySelector(`[data-caption-value="${key}"]`);
      for (const input of [range, number]) input.addEventListener('input', () => {
        if (!target || !input.validity.valid || input.value === '') return;
        value[kind][target][key] = Number(input.value);
        (input === range ? number : range).value = input.value;
        onChange(normalize(value));
      });
    }
    sync();
    return {
      setValue(next) { value = normalize(next); sync(); },
      show(nextTarget, nextKind) { target = nextTarget; kind = nextKind; sync(); }
    };
  }
  window.BaccaratCaptionSettings = { normalize, apply, render, init };
})();
