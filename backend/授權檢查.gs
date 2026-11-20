// 客人付費授權檢查。可單獨加進 Apps Script，或併在「程式碼-v19-授權.gs」裡。
// 私鑰只放 Script Properties 的 LICENSE_SIGNING_KEY，不要寫進這個檔案。
// 試算表 ID 放 LICENSE_SHEET_ID。欄位順序見更新步驟-v19-授權.md。

// ===== license-pure-start =====
// 下面這段不碰試算表，電腦上的測試會直接跑這一段。
function licenseNormalizeCode_(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function licenseCodeOk_(code) {
  var normalized = licenseNormalizeCode_(code);
  return normalized.length >= 4 && normalized.length <= 64 && /^[A-Z0-9-]+$/.test(normalized);
}

function licenseMachineOk_(machineId) {
  return typeof machineId === 'string' && /^[A-Za-z0-9-]{8,80}$/.test(machineId);
}

function licenseNormalizeStatus_(status) {
  var text = String(status || '').replace(/\s+/g, '');
  if (text === '啟用' || text.toLowerCase() === 'active') return 'active';
  if (text === '停用' || text.toLowerCase() === 'disabled') return 'disabled';
  return 'unknown';
}

function licenseClean_(value, max) {
  return String(value || '').replace(/[\r\n]/g, ' ').slice(0, max);
}

function licenseDecide_(row, machineId, today) {
  if (!row) return { result: 'not_found' };
  if (row.status !== 'active') return { result: 'disabled' };
  if (!row.expires || !/^\d{4}-\d{2}-\d{2}$/.test(row.expires) || row.expires < today) return { result: 'expired' };
  if (!row.machine) return { result: 'bind' };
  if (row.machine !== machineId) return { result: 'other_machine' };
  return { result: 'ok' };
}

function licenseApply_(row, machineId, today, nowText) {
  var decision = licenseDecide_(row, machineId, today);
  if (!row) return { decision: decision, row: null, changed: false };
  var next = {
    name: row.name,
    code: row.code,
    status: row.status,
    expires: row.expires,
    machine: row.machine,
    activated: row.activated,
    lastSeen: row.lastSeen,
    note: row.note
  };
  var changed = false;
  if (decision.result === 'bind') {
    next.machine = machineId;
    if (!next.activated) next.activated = today;
    next.lastSeen = nowText;
    decision = { result: 'ok' };
    changed = true;
  } else if (decision.result === 'ok' || decision.result === 'disabled' || decision.result === 'expired' || decision.result === 'other_machine') {
    if (next.lastSeen !== nowText) {
      next.lastSeen = nowText;
      changed = true;
    }
  }
  return { decision: decision, row: next, changed: changed };
}

function licenseCanonical_(fields) {
  return [
    'jiujiu-license-v1',
    licenseClean_(fields.result, 40),
    licenseClean_(fields.machineId, 80),
    licenseClean_(fields.expires, 10),
    licenseClean_(fields.name, 40),
    licenseClean_(fields.serverTime, 40),
    licenseClean_(fields.codeHash, 64)
  ].join('\n');
}
// ===== license-pure-end =====

function licenseHash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); })
    .join('');
}

function licenseCellDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM-dd');
  }
  var text = String(value || '').trim();
  var match = text.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!match) return '';
  return match[1] + '-' + ('0' + match[2]).slice(-2) + '-' + ('0' + match[3]).slice(-2);
}

function licenseHeaderOk_(head) {
  var need = ['客人名稱', '授權碼', '狀態', '到期日', '綁定的電腦識別碼', '啟用日期', '最後連線時間', '備註'];
  if (!head) return false;
  for (var i = 0; i < need.length; i++) {
    if (String(head[i] || '').trim() !== need[i]) return false;
  }
  return true;
}

function licenseFindRow_(values, code) {
  var want = licenseNormalizeCode_(code);
  for (var row = 1; row < values.length; row++) {
    if (licenseNormalizeCode_(values[row][1]) === want) return row;
  }
  return -1;
}

