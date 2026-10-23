/* Apply before first paint; appearance preferences never modify road records. */
(() => {
  const key = 'baccarat_road_theme_v1';
  const normalize = value => value === 'black-gold' ? value : 'classic';
  let theme = 'classic';
  try { theme = normalize(localStorage.getItem(key)); } catch (_) {}
  document.documentElement.dataset.theme = theme;
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('themeSelect');
    select.value = theme;
    select.addEventListener('change', () => {
      theme = normalize(select.value);
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem(key, theme); } catch (_) {}
    });
    // Keep the road-entry shortcuts from handling keys used by this select.
    select.addEventListener('keydown', event => event.stopPropagation());
  });
})();
