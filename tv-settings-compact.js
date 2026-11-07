/* Shared fixed-size settings shell; scrolling is confined to tab content. */
(function () {
  'use strict';
  function dialogEl() {
    return document.getElementById('tvSettings');
  }

  function applyPanelChrome() {
    const dialog = dialogEl();
    if (!dialog || !dialog.open) return;
    requestAnimationFrame(() => {
      const scale = Math.min(innerWidth / 1920, innerHeight / 1080) || 1;
      if (!dialog.dataset.fixedSizeReady) {
        dialog.style.setProperty('width', '720px', 'important');
        dialog.style.setProperty('height', '800px', 'important');
        dialog.dataset.fixedSizeReady = '1';
        dialog.style.left = Math.max(12, (innerWidth - 720 * scale) / 2) + 'px';
        dialog.style.top = Math.max(12, (innerHeight - 800 * scale) / 2) + 'px';
      }
      const rect = dialog.getBoundingClientRect();
      dialog.style.left = Math.max(8, Math.min(rect.left, innerWidth - rect.width - 8)) + 'px';
      dialog.style.top = Math.max(8, Math.min(rect.top, innerHeight - rect.height - 8)) + 'px';
      dialog.style.right = 'auto';
      dialog.style.bottom = 'auto';
    });
  }

  function regroupBasic() {
    const panel = document.getElementById('tvBasicPanel');
    if (!panel) return;
    if (!panel.dataset.proposalGrouped) {
      const grid = panel.querySelector(':scope > .tv-size-settings');
      if (grid) {
        const sizeGroup = document.createElement('div');
        sizeGroup.className = 'tv-settings-group';
        const sizeHead = document.createElement('h3');
        sizeHead.className = 'tv-settings-subhead';
        sizeHead.textContent = '路單尺寸';
        const sizeBox = document.createElement('div');
        sizeBox.className = 'tv-size-fields';
        [...grid.querySelectorAll(':scope > label')].forEach((label) => {
          sizeBox.append(label);
        });
        sizeGroup.append(sizeHead, sizeBox);
        grid.replaceWith(sizeGroup);
      }
      panel.dataset.proposalGrouped = '1';
    }
    if (!panel.dataset.compactGrouped) {
      const sizeBox = panel.querySelector('.tv-size-fields');
      if (sizeBox) {
        const stray = [...panel.querySelectorAll('.tv-settings-group')].find((group) => {
          const head = group.querySelector('.tv-settings-subhead');
          return head && head.textContent.includes('長龍');
        });
        if (stray) {
          const label = stray.querySelector('label');
          if (label) sizeBox.append(label);
          stray.remove();
        }
      }
      panel.dataset.compactGrouped = '1';
    }
  }

  function makeLimitTable(rows) {
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
    return table;
  }

  function collectLimitRows(root) {
    const rows = [];
    const index = new Map();
    const labels = root.querySelectorAll('.tv-size-settings > label');
    const take = labels.length ? labels : [];
    take.forEach((label) => {
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
    if (rows.length) return rows;
    root.querySelectorAll('.tv-limit-table tbody tr').forEach((tr) => {
      const name = (tr.children[0] && tr.children[0].textContent) || '';
      const high = tr.children[1] && tr.children[1].querySelector('input');
      const low = tr.children[2] && tr.children[2].querySelector('input');
      rows.push({ name: name, high: high, low: low });
    });
    return rows;
  }

  function regroupLimits() {
    const wrap = document.getElementById('tvProposalLimitSettings');
    if (!wrap || wrap.dataset.compactSplit) return;
    const rows = collectLimitRows(wrap);
    if (!rows.length) return;
    const heading = wrap.querySelector('.tv-settings-subhead') || document.createElement('h3');
    heading.className = 'tv-settings-subhead';
    heading.textContent = '限紅';
    const hint = wrap.querySelector('.tv-live-hint');
    const tables = document.createElement('div');
    tables.className = 'tv-limit-tables';
    const mid = Math.ceil(rows.length / 2);
    tables.append(makeLimitTable(rows.slice(0, mid)), makeLimitTable(rows.slice(mid)));
    wrap.querySelectorAll('.tv-size-settings, .tv-limit-table, .tv-limit-tables, .tv-settings-subhead').forEach((node) => node.remove());
    wrap.insertBefore(heading, wrap.firstChild);
    if (hint) heading.after(hint);
    else heading.after(tables);
    if (hint) hint.after(tables);
    wrap.dataset.proposalGrouped = '1';
    wrap.dataset.compactSplit = '1';
  }

  function installSelects() {
    const dialog = dialogEl();
    if (!dialog) return;
    dialog.querySelectorAll('select').forEach(select => {
      if (select.dataset.casinoPicker) return;
      select.dataset.casinoPicker = '1';
      const label = select.getAttribute('aria-label') || select.closest('label')?.firstChild?.textContent.trim() || '選擇項目';
      const host = document.createElement('span');
      host.className = 'tv-select-picker';
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'tv-select-button';
      button.setAttribute('role', 'combobox'); button.setAttribute('aria-haspopup', 'listbox');
      button.setAttribute('aria-expanded', 'false');
      const menu = document.createElement('span');
      menu.className = 'tv-select-menu'; menu.hidden = true; menu.setAttribute('role', 'listbox');
      menu.id = select.id + 'Menu'; button.setAttribute('aria-controls', menu.id);
      select.after(host); host.append(button, menu); select.hidden = true;
      function close(focus) { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); if (focus) button.focus(); }
      function sync() {
        button.textContent = (select.selectedOptions[0]?.textContent || '') + ' ▾';
        button.setAttribute('aria-label', label + '：' + (select.selectedOptions[0]?.textContent || ''));
        button.disabled = select.disabled;
      }
      function open() {
        dialog.querySelectorAll('.tv-select-picker').forEach(other => { if (other !== host) other.closePicker?.(); });
        menu.replaceChildren();
        [...select.options].filter(option => !option.hidden && !option.disabled).forEach(option => {
          const item = document.createElement('button'); item.type = 'button'; item.textContent = option.textContent;
          item.setAttribute('role', 'option'); item.setAttribute('aria-selected', String(option.selected));
          item.addEventListener('click', event => {
            event.preventDefault(); select.value = option.value;
            select.dispatchEvent(new Event('change', {bubbles: true})); sync(); close(true);
          });
          menu.append(item);
        });
        menu.hidden = false; button.setAttribute('aria-expanded', 'true');
        (menu.querySelector('[aria-selected=true]') || menu.firstElementChild)?.focus();
      }
      button.addEventListener('click', event => { event.preventDefault(); sync(); if (menu.hidden) open(); else close(false); });
      host.addEventListener('keydown', event => {
        if (event.key === 'Tab') { close(false); return; }
        if (!['ArrowDown','ArrowUp','Home','End','Escape','Enter',' '].includes(event.key)) return;
        event.stopPropagation(); event.preventDefault();
        if (event.key === 'Escape') { close(true); return; }
        if (event.target === button) { open(); return; }
        const items = [...menu.children]; const index = items.indexOf(document.activeElement);
        if (event.key === 'Enter' || event.key === ' ') { document.activeElement.click(); return; }
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
          : (index + (event.key === 'ArrowUp' ? items.length - 1 : 1)) % items.length;
        items[next]?.focus();
      });
      document.addEventListener('pointerdown', event => { if (!host.contains(event.target)) close(false); });
      dialog.addEventListener('close', () => close(false));
      select.addEventListener('change', sync);
      new MutationObserver(sync).observe(select, {attributes: true, subtree: true, childList: true});
      host.syncPicker = sync; host.closePicker = () => close(false); sync();
    });
    dialog.querySelectorAll('.tv-select-picker').forEach(host => host.syncPicker());
  }

  function install() {
    regroupBasic();
    regroupLimits();
    installSelects();
    applyPanelChrome();
    const button = document.getElementById('tvSettingsButton');
    if (button && !button.dataset.compactBound) {
      button.dataset.compactBound = '1';
      button.addEventListener('click', () => {
        requestAnimationFrame(() => {
          regroupBasic();
          regroupLimits();
          installSelects();
          applyPanelChrome();
        });
      });
    }
    const dialog = dialogEl();
    if (dialog && !dialog.dataset.compactBound) {
      dialog.dataset.compactBound = '1';
      dialog.addEventListener('toggle', () => {
        if (dialog.open) {
          regroupBasic();
          regroupLimits();
          installSelects();
          applyPanelChrome();
        }
      });
      dialog.querySelectorAll('.tv-settings-tabs button').forEach((tab) => {
        tab.addEventListener('click', () => {
          requestAnimationFrame(() => { installSelects(); applyPanelChrome(); });
        });
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  setTimeout(install, 0);
  setTimeout(install, 50);
  window.addEventListener("resize", applyPanelChrome);
})();
