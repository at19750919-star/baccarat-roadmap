const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const rules = require('./license-rules.cjs');
const license = require('../windows-app/license-core.cjs');

const root = path.resolve(__dirname, '..');
const privateKey = fs.readFileSync(path.join(root, 'backend', '授權私鑰.pem'), 'utf8');
const { _electron } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const electronPath = require(path.join(root, 'windows-app', 'node_modules', 'electron'));
const code = 'JJ-TEST-0001';
const machineA = 'MACHINE-AAA';
const machineB = 'MACHINE-BBB';
const day = 24 * 60 * 60 * 1000;
let offline = false;
let forged = false;
let hits = 0;
const sheet = { name: '測試客人', code, status: '啟用', expires: '2027-12-31', machine: '', activated: '', lastSeen: '', note: '' };

function reply(body, res) {
  hits += 1;
  const request = JSON.parse(body || '{}');
  if (forged) {
    const other = require('node:crypto').generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
    const signed = license.signPayload({
      result: 'ok', machineId: request.machineId, expires: '2099-12-31', name: '假的',
      serverTime: new Date().toISOString(), codeHash: license.codeHash(request.code)
    }, other.privateKey);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, payload: signed.payload, signature: signed.signature }));
    return;
  }
  const today = license.todayTaipei(Date.now());
  const source = {
    name: sheet.name, code: sheet.code, status: rules.licenseNormalizeStatus_(sheet.status), expires: sheet.expires,
    machine: sheet.machine, activated: sheet.activated, lastSeen: sheet.lastSeen, note: sheet.note
  };
  const applied = rules.licenseApply_(source, request.machineId, today, new Date().toISOString());
  sheet.machine = applied.row.machine;
  sheet.activated = applied.row.activated;
  sheet.lastSeen = applied.row.lastSeen;
  const signed = license.signPayload({
    result: applied.decision.result, machineId: request.machineId, expires: applied.row.expires || '',
    name: applied.row.name || '', serverTime: new Date().toISOString(), codeHash: license.codeHash(request.code)
  }, privateKey);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: true, payload: signed.payload, signature: signed.signature }));
}

const server = http.createServer((req, res) => {
  if (offline) { req.socket.destroy(); return; }
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => reply(body, res));
});

