// 在使用者平常的 Chrome 開 tv.html（file://），按 F12 → Console，整段貼上按 Enter。
(() => {
  const all = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); all[k] = localStorage.getItem(k); }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' }));
  a.download = 'localStorage-backup.json'; a.click();               // 1. 先下載完整備份
  const S = 'tv-edit-mode:settings'; const settings = JSON.parse(localStorage.getItem(S) || '{}');
  const ids = new Set();
  document.querySelectorAll('.stat-banker, .stat-banker [data-tv-edit-id]').forEach(n => n.dataset.tvEditId && ids.add(n.dataset.tvEditId));
  const pageEls = [document.body, document.documentElement, ...document.querySelectorAll('.tv-app, .tv-table-board, .tv-limit, .tv-stats, .stats-list')];
  pageEls.forEach(n => n.dataset && n.dataset.tvEditId && ids.add(n.dataset.tvEditId));
  const removed = [];
  ids.forEach(id => {
    if (id in settings) { delete settings[id]; removed.push(S + ' → ' + id); }
    const ck = 'tv-edit-mode:controls:' + id;
    if (localStorage.getItem(ck) != null) { localStorage.removeItem(ck); removed.push(ck); }
  });
  localStorage.setItem(S, JSON.stringify(settings));               // 2. 只刪這幾筆，其餘（切格、面板位置）不動
  console.table(removed); console.log('完成，請重新整理頁面');
})();