function licenseRowFromValues_(cells) {
  return {
    name: licenseClean_(cells[0], 40),
    code: licenseNormalizeCode_(cells[1]),
    status: licenseNormalizeStatus_(cells[2]),
    expires: licenseCellDate_(cells[3]),
    machine: String(cells[4] || '').trim(),
    activated: licenseCellDate_(cells[5]),
    lastSeen: String(cells[6] || '').trim(),
    note: String(cells[7] || '').trim()
  };
}

function licenseNowTaipei_() {
  var now = new Date();
  return {
    today: Utilities.formatDate(now, 'Asia/Taipei', 'yyyy-MM-dd'),
    clock: Utilities.formatDate(now, 'Asia/Taipei', "yyyy-MM-dd'T'HH:mm:ss") + '+08:00'
  };
}

function licensePrivateKey_() {
  var key = PropertiesService.getScriptProperties().getProperty('LICENSE_SIGNING_KEY') || '';
  key = String(key).replace(/\\n/g, '\n').trim();
  if (key.indexOf('BEGIN PRIVATE KEY') === -1) return '';
  return key;
}

function licenseReply_(result, extras) {
  var payload = licenseCanonical_({
    result: result,
    machineId: extras.machineId || '',
    expires: extras.expires || '',
    name: extras.name || '',
    serverTime: extras.serverTime || '',
    codeHash: extras.codeHash || ''
  });
  var key = licensePrivateKey_();
  if (!key) return { success: false, error: 'license_unconfigured' };
  var bytes = Utilities.computeRsaSha256Signature(payload, key, Utilities.Charset.UTF_8);
  return { success: true, payload: payload, signature: Utilities.base64Encode(bytes) };
}

function licenseWriteBack_(sheet, rowNumber, row) {
  sheet.getRange(rowNumber, 5, 1, 3).setValues([[row.machine, row.activated, row.lastSeen]]);
}

// 由 doPost 在 action 為 licenseCheck 時呼叫。回覆一定要有簽章，私鑰不在程式碼裡。
function licenseHandle_(data) {
  var rawMachine = String(data && data.machineId || '').trim();
  var code = licenseNormalizeCode_(data && data.code);
  var clock = licenseNowTaipei_();
  var machineId = licenseMachineOk_(rawMachine) ? rawMachine : '';
  var codeHash = licenseCodeOk_(code) ? licenseHash_(code) : '';
  var base = { machineId: machineId, codeHash: codeHash, serverTime: clock.clock, expires: '', name: '' };
  if (!licenseCodeOk_(code) || !machineId) return licenseReply_('bad_request', base);
  if (!licensePrivateKey_()) return { success: false, error: 'license_unconfigured' };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var sheetId = PropertiesService.getScriptProperties().getProperty('LICENSE_SHEET_ID');
    if (!sheetId) return licenseReply_('unavailable', base);
    var sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
    var values = sheet.getDataRange().getValues();
    if (!values.length || !licenseHeaderOk_(values[0])) return licenseReply_('unavailable', base);
    var index = licenseFindRow_(values, code);
    if (index < 0) return licenseReply_('not_found', base);
    var row = licenseRowFromValues_(values[index]);
    var applied = licenseApply_(row, machineId, clock.today, clock.clock);
    if (applied.changed) licenseWriteBack_(sheet, index + 1, applied.row);
    return licenseReply_(applied.decision.result, {
      machineId: machineId,
      codeHash: codeHash,
      serverTime: clock.clock,
      expires: applied.row.expires || '',
      name: applied.row.name || ''
    });
  } catch (err) {
    try { return licenseReply_('unavailable', base); }
    catch (err2) { return { success: false, error: 'license_unavailable' }; }
  } finally {
    try { lock.releaseLock(); } catch (err3) {}
  }
}
