// 更新檔（.jjupdate）的驗證與套用核心。只用 Node 內建模組。
// 檔案格式：gzip( JSON { format:1, payload:"<JSON 字串>", sig:"<Ed25519 base64>" } )
// 簽章是對 payload 字串的位元組簽的，所以不會有格式化差異問題。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const ALLOWED_EXT = new Set(['.html', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.webm', '.mp3', '.ogg', '.wav', '.woff2', '.txt']);
const MAX_FILES = 3000;
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_UPDATE_BYTES = 600 * 1024 * 1024;
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

function safeRelative(rel) {
  if (typeof rel !== 'string' || !rel || rel.length > 300) return false;
  if (/[\\:\x00-\x1f<>"|?*]/.test(rel) || rel.startsWith('/')) return false;
  const parts = rel.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p))) return false;
  return ALLOWED_EXT.has(path.extname(rel).toLowerCase());
}
function insideRoot(root, rel) {
  const r = path.resolve(root);
  const full = path.resolve(r, ...rel.split('/'));
  return full.startsWith(r + path.sep) ? full : null;
}
function listFiles(root, sub = '') {
  const out = [];
  for (const item of fs.readdirSync(path.join(root, sub), { withFileTypes: true })) {
    const rel = sub ? `${sub}/${item.name}` : item.name;
    if (item.isDirectory()) out.push(...listFiles(root, rel));
    else out.push(rel);
  }
  return out;
}

// ---------- 製作（make-update 用） ----------
function packUpdate({ privateKeyPem, update, base, seq, files, removed }) {
  const payload = JSON.stringify({
    app: 'jiujiu-roadmap', update, base, seq, created: new Date().toISOString(),
    files: files.map(f => ({ path: f.path, sha256: sha256(f.data), size: f.data.length, data: f.data.toString('base64') })),
    removed: removed || []
  });
  const sig = crypto.sign(null, Buffer.from(payload, 'utf8'), crypto.createPrivateKey(privateKeyPem)).toString('base64');
  return zlib.gzipSync(Buffer.from(JSON.stringify({ format: 1, payload, sig })), { level: 9 });
}

// ---------- 驗證（app 用） ----------
// 回傳 { update, base, seq, files:[{path,data}], removed:[] }；任何問題直接 throw Error(中文原因)
function verifyUpdate(buffer, publicKeyPem, installedVersion) {
  if (buffer.length > MAX_UPDATE_BYTES) throw Error('檔案過大');
  let outer;
  try { outer = JSON.parse(zlib.gunzipSync(buffer, { maxOutputLength: MAX_UPDATE_BYTES * 2 }).toString('utf8')); }
  catch { throw Error('檔案格式不正確'); }
  if (!outer || outer.format !== 1 || typeof outer.payload !== 'string' || typeof outer.sig !== 'string') throw Error('檔案格式不正確');
  let ok = false;
  try { ok = crypto.verify(null, Buffer.from(outer.payload, 'utf8'), crypto.createPublicKey(publicKeyPem), Buffer.from(outer.sig, 'base64')); } catch { ok = false; }
  if (!ok) throw Error('簽章不符');
  let p;
  try { p = JSON.parse(outer.payload); } catch { throw Error('內容不正確'); }
  if (p.app !== 'jiujiu-roadmap') throw Error('不是本程式的更新檔');
  if (p.base !== installedVersion) throw Error(`此更新檔適用 ${p.base} 版，目前安裝的是 ${installedVersion} 版`);
  if (!Number.isInteger(p.seq) || p.seq < 1 || p.update !== `${p.base}-${p.seq}`) throw Error('版本資訊不正確');
  const removedList = p.removed || [];
  if (!Array.isArray(p.files) || !Array.isArray(removedList) || p.files.length + removedList.length > MAX_FILES) throw Error('檔案清單不正確');
  const seen = new Set(), files = [];
  for (const f of p.files) {
    if (!f || !safeRelative(f.path) || seen.has(f.path.toLowerCase())) throw Error(`不允許的路徑：${String(f && f.path).slice(0, 60)}`);
    seen.add(f.path.toLowerCase());
    if (typeof f.data !== 'string' || typeof f.sha256 !== 'string') throw Error('檔案項目不正確');
    const data = Buffer.from(f.data, 'base64');
    if (data.length > MAX_FILE_BYTES || data.length !== f.size) throw Error(`檔案大小不符：${f.path}`);
    if (sha256(data) !== f.sha256) throw Error(`檔案內容不符：${f.path}`);
    files.push({ path: f.path, sha256: f.sha256, data });
  }
  const removed = [];
  for (const r of removedList) {
    if (!safeRelative(r) || seen.has(r.toLowerCase())) throw Error(`不允許的路徑：${String(r).slice(0, 60)}`);
    removed.push(r);
  }
  if (!files.length && !removed.length) throw Error('更新檔是空的');
  return { update: p.update, base: p.base, seq: p.seq, files, removed };
}

