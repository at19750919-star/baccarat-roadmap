// 製作更新檔：node make-update.cjs
//   --baseline        只產生「完整安裝檔」的基準清單（npm run dist 會自動做）
//   --no-prepare      不重跑 prepare.cjs（測試用）
//   --site <資料夾>   改用別的 site-public（測試用）
//   --out <資料夾>    輸出位置（預設 dist-updates）
//   --key <檔案>      私鑰（預設 ..\update-signing-key\private.pem，或環境變數 JJ_UPDATE_KEY）
//   --seq <數字>      指定更新序號（預設自動 +1）
//   --baseline-dir <資料夾>  基準清單位置（預設 update-baselines）
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const core = require('./update-core.cjs');

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }
const flag = name => process.argv.includes(name);

function hashSite(site) {
  const files = {};
  for (const rel of core.listFiles(site)) files[rel] = core.sha256(fs.readFileSync(path.join(site, ...rel.split('/'))));
  return files;
}

function main() {
  const version = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version;
  const site = path.resolve(arg('--site') || path.join(__dirname, 'site-public'));
  const baselineDir = path.resolve(arg('--baseline-dir') || path.join(__dirname, 'update-baselines'));
  const baselineFile = path.join(baselineDir, `${version}.json`);
  if (!flag('--no-prepare') && !arg('--site')) execFileSync(process.execPath, [path.join(__dirname, 'prepare.cjs')], { cwd: __dirname, stdio: 'inherit' });

  const current = hashSite(site);
  if (flag('--baseline')) {
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.writeFileSync(baselineFile, JSON.stringify({ version, created: new Date().toISOString(), files: current }, null, 1));
    console.log(`已記錄 ${version} 版基準清單：${Object.keys(current).length} 個檔案 -> ${baselineFile}`);
    return;
  }
  if (!fs.existsSync(baselineFile)) throw Error(`找不到 ${version} 版的基準清單：${baselineFile}（請先用 npm run dist 建完整安裝檔）`);
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8')).files;
  const changed = Object.keys(current).filter(rel => baseline[rel] !== current[rel]);
  const removed = Object.keys(baseline).filter(rel => !(rel in current));
  if (!changed.length && !removed.length) { console.log('沒有任何變更，不需要做更新檔。'); process.exitCode = 2; return; }
  for (const rel of [...changed, ...removed]) if (!core.safeRelative(rel)) throw Error(`檔案類型或路徑不允許放進更新檔：${rel}`);

  const keyFile = arg('--key') || process.env.JJ_UPDATE_KEY || path.join(__dirname, '..', 'update-signing-key', 'private.pem');
  if (!fs.existsSync(keyFile)) throw Error(`找不到簽章私鑰：${keyFile}`);
  const seqFile = path.join(baselineDir, `${version}.last-seq`);
  const seq = arg('--seq') ? Number(arg('--seq')) : (fs.existsSync(seqFile) ? Number(fs.readFileSync(seqFile, 'utf8')) : 0) + 1;
  const update = `${version}-${seq}`;
  const buffer = core.packUpdate({
    privateKeyPem: fs.readFileSync(keyFile, 'utf8'), update, base: version, seq,
    files: changed.map(rel => ({ path: rel, data: fs.readFileSync(path.join(site, ...rel.split('/'))) })), removed
  });
  const out = path.resolve(arg('--out') || path.join(__dirname, 'dist-updates'));
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, `玖玖路單更新-${update}.jjupdate`);
  fs.writeFileSync(file, buffer);
  if (!arg('--seq')) { fs.mkdirSync(baselineDir, { recursive: true }); fs.writeFileSync(seqFile, String(seq)); }
  console.log(`更新檔完成：版本 ${update}，變更 ${changed.length} 個、移除 ${removed.length} 個檔案`);
  console.log(`大小 ${(buffer.length / 1048576).toFixed(2)} MB -> ${file}`);
  return file;
}

if (require.main === module) { try { main(); } catch (e) { console.error('失敗：' + e.message); process.exitCode = 1; } }
module.exports = { hashSite };
