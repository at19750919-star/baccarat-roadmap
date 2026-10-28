// TV result presentation. Existing road data, keyboard and bead artwork stay in charge.
(function () {
  'use strict';
  if (!document.querySelector('.tv-app')) return;

  const HOLD_MS = 2700;
  const EXIT_MS = 320;
  const ordinary = {
    B: { kind: 'banker', symbol: '莊', english: 'BANK', label: '莊贏' },
    P: { kind: 'player', symbol: '閒', english: 'PLAYER', label: '閒贏' },
    T: { kind: 'tie', symbol: '和', english: 'TIE', label: '和局' }
  };
  const overlay = document.createElement('div');
  overlay.id = 'resultAnnouncement';
  overlay.className = 'result-announcement';
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="result-stage" aria-hidden="true">
      <div class="result-ribbon"></div>
      <div class="result-content">
        <div class="result-medallion">
          <div class="result-disc"><span class="result-symbol"></span></div>
          <span class="result-shimmer"></span>
          <span class="result-card-count"></span>
          <span class="result-orbit"><i></i><i></i><i></i></span>
          <span class="result-pair-marker result-pair-marker-bp" hidden></span>
          <span class="result-pair-marker result-pair-marker-pp" hidden></span>
        </div>
        <div class="result-title"></div>
        <div class="result-english"></div>
        <div class="result-pairs"></div>
      </div>
    </div>`;
  const live = document.createElement('span');
  live.className = 'result-live';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');
  document.body.append(overlay, live);

  const $ = selector => overlay.querySelector(selector);
  let holdTimer;
  let exitTimer;
  let committing = false;
  let pendingDragon = null;
  const originalDragonUpdate = DragonFx.update.bind(DragonFx);
  // Let the result finish before the existing long-dragon showcase starts.
  DragonFx.update = function (color, length) {
    if (committing || !overlay.hidden) {
      pendingDragon = [color, length];
      return;
    }
    originalDragonUpdate(color, length);
  };

  function clearTimers() {
    clearTimeout(holdTimer);
    clearTimeout(exitTimer);
  }

  function dismiss(playDragon = false) {
    clearTimers();
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('is-visible', 'is-leaving');
    live.textContent = '';
    const dragon = pendingDragon;
    pendingDragon = null;
    if (playDragon && dragon && !document.hidden && !document.querySelector('#bossScreen.active')) {
      originalDragonUpdate(...dragon);
    }
  }

  function show(round) {
    const base = ordinary[round.r];
    if (!base || document.hidden || document.querySelector('#bossScreen.active')) {
      dismiss();
      return;
    }
    const cards = round.r === 'P'
      ? ([4, 5, 6].includes(round.s7) ? round.s7 : !round.s7 && [2, 3].includes(round.l7) ? round.l7 : null)
      : null;
    const superSeven = cards >= 4;
    const animal = round.r === 'B' && ['small', 'big'].includes(round.tiger) ? window.BaccaratAnimalArt?.[round.tiger] : null;
    const kind = animal ? `${round.tiger}-tiger` : cards ? (superSeven ? 'super' : 'lucky') : base.kind;
    const label = animal ? animal.label : cards ? (superSeven ? '超級幸運 7' : '幸運 7') : base.label;
    overlay.dataset.kind = kind;
    overlay.classList.toggle('has-seven', !!cards);
    overlay.classList.toggle('has-art', !!animal || !!cards);
    overlay.classList.toggle('has-orbit', (!!animal && round.tiger === 'big') || (superSeven && cards === 6));
    overlay.classList.toggle('has-banker-pair', !!round.bp);
    overlay.classList.toggle('has-player-pair', !!round.pp);
    $('.result-pair-marker-bp').hidden = !round.bp;
    $('.result-pair-marker-pp').hidden = !round.pp;
    const disc = $('.result-disc');
    disc.replaceChildren();
    if (animal || cards) {
      const art = document.createElement('img');
      art.className = 'result-art';
      art.alt = '';
      art.draggable = false;
      art.src = animal ? animal.src : `assets/beads/${superSeven ? 'purple-seven' : 'blue-seven'}.png`;
      disc.appendChild(art);
    } else {
      const symbol = document.createElement('span');
      symbol.className = 'result-symbol';
      symbol.textContent = base.symbol;
      disc.appendChild(symbol);
    }
    $('.result-card-count').textContent = cards ? String(cards) : '';
    $('.result-title').textContent = animal || cards ? label : '';
    $('.result-english').textContent = animal ? animal.english : cards ? (superSeven ? 'SUPER LUCKY' : 'LUCKY') : base.english;
    window.BaccaratCaptionSettings?.render(overlay);
    const pairs = $('.result-pairs');
    pairs.replaceChildren();
    for (const [key, text] of [['bp', '莊對'], ['pp', '閒對']]) {
      if (!round[key]) continue;
      const chip = document.createElement('span');
      chip.className = `result-pair result-pair-${key}`;
      chip.textContent = text;
      pairs.appendChild(chip);
    }
    live.textContent = (cards ? $('.result-title').textContent || label : label) + (cards ? `，${cards} 張` : '') + (pairs.textContent ? '，' + pairs.textContent : '');
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.remove('is-visible', 'is-leaving');
    void overlay.offsetWidth;
    overlay.classList.add('is-visible');
    holdTimer = setTimeout(() => {
      overlay.classList.add('is-leaving');
      exitTimer = setTimeout(() => dismiss(true), EXIT_MS);
    }, HOLD_MS);
  }

  const originalAddRound = addRound;
  addRound = function (...args) {
    dismiss();
    if (document.querySelector('#dragonOverlay.active')) {
      document.getElementById('dragonVideo')?.pause();
      DragonFx.fadeOut();
    }
    committing = true;
    const before = state.rounds.length;
    try {
      const result = originalAddRound.apply(this, args);
      if (state.rounds.length === before + 1) show(state.rounds.at(-1));
      return result;
    } finally {
      committing = false;
    }
  };
  const originalUndo = undo;
  undo = function (...args) {
    dismiss();
    return originalUndo.apply(this, args);
  };
  const originalClear = clearAll;
  clearAll = function (...args) {
    const result = originalClear.apply(this, args);
    if (state.rounds.length === 0) dismiss(true);
    return result;
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) dismiss(); });
  const boss = document.getElementById('bossScreen');
  if (boss) new MutationObserver(() => {
    if (boss.classList.contains('active')) dismiss();
  }).observe(boss, { attributes: true, attributeFilter: ['class'] });
  for (const src of ['assets/beads/blue-seven.png', 'assets/beads/purple-seven.png', ...Object.values(window.BaccaratAnimalArt || {}).map(art => art.src)]) {
    const art = new Image();
    art.src = src;
  }
})();
