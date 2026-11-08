const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const start = source.indexOf('function layoutDerivedMarks(');
const end = source.indexOf('// ---------- 下局預測', start);
assert.ok(start >= 0 && end > start);
const context = vm.createContext({});
vm.runInContext(source.slice(start, end), context);
const layout = (marks, rows = 6) => context.layoutDerivedMarks(marks.split(''), rows);

// Screenshot: blue x2, red x4, blue x1, red x8; the next blue belongs in column 5.
let road = layout('BBRRRRBRRRRRRRRB');
assert.equal(road.grid[0][4], 'B', 'After the red tail, blue must start at column 5');
assert.equal(road.grid[0][6], undefined, 'Blue must not jump to column 7');
assert.equal(road.grid[5][4], 'R', 'The red tail remains where it was');
assert.equal(road.grid[5][5], 'R', 'The existing final red remains in the tail');

road = layout('RRRRRRRRRBBBBBBBBR');
assert.equal(road.grid[0][1], 'B', 'First color break follows the red starting column');
assert.equal(road.grid[0][2], 'R', 'The next color break follows the blue starting column');
road = layout('RRRRRB', 3);
assert.equal(road.grid[0][1], 'B', 'The rule also works with a different row count');
road = layout('RRRB', 1);
assert.equal(road.grid[0][3], 'B', 'Occupied top-row cells are still skipped');
road = layout('BRBR');
assert.deepEqual([0, 1, 2, 3].map(col => road.grid[0][col]), ['B', 'R', 'B', 'R']);
assert.equal(layout('').cols, 0);
console.log('PASS: streak breaks use the next starting column; tails and occupied cells are preserved.');