function launch(profile, machineId) {
  return _electron.launch({
    executablePath: electronPath,
    args: [path.join(root, 'windows-app')],
    env: {
      ...process.env,
      ROADMAP_TEST_PROFILE: profile,
      ROADMAP_LICENSE_ENFORCE: '1',
      ROADMAP_MACHINE_ID: machineId,
      ROADMAP_LICENSE_URL: 'http://127.0.0.1:' + server.address().port + '/'
    },
    timeout: 45000
  });
}
async function boot(profile, machineId) {
  const application = await launch(profile, machineId);
  const page = await application.firstWindow();
  page.setDefaultTimeout(40000);
  return { application, page };
}
async function ready(page) {
  await page.waitForFunction(() => window.RoadmapLicense && document.getElementById('submit') && document.getElementById('submit').onclick);
}
async function activate(application, page) {
  await ready(page);
  try {
    await page.evaluate(value => {
      document.getElementById('code').value = value;
      document.getElementById('submit').click();
    }, code);
  } catch (error) {
    if (!/destroyed|navigation/i.test(String(error && error.message))) throw error;
  }
  const current = await application.firstWindow();
  await current.waitForFunction(() => window.BaccaratTVView && typeof window.html2canvas === 'function');
  return current;
}
function stateFile(profile) {
  return path.join(profile, 'license-state.json');
}
function ageState(profile, ageMs) {
  const saved = JSON.parse(fs.readFileSync(stateFile(profile), 'utf8'));
  const parsed = license.parse(saved.payload);
  const signedAt = Date.now() - ageMs;
  const signed = license.signPayload({
    result: parsed.result, machineId: parsed.machineId, expires: parsed.expires, name: parsed.name,
    serverTime: new Date(signedAt).toISOString(), codeHash: parsed.codeHash
  }, privateKey);
  saved.payload = signed.payload;
  saved.signature = signed.signature;
  saved.acceptedAt = Date.now();
  saved.maxSeenAt = signedAt;
  fs.writeFileSync(stateFile(profile), JSON.stringify(saved));
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jiujiu-license-'));
  const apps = [];
  try {
    let opened = await boot(profile, machineA);
    apps.push(opened.application);
    await opened.page.locator('#lead').waitFor();
    assert.match(await opened.page.locator('#lead').textContent(), /授權碼/);
    await activate(opened.application, opened.page);
    assert.equal(sheet.machine, machineA, '第一台要寫進綁定');
    await opened.application.close();

    opened = await boot(profile, machineB);
    apps.push(opened.application);
    await opened.page.locator('#lockedMessage').waitFor();
    const otherText = await opened.page.locator('#lockedMessage').textContent();
    assert.match(otherText, /另一台/);
    assert.match(await opened.page.locator('#lead').textContent(), /請聯絡業主/);
    await opened.application.close();

    sheet.status = '停用';
    opened = await boot(profile, machineA);
    apps.push(opened.application);
    await opened.page.locator('#lockedMessage').waitFor();
    assert.match(await opened.page.locator('#lockedMessage').textContent(), /停用/);
    assert.match(await opened.page.locator('#lead').textContent(), /請聯絡業主/);
    const kept = JSON.parse(fs.readFileSync(stateFile(profile), 'utf8'));
    assert.equal(kept.payload, undefined, '停用後不可再靠舊的通過回覆');
    await opened.application.close();

    sheet.status = '啟用';
    sheet.expires = '2020-01-01';
    opened = await boot(profile, machineA);
    apps.push(opened.application);
    await opened.page.locator('#lockedMessage').waitFor();
    assert.match(await opened.page.locator('#lockedMessage').textContent(), /到期/);
    await opened.application.close();

    sheet.expires = '2027-12-31';
    sheet.machine = machineA;
    opened = await boot(profile, machineA);
    apps.push(opened.application);
    await opened.page.waitForFunction(() => window.BaccaratTVView && typeof window.html2canvas === 'function');
    await opened.application.close();
    const saved = JSON.parse(fs.readFileSync(stateFile(profile), 'utf8'));
    ageState(profile, 6 * day);
    offline = true;
    opened = await boot(profile, machineA);
    apps.push(opened.application);
    await opened.page.waitForFunction(() => window.BaccaratTVView && typeof window.html2canvas === 'function');
    await opened.application.close();
    ageState(profile, 8 * day);
    opened = await boot(profile, machineA);
    apps.push(opened.application);
    await opened.page.locator('#lockedMessage').waitFor();
    assert.match(await opened.page.locator('#lockedMessage').textContent(), /7 天/);
    await opened.application.close();

    offline = false;
    forged = true;
    const clean = fs.mkdtempSync(path.join(os.tmpdir(), 'jiujiu-license-forge-'));
    opened = await boot(clean, machineA);
    apps.push(opened.application);
    await ready(opened.page);
    await opened.page.evaluate(value => {
      document.getElementById('code').value = value;
      document.getElementById('submit').click();
    }, code);
    await opened.page.waitForFunction(() => (document.querySelector('#lockedMessage') || {}).textContent.includes('無法確認'));
    assert.match(await opened.page.locator('#lead').textContent(), /請聯絡業主/);
    assert.equal(await opened.page.locator('#tvSettingsButton').count(), 0);
    await opened.application.close();
    assert.ok(hits >= 5, '授權檢查要打到測試伺服器，不是正式網址');
    console.log('PASS license app: 啟用、第二台、停用、過期、斷網 7 天、偽造回覆');
  } finally {
    for (const application of apps) { try { await application.close(); } catch { /* 已關閉 */ } }
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
