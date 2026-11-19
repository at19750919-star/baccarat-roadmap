const { ipcRenderer } = require('electron');
window.addEventListener('DOMContentLoaded', () => {
  const field = document.getElementById('name');
  ipcRenderer.on('roadmap:prompt-data', (_, data) => { document.getElementById('message').textContent = data.message; field.value = data.initial; field.focus(); field.select(); });
  document.querySelector('form').addEventListener('submit', event => { event.preventDefault(); ipcRenderer.send('roadmap:prompt-result', field.value); });
  document.getElementById('cancel').addEventListener('click', () => ipcRenderer.send('roadmap:prompt-result', null));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') ipcRenderer.send('roadmap:prompt-result', null); });
});

