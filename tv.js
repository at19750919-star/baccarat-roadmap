// TV layout uses app.js directly. No duplicated application logic.
// 三星路（三珠路）：只看莊/閒，和局跳過；每 3 個一欄由上往下填。
(function () {
  const MAX_COLS = 23; // floor(47/2)，每圈佔 2x2 小格
  function renderStarRoad() {
    const el = document.getElementById('starRoad');
    if (!el || typeof state === 'undefined') return;
    const seq = state.rounds.filter(x => x.r === 'B' || x.r === 'P').map(x => x.r);
    const total = Math.ceil(seq.length / 3);
    const offset = Math.max(0, total - MAX_COLS);
    const frag = document.createDocumentFragment();
    seq.forEach((r, i) => {
      const col = Math.floor(i / 3) - offset;
      if (col < 0) return;
      const d = document.createElement('div');
      d.className = 'tv-star-mark ' + r;
      d.style.gridColumn = `${col * 2 + 1} / span 2`;
      d.style.gridRow = `${(i % 3) * 2 + 1} / span 2`;
      frag.appendChild(d);
    });
    el.innerHTML = '';
    el.appendChild(frag);
  }
  function init() {
    renderStarRoad();
    const bead = document.getElementById('beadBoard');
    if (bead) new MutationObserver(renderStarRoad).observe(bead, { childList: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
