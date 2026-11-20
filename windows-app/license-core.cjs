// 安裝版授權判斷。只認有簽章的伺服器回覆。私鑰不在這個檔案裡。
const crypto = require('node:crypto');

const GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const SKEW_MS = 36 * 60 * 60 * 1000;
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAi61F06cDfekZvKU7S5o8
qhts0c/ViWrANcylEyB2i0QkaEA+MQKzD2UVvyT7YvDhtNtvkjTVRIu9/FTQOS7o
qpuE04IQf5bM61lpOnu06e8UQyQvmzUmm36krFlC9rFuJn1iPCoqpIJAADtN00g4
lox5f5bhOJLGeQKDUVPOGc6REeKob0ebPdJZtVysEqoL7PAEGQ1pj60LBSyZrKVI
P3EMkCOtu/6LvI9HU4phbN9g6RFA9bB3dMoFubD6x0CK+BnGpGJBtmSY4SME2m8X
hjPcXFiBXLfWyD7GzF7BG8x4oT13rrB4VcOZLTixk4VUXKRTEbuQnFM2nvAN2AtJ
AQIDAQAB
-----END PUBLIC KEY-----`;

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}
function codeOk(code) {
  const normalized = normalizeCode(code);
  return normalized.length >= 4 && normalized.length <= 64 && /^[A-Z0-9-]+$/.test(normalized);
}
function codeHash(code) {
  return crypto.createHash('sha256').update(normalizeCode(code), 'utf8').digest('hex');
}
function cleanField(value, max) {
  return String(value || '').replace(/[\r\n]/g, ' ').slice(0, max);
}
function canonical(fields) {
  return [
    'jiujiu-license-v1',
    cleanField(fields.result, 40),
    cleanField(fields.machineId, 80),
    cleanField(fields.expires, 10),
    cleanField(fields.name, 40),
    cleanField(fields.serverTime, 40),
    cleanField(fields.codeHash, 64)
  ].join('\n');
}
function parse(payload) {
  if (typeof payload !== 'string') return null;
  const lines = payload.split('\n');
  if (lines.length !== 7 || lines[0] !== 'jiujiu-license-v1') return null;
  return { result: lines[1], machineId: lines[2], expires: lines[3], name: lines[4], serverTime: lines[5], codeHash: lines[6] };
}
function verify(payload, signature, publicKey) {
  if (typeof payload !== 'string' || typeof signature !== 'string' || !signature) return false;
  try {
    return crypto.verify('RSA-SHA256', Buffer.from(payload, 'utf8'), crypto.createPublicKey(publicKey || PUBLIC_KEY), Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}
function signPayload(fields, privateKeyPem) {
  const payload = canonical(fields);
  const signature = crypto.sign('RSA-SHA256', Buffer.from(payload, 'utf8'), crypto.createPrivateKey(privateKeyPem)).toString('base64');
  return { payload, signature };
}
function todayTaipei(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}
function parseMachineGuid(text) {
  const match = String(text || '').match(/MachineGuid\s+REG_\w+\s+(\S+)/);
  return match ? match[1].trim() : '';
}
function machineOk(machineId) {
  return typeof machineId === 'string' && /^[A-Za-z0-9-]{8,80}$/.test(machineId);
}

function deny(mode, message, clearGrace, rememberCode) {
  return { allow: false, mode, message, clearGrace: !!clearGrace, rememberCode: !!rememberCode, store: null };
}
function ready(store) {
  return { allow: true, mode: 'ready', message: '', clearGrace: false, rememberCode: true, store };
}
function storedUsable(stored, ctx) {
  if (!stored || typeof stored.payload !== 'string' || typeof stored.signature !== 'string') return null;
  if (!verify(stored.payload, stored.signature, ctx.publicKey)) return null;
  const parsed = parse(stored.payload);
  if (!parsed || parsed.result !== 'ok') return null;
  if (parsed.machineId !== ctx.machineId || parsed.codeHash !== codeHash(ctx.code)) return null;
  if (!parsed.expires || parsed.expires < ctx.today) return null;
  const acceptedAt = Date.parse(parsed.serverTime);
  if (!Number.isFinite(acceptedAt)) return null;
  return { stored, parsed, acceptedAt };
}
function withinGrace(acceptedAt, maxSeenAt, now) {
  const seen = Math.max(Number(maxSeenAt) || 0, now, acceptedAt);
  return seen - acceptedAt <= GRACE_MS;
}

function evaluate(opts) {
  const now = Number(opts.now);
  const today = opts.today || todayTaipei(now);
  const publicKey = opts.publicKey || PUBLIC_KEY;
  const machineId = String(opts.machineId || '');
  const code = normalizeCode(opts.code || '');
  const interactive = !!opts.interactive;
  const usable = code && machineOk(machineId) ? storedUsable(opts.stored, { publicKey, machineId, code, today }) : null;
  const fresh = opts.fresh;
  let rejectedSignature = false;
  let unavailable = false;

  if (fresh && !fresh.invalid && typeof fresh.payload === 'string') {
    const signed = verify(fresh.payload, fresh.signature, publicKey);
    const parsed = signed ? parse(fresh.payload) : null;
    const bound = parsed && parsed.machineId === machineId && parsed.codeHash === codeHash(code);
    if (!signed || !parsed || !bound) {
      rejectedSignature = true;
    } else if (parsed.result === 'disabled') {
      return deny('locked', '這份授權已停用。請聯絡業主。', true, true);
    } else if (parsed.result === 'expired') {
      return deny('locked', '這份授權已到期。請聯絡業主。', true, true);
    } else if (parsed.result === 'other_machine') {
      return deny('locked', '這份授權已經用在另一台電腦。請聯絡業主。', true, true);
    } else if (parsed.result === 'not_found') {
      return interactive
        ? deny('activate', '找不到這個授權碼，請再確認一次。', true, false)
        : deny('locked', '找不到這個授權碼。請聯絡業主。', true, false);
    } else if (parsed.result === 'bad_request') {
      return deny('activate', '授權碼格式不對。請向業主確認授權碼。', true, false);
    } else if (parsed.result === 'unavailable') {
      unavailable = true;
    } else if (parsed.result === 'ok') {
      if (!parsed.expires || parsed.expires < today) return deny('locked', '這份授權已到期。請聯絡業主。', true, true);
      const signedAt = Date.parse(parsed.serverTime);
      if (Number.isFinite(signedAt)) {
        const seenFloor = Math.max(now, usable ? Number(usable.stored.maxSeenAt) || 0 : 0, signedAt);
        if (Math.abs(now - signedAt) <= SKEW_MS) {
          return ready({ version: 1, code, payload: fresh.payload, signature: fresh.signature, acceptedAt: signedAt, maxSeenAt: seenFloor });
        }
        if (withinGrace(signedAt, seenFloor, now)) {
          const keepNewer = usable && usable.acceptedAt > signedAt;
          return ready({
            version: 1,
            code,
            payload: keepNewer ? usable.stored.payload : fresh.payload,
            signature: keepNewer ? usable.stored.signature : fresh.signature,
            acceptedAt: keepNewer ? usable.acceptedAt : signedAt,
            maxSeenAt: seenFloor
          });
        }
      } else {
        rejectedSignature = true;
      }
    }
  }

  if (usable && withinGrace(usable.acceptedAt, usable.stored.maxSeenAt, now)) {
    const maxSeenAt = Math.max(Number(usable.stored.maxSeenAt) || 0, now, usable.acceptedAt);
    return ready({ version: 1, code, payload: usable.stored.payload, signature: usable.stored.signature, acceptedAt: usable.acceptedAt, maxSeenAt });
  }
  if (!code) return deny('activate', '請輸入業主給你的授權碼。', false, false);
  if (rejectedSignature || (fresh && fresh.invalid)) return deny('locked', '授權伺服器的回覆無法確認。請聯絡業主。', false, true);
  if (unavailable) return deny('locked', '授權伺服器還沒設定好。請聯絡業主。', false, true);
  if (fresh == null) {
    if (interactive || !opts.stored) return deny('activate', '現在沒有網路，無法啟用。請先連上網路。', false, false);
    return deny('locked', '已經超過 7 天沒有連線確認。請聯絡業主。', false, true);
  }
  return deny('locked', '授權確認失敗。請聯絡業主。', false, true);
}

module.exports = {
  GRACE_MS, SKEW_MS, PUBLIC_KEY,
  normalizeCode, codeOk, codeHash, canonical, parse, verify, signPayload,
  todayTaipei, parseMachineGuid, machineOk, evaluate
};
