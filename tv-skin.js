/* 紅金／綠金／黑金三選一：在 <head> 同步執行，首次繪製前就套用，避免閃爍。只改外觀，不碰路單資料。 */
(() => {
  const key = 'tv_skin_v1';
  const root = document.documentElement;
  const SKINS = { red: '紅金風格', green: '綠金風格', black: '黑金風格', led: '電子看板' };
  const norm = v => (v === 'green' || v === 'black' || v === 'led') ? v : 'red';
  let skin = 'red';
  try { skin = norm(localStorage.getItem(key)); } catch (_) {}
  const paint = () => {
    if (skin === 'red') root.removeAttribute('data-skin'); else root.setAttribute('data-skin', skin);
    // 電視頁固定用經典版面；只改畫面屬性，不寫回路單頁的 baccarat_road_theme_v1。
    root.setAttribute('data-theme', 'classic');
    const btn = document.getElementById('tvSkinToggle');
    if (btn) btn.textContent = SKINS[skin];
    const menu = document.getElementById('tvSkinMenu');
    if (menu) menu.querySelectorAll('[role="option"]').forEach(o => o.setAttribute('aria-selected', o.dataset.skinValue === skin ? 'true' : 'false'));
  };
  paint();
  document.addEventListener('DOMContentLoaded', () => {
    paint();
    const btn = document.getElementById('tvSkinToggle');
    const menu = document.getElementById('tvSkinMenu');
    if (!btn || !menu) return;
    const opts = Array.from(menu.querySelectorAll('[role="option"]'));
    const isOpen = () => !menu.hidden;
    const focusAt = i => opts[(i + opts.length) % opts.length].focus();
    const open = () => {
      menu.style.top = (btn.offsetTop + btn.offsetHeight + 2) + 'px';
      menu.style.left = btn.offsetLeft + 'px';
      menu.style.minWidth = btn.offsetWidth + 'px';
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      focusAt(Math.max(0, opts.findIndex(o => o.dataset.skinValue === skin)));
    };
    const close = refocus => {
      if (!isOpen()) return;
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus();
    };
    const choose = v => {
      skin = norm(v);
      try { localStorage.setItem(key, skin); } catch (_) {}
      paint();
      close(false);
      btn.blur();
    };
    btn.addEventListener('click', () => { if (isOpen()) close(false); else open(); });
    btn.addEventListener('keydown', e => {
      // 不讓路單快捷鍵（app.js / tv.js 掛在 document）收到選單按鍵
      if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape'].includes(e.key)) e.stopPropagation();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
      else if (e.key === 'Escape') close(false);
    });
    menu.addEventListener('keydown', e => {
      const i = opts.indexOf(document.activeElement);
      e.stopPropagation();
      if (e.key === 'ArrowDown') { e.preventDefault(); focusAt(i + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusAt(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusAt(0); }
      else if (e.key === 'End') { e.preventDefault(); focusAt(opts.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) choose(opts[i].dataset.skinValue); }
      else if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') close(false);
    });
    menu.addEventListener('click', e => { const o = e.target.closest('[role="option"]'); if (o) choose(o.dataset.skinValue); });
    document.addEventListener('pointerdown', e => { if (isOpen() && !menu.contains(e.target) && !btn.contains(e.target)) close(false); }, true);
    menu.addEventListener('focusout', e => { if (isOpen() && e.relatedTarget && !menu.contains(e.relatedTarget) && e.relatedTarget !== btn) close(false); });
  });
})();
