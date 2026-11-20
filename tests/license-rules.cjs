const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');

function pureSlice(file) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('// ===== license-pure-start =====');
  const end = text.indexOf('// ===== license-pure-end =====');
  if (start < 0 || end < start) throw new Error('找不到授權規則：' + file);
  return text.slice(start, end);
}

const source = pureSlice(path.join(__dirname, '..', 'backend', '授權檢查.gs'));
const sandbox = {
  licenseHash_(text) {
    return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
  }
};
vm.runInNewContext(source, sandbox, { filename: '授權檢查.gs' });
sandbox.pureSlice = pureSlice;
module.exports = sandbox;
