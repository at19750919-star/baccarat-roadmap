/* Isolated settings-panel proposal. Not loaded by live tv.html. */
(function () {
  const PANEL_W = 1240;
  const PANEL_H = 820;
  const SIZE_KEY = 'baccarat_tv_settings_size_v1';
  const origSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key === SIZE_KEY) return;
    return origSet.apply(this, arguments);
  };

  function dialogEl() {
    return document.getElementById('tvSettings');
  }

  function applyPanelChrome() {
    const dialog = dialogEl();
    if (!dialog || !dialog.classList.contains('tv-settings-proposal')) return;
    dialog.style.width = PANEL_W + 'px';
    dialog.style.height = PANEL_H + 'px';
    dialog.style.minWidth = PANEL_W + 'px';
    dialog.style.minHeight = PANEL_H + 'px';
    dialog.style.maxWidth = 'none';
    dialog.style.maxHeight = 'none';
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080) || 1;
    const left = Math.max(8, (window.innerWidth - PANEL_W * scale) / 2);
    const top = Math.max(8, (window.innerHeight - PANEL_H * scale) / 2);
    dialog.style.left = left + 'px';
    dialog.style.top = top + 'px';
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
  }

  function regroupBasic() {
    const panel = document.getElementById('tvBasicPanel');
    if (!panel || panel.dataset.proposalGrouped) return;
    const grid = panel.querySelector(':scope > .tv-size-settings');
    if (!grid) return;
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'tv-settings-group';
    const sizeHead = document.createElement('h3');
    sizeHead.className = 'tv-settings-subhead';
    sizeHead.textContent = '路單尺寸';
    const sizeBox = document.createElement('div');
    sizeBox.className = 'tv-size-fields';
    const dragonGroup = document.createElement('div');
    dragonGroup.className = 'tv-settings-group';
    const dragonHead = document.createElement('h3');
    dragonHead.className = 'tv-settings-subhead';
    dragonHead.textContent = '長龍';
    dragonGroup.append(dragonHead);
    [...grid.querySelectorAll(':scope > label')].forEach((label) => {
      if ((label.textContent || '').includes('長龍')) dragonGroup.append(label);
      else sizeBox.append(label);
    });
    sizeGroup.append(sizeHead, sizeBox);
    grid.replaceWith(sizeGroup, dragonGroup);
    panel.dataset.proposalGrouped = '1';
  }

  function regroupLimits() {
    const wrap = document.getElementById('tvProposalLimitSettings');
    if (!wrap || wrap.dataset.proposalGrouped) return;
    const grid = wrap.querySelector('.tv-size-settings');
    if (!grid) return;
    const rows = [];
    const index = new Map();
    [...grid.querySelectorAll(':scope > label')].forEach((label) => {
      const caption = (label.querySelector('span') && label.querySelector('span').textContent) || '';
      const input = label.querySelector('input');
      if (!input) return;
      const match = caption.match(/^(.*)(最高|最低)$/);
      const name = match ? match[1] : caption;
      const kind = match ? match[2] : '最高';
      if (!index.has(name)) {
        const row = { name: name, high: null, low: null };
        index.set(name, row);
        rows.push(row);
      }
      index.get(name)[kind === '最低' ? 'low' : 'high'] = input;
    });
    const heading = document.createElement('h3');
    heading.className = 'tv-settings-subhead';
    heading.textContent = '限紅';
    const table = document.createElement('table');
    table.className = 'tv-limit-table';
    table.innerHTML = '<thead><tr><th>項目</th><th>最高</th><th>最低</th></tr></thead>';
    const body = document.createElement('tbody');
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.textContent = row.name;
      const highCell = document.createElement('td');
      const lowCell = document.createElement('td');
      if (row.high) highCell.append(row.high);
      if (row.low) lowCell.append(row.low);
      tr.append(nameCell, highCell, lowCell);
      body.append(tr);
    });
    table.append(body);
    const hint = wrap.querySelector('.tv-live-hint');
    grid.replaceWith(heading, table);
    if (hint) heading.after(hint);
    wrap.dataset.proposalGrouped = '1';
  }

  function install() {
    applyPanelChrome();
    regroupBasic();
    regroupLimits();
    document.getElementById('tvSettingsButton')?.addEventListener('click', () => {
      requestAnimationFrame(() => {
        regroupBasic();
        regroupLimits();
        applyPanelChrome();
      });
    });
    dialogEl()?.addEventListener('toggle', () => {
      if (dialogEl()?.open) applyPanelChrome();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  setTimeout(install, 0);
})();