// ---------- 套用：先寫暫存資料夾，成功後才改名 ----------
function applyToOverride({ builtinSite, overrideRoot, verified }) {
  fs.mkdirSync(overrideRoot, { recursive: true });
  const tmp = path.join(overrideRoot, `.tmp-${process.pid}-${Date.now()}`);
  const finalDir = path.join(overrideRoot, verified.update);
  try {
    const copyDir = (src, dst) => {
      fs.mkdirSync(dst, { recursive: true });
      for (const item of fs.readdirSync(src, { withFileTypes: true })) {
        if (item.isDirectory()) copyDir(path.join(src, item.name), path.join(dst, item.name));
        else fs.copyFileSync(path.join(src, item.name), path.join(dst, item.name));
      }
    };
    copyDir(builtinSite, tmp);
    for (const r of verified.removed) { const full = insideRoot(tmp, r); if (full) fs.rmSync(full, { force: true }); }
    const hashes = {};
    for (const f of verified.files) {
      const full = insideRoot(tmp, f.path);
      if (!full) throw Error('路徑不安全');
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, f.data);
      hashes[f.path] = f.sha256;
    }
    if (!fs.existsSync(path.join(tmp, '百家樂路單', 'tv.html'))) throw Error('套用後缺少主頁面');
    fs.writeFileSync(path.join(tmp, '_meta.json'), JSON.stringify({ update: verified.update, base: verified.base, seq: verified.seq, files: hashes, removed: verified.removed }));
    fs.rmSync(finalDir, { recursive: true, force: true });
    fs.renameSync(tmp, finalDir);
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
  // 最後才切換「使用中版本」（原子改名）
  const activeFile = path.join(overrideRoot, 'active.json');
  fs.writeFileSync(activeFile + '.tmp', JSON.stringify({ update: verified.update, base: verified.base, seq: verified.seq }));
  fs.renameSync(activeFile + '.tmp', activeFile);
  // 清掉舊的覆蓋版本與殘留暫存
  for (const item of fs.readdirSync(overrideRoot, { withFileTypes: true })) {
    if (item.isDirectory() && item.name !== verified.update) { try { fs.rmSync(path.join(overrideRoot, item.name), { recursive: true, force: true }); } catch {} }
  }
  return finalDir;
}

// 啟動時：找出可用的覆蓋版本；任何不對就回傳 null（使用內建）
function findActive({ overrideRoot, installedVersion }) {
  try {
    const active = JSON.parse(fs.readFileSync(path.join(overrideRoot, 'active.json'), 'utf8'));
    if (active.base !== installedVersion || typeof active.update !== 'string' || active.update !== `${active.base}-${active.seq}`) return null;
    const dir = path.join(overrideRoot, active.update);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, '_meta.json'), 'utf8'));
    if (meta.update !== active.update || meta.base !== installedVersion) return null;
    for (const [rel, hash] of Object.entries(meta.files)) {
      const full = insideRoot(dir, rel);
      if (!full || sha256(fs.readFileSync(full)) !== hash) return null;
    }
    if (!fs.existsSync(path.join(dir, '百家樂路單', 'tv.html'))) return null;
    return { dir, update: active.update, seq: active.seq };
  } catch { return null; }
}

module.exports = { ALLOWED_EXT, sha256, safeRelative, insideRoot, listFiles, packUpdate, verifyUpdate, applyToOverride, findActive };
