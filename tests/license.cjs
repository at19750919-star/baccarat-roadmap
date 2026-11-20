const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const rules = require('./license-rules.cjs');
const license = require('../windows-app/license-core.cjs');

const root = path.join(__dirname, '..');
const day = 24 * 60 * 60 * 1000;
const code = 'JJ-TEST-0001';
const machineA = 'MACHINE-AAA';
const machineB = 'MACHINE-BBB';
const today = '2026-11-20';
const now = Date.parse('2026-11-20T02:00:00Z');

function row(extra) {
  return Object.assign({
    name: '王先生', code: code, status: 'active', expires: '2027-12-31',
    machine: '', activated: '', lastSeen: '', note: ''
  }, extra);
}
function viewOf(source) {
  return {
    name: source.name,
    code: rules.licenseNormalizeCode_(source.code),
    status: rules.licenseNormalizeStatus_(source.status),
    expires: source.expires,
    machine: source.machine,
    activated: source.activated,
    lastSeen: source.lastSeen,
    note: source.note
  };
}
function apply(source, machineId, when) {
  return rules.licenseApply_(viewOf(source), machineId, today, when || '2026-11-20T10:00:00+08:00');
}
const pair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
function fresh(result, extra) {
  const fields = Object.assign({
    result, machineId: machineA, expires: '2027-12-31', name: '王先生',
    serverTime: '2026-11-20T10:00:00+08:00', codeHash: license.codeHash(code)
  }, extra);
  return license.signPayload(fields, pair.privateKey);
}
function judge(extra) {
  return license.evaluate(Object.assign({
    code, machineId: machineA, now, today, publicKey: pair.publicKey, stored: null, fresh: null, interactive: false
  }, extra));
}
function storedFrom(signed, acceptedAt, maxSeenAt) {
  return { version: 1, code, payload: signed.payload, signature: signed.signature, acceptedAt, maxSeenAt: maxSeenAt == null ? acceptedAt : maxSeenAt };
}

const canonicalFields = { result: 'ok', machineId: machineA, expires: '2027-12-31', name: '王先生', serverTime: '2026-11-20T10:00:00+08:00', codeHash: license.codeHash(code) };
assert.equal(rules.licenseCanonical_(canonicalFields), license.canonical(canonicalFields));
assert.equal(rules.licenseHash_(license.normalizeCode(' jj-test-0001 ')), license.codeHash('jj-test-0001'));

const first = apply(row(), machineA);
assert.equal(first.decision.result, 'ok');
assert.equal(first.row.machine, machineA);
assert.equal(first.row.activated, today);
const saved = row({ machine: first.row.machine, activated: first.row.activated, lastSeen: first.row.lastSeen });
const second = apply(saved, machineB);
assert.equal(second.decision.result, 'other_machine', '第二台要被擋');
assert.equal(second.row.machine, machineA, '第二台不可改掉已綁定的電腦');

const stoppedView = viewOf(row({ status: '停用', machine: machineA, activated: today }));
assert.equal(rules.licenseApply_(stoppedView, machineA, today, '2026-11-20T11:00:00+08:00').decision.result, 'disabled');
assert.equal(rules.licenseApply_(stoppedView, machineA, today, '2026-11-20T11:00:00+08:00').row.machine, machineA);

const expired = apply(row({ expires: '2026-11-19' }), machineA);
assert.equal(expired.decision.result, 'expired');
assert.equal(expired.row.machine, '', '過期時不要綁定電腦');
assert.equal(apply(row({ expires: '' }), machineA).decision.result, 'expired', '到期日空白不能用');
assert.equal(apply(row({ expires: '2026-11-20' }), machineA).decision.result, 'ok', '到期日當天還能用');

const disabledReply = judge({ fresh: fresh('disabled') });
assert.equal(disabledReply.allow, false);
assert.equal(disabledReply.mode, 'locked');
assert.match(disabledReply.message, /請聯絡業主/);
assert.equal(disabledReply.clearGrace, true);

const expiredReply = judge({ fresh: fresh('expired', { expires: '2026-11-19' }) });
assert.equal(expiredReply.allow, false);
assert.match(expiredReply.message, /到期/);
assert.match(expiredReply.message, /請聯絡業主/);

const otherReply = judge({ fresh: fresh('other_machine') });
assert.equal(otherReply.allow, false);
assert.match(otherReply.message, /另一台/);

const okSigned = fresh('ok');
const okReply = judge({ fresh: okSigned });
assert.equal(okReply.allow, true);
assert.equal(okReply.store.acceptedAt, Date.parse('2026-11-20T10:00:00+08:00'));

