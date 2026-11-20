// 網路版只給業主自己用的簡單密碼。擋一般人即可；懂程式的人看得到這段、也能繞過。
// 本機檔案、localhost 與安裝版（file:）不會問。密碼改 OWNER_PASSWORD 這一處。
(function () {
  var OWNER_PASSWORD = 'k4m9-q2vx';
  var STORAGE_KEY = 'jiujiu_owner_gate_v1';
  var host = location.hostname;
  var local = location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '';
  if (local) return;
  try { if (localStorage.getItem(STORAGE_KEY) === '1') return; } catch (error) { return; }

  document.documentElement.classList.add('owner-locked');
  var style = document.createElement('style');
  style.textContent = [
    'html.owner-locked{background:#4a090b;overflow:hidden}',
    'html.owner-locked body{visibility:hidden!important;overflow:hidden}',
    '#ownerGate{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:#4a090b;color:#fff2ce;font:22px "Microsoft JhengHei","Noto Serif TC",serif}',
    '#ownerGate form{box-sizing:border-box;width:min(460px,calc(100% - 40px));background:#5c1012;border:1px solid #d4a64a;padding:32px 28px}',
    '#ownerGate h1{margin:0 0 8px;font-size:34px;letter-spacing:.06em}',
    '#ownerGate p{margin:0 0 16px;line-height:1.5}',
    '#ownerGate input{box-sizing:border-box;width:100%;padding:12px;font:22px "Microsoft JhengHei",sans-serif;background:#fff0ce;color:#3a0a0a;border:1px solid #d4a64a}',
    '#ownerGate button{margin-top:14px;padding:10px 22px;font:inherit;background:#f0cf85;color:#3a0a0a;border:1px solid #d4a64a}',
    '#ownerGate .owner-gate-error{min-height:1.4em;color:#ffd0d0}'
  ].join('');
  document.head.appendChild(style);

  function blockGameKeys(event) {
    if (!document.documentElement.classList.contains('owner-locked')) return;
    if (event.target && event.target.closest && event.target.closest('#ownerGate')) return;
    event.preventDefault();
    event.stopPropagation();
  }
  window.addEventListener('keydown', blockGameKeys, true);
  window.addEventListener('keypress', blockGameKeys, true);

  var gate = document.createElement('div');
  gate.id = 'ownerGate';
  gate.innerHTML = '<form>'
    + '<h1>玖玖百家樂路單</h1>'
    + '<p>這是業主自用的網路版，請輸入密碼。</p>'
    + '<label for="ownerGatePassword">密碼</label>'
    + '<input id="ownerGatePassword" type="password" autocomplete="current-password">'
    + '<p class="owner-gate-error" id="ownerGateError"></p>'
    + '<button type="submit" id="ownerGateSubmit">進入</button>'
    + '</form>';
  document.documentElement.appendChild(gate);
  var input = gate.querySelector('#ownerGatePassword');
  var error = gate.querySelector('#ownerGateError');
  gate.querySelector('form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (input.value !== OWNER_PASSWORD) {
      error.textContent = '密碼不對。';
      input.select();
      return;
    }
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (ignore) {}
    document.documentElement.classList.remove('owner-locked');
    gate.remove();
  });
  input.focus();
})();
