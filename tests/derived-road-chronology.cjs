const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const begin = source.indexOf('function buildBigRoad(');
const end = source.indexOf('// ---------- 渲染', begin);
assert.ok(begin >= 0 && end > begin);
const context = vm.createContext({});
vm.runInContext(source.slice(begin, end), context);
const sequence = 'BPBPBBBBBBBPPPPPPPPPPBBBBPBBBPPPBPB';
const rounds = [...sequence].map(r => ({ r }));
const expected = [
  'RRRBRRRRRBRRRRRRBRRBRRRBBBRBRRRBR',
  'RRBRRRRRBBRRRRRRRRBRRRBBRRBBRBBB',
  'RBRRRRRBBRRRRRRRRBBRRBBRRBRRBRB'
];
function marks(input, offset) {
  const big = context.buildBigRoad(input);
  return Array.from(context.buildDerivedRoad(big.grid, offset, big.cols, big.rows));
}
for (let offset = 1; offset <= 3; offset++) {
  assert.equal(marks(rounds, offset).join(''), expected[offset - 1], `35-hand photo fixture, offset ${offset}`);
  for (let count = 0; count <= rounds.length; count++) {
    const prefix = rounds.slice(0, count);
    const before = marks(prefix, offset);
    assert.deepEqual(before, [...expected[offset - 1]].slice(0, before.length), 'Future hands cannot alter earlier derived marks');
    for (const next of ['B', 'P']) {
      const after = marks(prefix.concat({ r: next }), offset);
      assert.deepEqual(after.slice(0, before.length), before, 'Appending a hand preserves the complete previous road');
      const predicted = context.predictNextMark(prefix, next, offset);
      assert.equal(predicted, after.length > before.length ? after.at(-1) : null);
    }
  }
  const withTies = [{ r: 'T' }, ...rounds.flatMap((round, i) => i % 3 ? [round] : [round, { r: 'T' }])];
  assert.equal(marks(withTies, offset).join(''), expected[offset - 1], 'Ties do not add or reorder derived marks');
  assert.equal(marks(rounds.map(({ r }) => ({ r: r === 'B' ? 'P' : 'B' })), offset).join(''), expected[offset - 1], 'Winner colors do not change pattern colors');
  const longTail = [...'BPBP', ...'B'.repeat(40), ...'P'.repeat(30)].map(r => ({ r }));
  assert.equal(marks(longTail, offset).length, longTail.length - offset - 1, 'Every eligible hand counts, including long tails');
}
assert.deepEqual([1, 2, 3].map(offset => marks(rounds, offset).length), [33, 32, 31]);
console.log('PASS: photo fixture = 33/32/31 marks in the correct order; all prefixes, predictions, ties and long tails.');
