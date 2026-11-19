const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const site = path.join(__dirname, 'site-public');
const target = path.join(site, '百家樂路單');
const vendor = path.join(target, 'vendor');
fs.mkdirSync(vendor, { recursive: true });
function copy(relative) {
  const dest = path.join(target, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, relative), dest);
}
async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/132.0.0.0 Safari/537.36' }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw Error(`${response.status}: ${url}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}
async function prepare() {
  let html = execFileSync('git', ['show', 'HEAD:tv.html'], { cwd: root, encoding: 'utf8' });
  if (/tv-edit-mode|共用元件|tvEditPanel/.test(html)) throw Error('The release HTML must not include the editor');
  const googleURL = html.match(/href="(https:\/\/fonts.googleapis.com\/css2[^\"]+)"/)[1].replaceAll('&amp;', '&');
  for (const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:[^" ]*)"/g)) {
    const name = match[1];
    if (!/^(https?:|data:|\.\.\/|#)/.test(name) && fs.existsSync(path.join(root, name))) copy(name);
  }
  for (const relative of ['app.js', 'tv-export.js', 'tv-jiujiu-logo-gold-v5.png', '特效/dragon-long-v2.webm']) copy(relative);
  function copyMedia(sub) {
    for (const item of fs.readdirSync(path.join(root, sub), { withFileTypes: true })) {
      const relative = path.posix.join(sub, item.name);
      if (item.isDirectory()) copyMedia(relative);
      else if (/\.(png|webm|mp3)$/i.test(item.name)) copy(relative);
    }
  }
  for (const sub of ['assets/beads', 'assets/dragons', 'assets/sounds']) copyMedia(sub);
  copy('assets/dragon_banker.png'); copy('assets/dragon_player.png');
  await download('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', path.join(vendor, 'html2canvas.min.js'));
  await download(googleURL, path.join(vendor, 'fonts-source.css'));
  let css = fs.readFileSync(path.join(vendor, 'fonts-source.css'), 'utf8');
  const urls = [...new Set([...css.matchAll(/url\((https:\/\/[^)]+)\)/g)].map(match => match[1]))];
  let count = 0;
  for (let offset = 0; offset < urls.length; offset += 8) {
    await Promise.all(urls.slice(offset, offset + 8).map(async url => {
      const filename = crypto.createHash('sha256').update(url).digest('hex').slice(0, 20) + '.woff2';
      await download(url, path.join(vendor, 'fonts', filename));
      css = css.split(url).join('fonts/' + filename);
      count++;
    }));
  }
  fs.writeFileSync(path.join(vendor, 'fonts.css'), css);
  const licenses = { abrilfatface: 'ofl/abrilfatface', cinzel: 'ofl/cinzel', cormorantgaramond: 'ofl/cormorantgaramond', notoseriftc: 'ofl/notoseriftc' };
  for (const [name, folder] of Object.entries(licenses)) await download(`https://raw.githubusercontent.com/google/fonts/main/${folder}/OFL.txt`, path.join(vendor, name + '-OFL.txt'));
  html = html.replace(/<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '')
    .replace('<link href="style.css?v=9"', '<link href="vendor/fonts.css" rel="stylesheet"/>\n<link href="style.css?v=9"')
    .replace('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js', 'vendor/html2canvas.min.js');
  html = html.replace('<head>', '<head>\n<script>window.ROADMAP_PUBLIC_DESKTOP = true;</script>');
  fs.writeFileSync(path.join(target, 'tv.html'), html);
  fs.copyFileSync(path.join(__dirname, 'offline-save.js'), path.join(target, 'road_backup.js'));
  // Match GitHub: only the public settings tabs are exposed, despite file:// loading.
  const tvPath = path.join(target, 'tv.js');
  let tv = fs.readFileSync(tvPath, 'utf8');
  tv = tv.replace("const localSettings = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);", "const localSettings = false; // Same settings scope as GitHub public release.");
  fs.writeFileSync(tvPath, tv);
  let app = fs.readFileSync(path.join(target, 'app.js'), 'utf8');
  app = app.replace('請輸入路單名稱（保留本機清單與 JSON 下載，並送出 JSON＋PNG 雲端備份）：', '請輸入路單名稱：')
           .replace('請輸入路單名稱（保留本機清單與 JSON 存檔）：', '請輸入路單名稱：');
  // The native offline save handles local file writing, without duplicate downloads.
  const begin = app.indexOf('  if ((!silent || !backup) && !window.OfflineRoadmap) {');
  const end = app.indexOf('  if (backup) {', begin >= 0 ? begin : 0);
  if (begin >= 0 && end > begin) {
    app = app.slice(0, begin) + app.slice(end);
  }
  fs.writeFileSync(path.join(target, 'app.js'), app);
  fs.writeFileSync(path.join(__dirname, 'build-manifest.json'), JSON.stringify({ generated: new Date().toISOString(), fonts: count, entry: 'site-public/百家樂路單/tv.html' }, null, 2));
  console.log(`Offline public site ready: ${count} local font files; no editor.`);
}
prepare().catch(error => { console.error(error); process.exitCode = 1; });