function aged(when) {
  return fresh('ok', { serverTime: new Date(when).toISOString() });
}
const within = judge({ fresh: null, stored: storedFrom(aged(now - 6 * day), 0, now - 6 * day), now });
assert.equal(within.allow, true, '斷網未滿 7 天仍可使用');
const exact = judge({ fresh: null, stored: storedFrom(aged(now - license.GRACE_MS), 0, now - license.GRACE_MS), now });
assert.equal(exact.allow, true, '剛好 7 天還能用');
const over = judge({ fresh: null, stored: storedFrom(aged(now - license.GRACE_MS - 1), Date.now(), Date.now()), now });
assert.equal(over.allow, false, '超過 7 天要鎖，改檔案裡的時間也不能延');
assert.equal(over.mode, 'locked');
assert.match(over.message, /請聯絡業主/);

const rolled = judge({
  fresh: null,
  stored: storedFrom(aged(now - 8 * day), now - 8 * day, now),
  now: now - 8 * day
});
assert.equal(rolled.allow, false, '把時鐘調回去也不能延長寬限');

const otherKey = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
const forged = license.signPayload({
  result: 'ok', machineId: machineA, expires: '2099-12-31', name: '假的',
  serverTime: '2026-11-20T10:00:00+08:00', codeHash: license.codeHash(code)
}, otherKey.privateKey);
const forgedReply = judge({ fresh: forged });
assert.equal(forgedReply.allow, false, '別的私鑰簽的回覆不能用');
assert.match(forgedReply.message, /無法確認/);
const flipped = { payload: okSigned.payload, signature: okSigned.signature.slice(0, -2) + (okSigned.signature.endsWith('A') ? 'B' : 'A') };
assert.equal(judge({ fresh: flipped }).allow, false, '改過的簽章不能用');
const tampered = okSigned.payload.replace('ok', 'no');
assert.equal(judge({ fresh: { payload: tampered, signature: okSigned.signature } }).allow, false, '改過的內容不能用');
const graceStill = judge({ fresh: forged, stored: storedFrom(aged(now - day), Date.now(), now - day) });
assert.equal(graceStill.allow, true, '偽造回覆不會拿掉還沒過期的寬限');
assert.equal(graceStill.store.acceptedAt, now - day, '偽造回覆不能把寬限時間往後延');

const liveStop = judge({ fresh: fresh('disabled'), stored: storedFrom(okSigned, now - day, now - day) });
assert.equal(liveStop.allow, false, '停用後即使寬限還沒過也要鎖');
assert.equal(liveStop.clearGrace, true);

const publicPem = fs.readFileSync(path.join(root, 'backend', '授權公鑰.pem'), 'utf8').trim();
assert.equal(publicPem, license.PUBLIC_KEY.trim());
const privatePath = path.join(root, 'backend', '授權私鑰.pem');
if (fs.existsSync(privatePath)) {
  const privateKey = fs.readFileSync(privatePath, 'utf8');
  const signed = license.signPayload(canonicalFields, privateKey);
  assert.equal(license.verify(signed.payload, signed.signature, license.PUBLIC_KEY), true);
  assert.equal(privateKey.includes('BEGIN PRIVATE KEY'), true);
  assert.equal(privateKey.includes('BEGIN RSA PRIVATE KEY'), false);
  const secretLine = privateKey.split(/\r?\n/).find(line => line.length > 40 && !line.includes('PRIVATE KEY'));
  assert.equal(secretLine.length > 40, true);
  assert.equal(fs.readFileSync(path.join(root, 'backend', '程式碼-v19-授權.gs'), 'utf8').includes(secretLine), false);
  assert.equal(fs.readFileSync(path.join(root, 'backend', '授權檢查.gs'), 'utf8').includes(secretLine), false);
}
const v19 = fs.readFileSync(path.join(root, 'backend', '程式碼-v19-授權.gs'), 'utf8');
const addon = fs.readFileSync(path.join(root, 'backend', '授權檢查.gs'), 'utf8');
assert.equal(rules.pureSlice(path.join(root, 'backend', '程式碼-v19-授權.gs')), rules.pureSlice(path.join(root, 'backend', '授權檢查.gs')));
assert.equal(v19.includes("data.action === 'licenseCheck'"), true);
assert.equal(v19.includes(addon.trim()), true);
assert.equal(v19.includes('-----BEGIN PRIVATE KEY-----'), false);
assert.equal(addon.includes('-----BEGIN PRIVATE KEY-----'), false);
assert.equal(fs.readFileSync(path.join(root, 'windows-app', 'main.cjs'), 'utf8').includes('update-signing-key'), true);
assert.equal(license.parseMachineGuid('MachineGuid    REG_SZ    a1b2c3d4-e5f6-7890-abcd-ef1234567890'), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

console.log('PASS license: 第二台被擋、停用鎖住、過期鎖住、斷網 7 天、偽造回覆不被接受');
