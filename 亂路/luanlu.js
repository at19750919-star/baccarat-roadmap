'use strict';

// 規律懲罰用正數累加，越低越好。更改權重只需調整此處。
const WEIGHTS = Object.freeze({ adjacent: 3, sameExtra: 5, alternating: 4,
  ordered: 3, period: 4, dominant: 3,
  derivedRedBase: 0.65, derivedRed: 3 });
const DEFAULTS = Object.freeze({ count: 5, rounds: 82, maxDifference: 4, maxRun: 6,
  prefix: '路單-AT', startNumber: 1, attempts: 3000, hillSteps: 2000, seed: '',
  perSideMax: 2, combinedMax: 3, includeSingles: false,
  holeMax: '', pillarMax: '', maxHoleLength: '', randomMode: false, scoreMode: 'big' });
const DERIVED_ROADS = Object.freeze([
  { key: 'bigEye', label: '大眼仔', offset: 1 },
  { key: 'smallRoad', label: '小路', offset: 2 },
  { key: 'cockroachRoad', label: '蟑螂路', offset: 3 }
]);
const HIGHLIGHT_COLORS = Object.freeze({
  line: { stroke: '#79d7ae', fill: 'rgba(121, 215, 174, .38)' },
  hole: { stroke: '#ff8895', fill: 'rgba(255, 136, 149, .38)' },
  pillar: { stroke: '#8bbbff', fill: 'rgba(139, 187, 255, .38)' }
});
function highlightKinds(items) { return [...new Set(items.map(item => item.kind))]; }

function toRuns(outcomes) {
  const runs = [];
  let last;
  for (const value of outcomes) {
    if (value !== '莊' && value !== '閒') throw new Error('路單只能包含莊或閒。');
    if (value === last) runs[runs.length - 1]++;
    else { runs.push(1); last = value; }
  }
  return runs;
}

// 綠依莊、閒分開記錄兩顆以上欄的顆數；firstSide 為第一欄是莊或閒。
function getSequences(runs, firstSide = '莊') {
  const red = [], blue = [], greenBanker = [], greenPlayer = [];
  let kind = null;
  runs.forEach((length, i) => {
    if (!Number.isInteger(length) || length < 1) throw new Error('欄長必須為正整數。');
    const next = length === 1 ? red : blue;
    if (next === kind) next[next.length - 1]++;
    else next.push(1);
    if (length >= 2) ((i % 2 === 0) === (firstSide === '莊') ? greenBanker : greenPlayer).push(length);
    kind = next;
  });
  return { red, blue, greenBanker, greenPlayer };
}

// 預設排除單跳；第三個參數供「單顆行也算」及卡片統計使用。
function countColumnLengths(runs, firstSide = '莊', { includeSingles = false } = {}) {
  const counts = { banker: {}, player: {}, total: {} };
  runs.forEach((length, i) => {
    if (!Number.isInteger(length) || length < 1) throw new Error('欄長必須為正整數。');
    if (length === 1 && !includeSingles) return;
    const side = (i % 2 === 0) === (firstSide === '莊') ? 'banker' : 'player';
    counts[side][length] = (counts[side][length] || 0) + 1;
    counts.total[length] = (counts.total[length] || 0) + 1;
  });
  return counts;
}

function checkLengthCaps(runs, firstSide = '莊', opts = {}) {
  const { perSideMax = 2, combinedMax = 3, includeSingles = false } = opts;
  const counts = countColumnLengths(runs, firstSide, { includeSingles }), violations = [];
  for (const [side, label, max] of [['banker', '莊', perSideMax], ['player', '閒', perSideMax], ['total', '合計', combinedMax]]) {
    for (const [length, count] of Object.entries(counts[side])) {
      if (max !== '' && count > max) violations.push(`${label} ${length}顆欄有 ${count} 欄，超過上限 ${max} 欄`);
    }
  }
  return { ok: violations.length === 0, violations };
}

// 洞、柱都莊閒混看；同長度在整條路單出現的次數加總，並非連續重複次數。
function countSequenceLengths(sequence) {
  const counts = {};
  for (const length of sequence) counts[length] = (counts[length] || 0) + 1;
  return counts;
}
function countHoleLengths(runs) { return countSequenceLengths(getSequences(runs).red); }
function countPillarLengths(runs) { return countSequenceLengths(getSequences(runs).blue); }
function checkSequenceCap(counts, max, label) {
  const violations = [];
  if (max !== '') {
    for (const [length, count] of Object.entries(counts)) {
      if (count > max) violations.push(`${length}欄的${label}出現 ${count} 次，超過上限 ${max} 次`);
    }
  }
  return { ok: violations.length === 0, violations };
}
function checkHoleCaps(runs, { holeMax = '' } = {}) {
  return checkSequenceCap(countHoleLengths(runs), holeMax, '洞');
}
function checkPillarCaps(runs, { pillarMax = '' } = {}) {
  return checkSequenceCap(countPillarLengths(runs), pillarMax, '柱');
}

// 每種上限各自計超出次數；單邊與合計同時超限時分別加分。
function scoreCapExcess(runs, firstSide = '莊', opts = {}) {
  if (opts.randomMode) return { total: 0, line: 0, hole: 0, pillar: 0, details: [] };
  const { perSideMax = 2, combinedMax = 3, includeSingles = false,
    holeMax = '', pillarMax = '' } = opts;
  const details = [], totals = { line: 0, hole: 0, pillar: 0 };
  function add(kind, label, length, count, limit) {
    if (limit === '' || count <= limit) return;
    const excess = count - limit;
    details.push({ kind, label, length: Number(length), count, limit, excess, points: excess });
    totals[kind] += excess;
  }
  const lines = countColumnLengths(runs, firstSide, { includeSingles });
  for (const [side, label, limit] of [['banker', '莊單邊行', perSideMax],
    ['player', '閒單邊行', perSideMax], ['total', '合計行', combinedMax]]) {
    for (const [length, count] of Object.entries(lines[side])) add('line', label, length, count, limit);
  }
  for (const [kind, label, limit, counts] of [['hole', '同長洞', holeMax, countHoleLengths(runs)],
    ['pillar', '同長柱', pillarMax, countPillarLengths(runs)]]) {
    for (const [length, count] of Object.entries(counts)) add(kind, label, length, count, limit);
  }
  return { total: totals.line + totals.hole + totals.pillar, ...totals, details };
}

// 記錄同長度整組欄位的超限原因，供卡片文字說明使用。
function getViolationColumns(runs, firstSide = '莊', opts = {}) {
  const reasons = runs.map(() => []);
  if (opts.randomMode) return reasons;
  const { perSideMax = 2, combinedMax = 3, includeSingles = false,
    holeMax = '', pillarMax = '' } = opts;
  const groups = { banker: new Map(), player: new Map(), total: new Map() };
  runs.forEach((length, i) => {
    if (length === 1 && !includeSingles) return;
    const side = (i % 2 === 0) === (firstSide === '莊') ? 'banker' : 'player';
    for (const key of [side, 'total']) {
      if (!groups[key].has(length)) groups[key].set(length, []);
      groups[key].get(length).push(i);
    }
  });
  for (const [key, label, max] of [['banker', '莊單邊行', perSideMax],
    ['player', '閒單邊行', perSideMax], ['total', '合計行', combinedMax]]) {
    if (max === '') continue;
    for (const [length, indices] of groups[key]) {
      if (indices.length <= max) continue;
      const message = `${label}：${length}顆欄共有 ${indices.length} 欄，超過上限 ${max} 欄`;
      for (const i of indices) reasons[i].push(message);
    }
  }
  const segments = { hole: new Map(), pillar: new Map() };
  for (let start = 0; start < runs.length;) {
    const kind = runs[start] === 1 ? 'hole' : 'pillar';
    let end = start + 1;
    while (end < runs.length && (runs[end] === 1 ? 'hole' : 'pillar') === kind) end++;
    const length = end - start;
    if (!segments[kind].has(length)) segments[kind].set(length, []);
    segments[kind].get(length).push([start, end]);
    start = end;
  }
  for (const [kind, label, max] of [['hole', '洞', holeMax], ['pillar', '柱', pillarMax]]) {
    if (max === '') continue;
    for (const [length, ranges] of segments[kind]) {
      if (ranges.length <= max) continue;
      const message = `同長${label}：${length}欄的${label}出現 ${ranges.length} 次，超過上限 ${max} 次`;
      for (const [start, end] of ranges) for (let i = start; i < end; i++) reasons[i].push(message);
    }
  }
  return reasons;
}

function scoreSequence(seq, traceHits = false) {
  const reasons = [], hits = [];
  let total = 0;
  function add(label, count, weight) {
    if (count > 0) { const points = count * weight; total += points; reasons.push({ label, count, points }); }
  }
  const mark = (label, points, start, end) => {
    if (traceHits) hits.push({ label, points,
      indices: Array.from({ length: end - start + 1 }, (_, offset) => start + offset) });
  };
  let adjacent = 0, sameExtra = 0, alternating = 0, ordered = 0, period = 0;
  let sameLength = 1, altLength = 2, orderLength = 1, direction = 0, orderHit = null;
  for (let i = 1; i < seq.length; i++) {
    sameLength = seq[i] === seq[i - 1] ? sameLength + 1 : 1;
    if (sameLength >= 2) { adjacent++; mark('相鄰重複', WEIGHTS.adjacent, i - 1, i); }
    if (sameLength >= 3) { sameExtra++; mark('連續相同加罰', WEIGHTS.sameExtra, i - sameLength + 1, i); }
    if (i >= 2) {
      altLength = seq[i] === seq[i - 2] && seq[i] !== seq[i - 1] ? altLength + 1 : 2;
      // ABAB 首次達四項計一次，以後每延長一項再計一次。
      if (altLength >= 4) { alternating++; mark('交替', WEIGHTS.alternating, i - altLength + 1, i); }
    }
    const diff = seq[i] - seq[i - 1];
    if (Math.abs(diff) === 1) {
      orderLength = diff === direction ? orderLength + 1 : 2;
      // 每個最大連續遞增／遞減段只計一次。
      if (orderLength === 3) { ordered++; mark('順序', WEIGHTS.ordered, i - 2, i); orderHit = traceHits ? hits[hits.length - 1] : null; }
      else if (orderLength > 3 && orderHit) orderHit.indices.push(i);
      else orderHit = null;
      direction = diff;
    } else { orderLength = 1; direction = 0; orderHit = null; }
  }
  for (const size of [2, 3]) {
    for (let i = 0; i + size * 2 <= seq.length; i++) {
      // ABAB 已由交替計分；相同數字組成的 A A A A 仍照週期計分。
      if (size === 2 && seq[i] !== seq[i + 1]) continue;
      if (seq.slice(i, i + size).every((n, j) => n === seq[i + size + j])) {
        period++; mark('週期', WEIGHTS.period, i, i + size * 2 - 1);
      }
    }
  }
  add('相鄰重複', adjacent, WEIGHTS.adjacent);
  add('連續相同加罰', sameExtra, WEIGHTS.sameExtra);
  add('交替', alternating, WEIGHTS.alternating);
  add('順序', ordered, WEIGHTS.ordered);
  add('週期', period, WEIGHTS.period);
  if (seq.length >= 4) {
    const counts = new Map();
    for (const n of seq) counts.set(n, (counts.get(n) || 0) + 1);
    const maximum = Math.max(...counts.values());
    // 按比例連續計分，例如超過 5 個百分點計 1.5 分。
    const excess = Math.max(0, (maximum / seq.length - 0.5) * 10);
    add('某數過多（每10個百分點）', excess, WEIGHTS.dominant);
    if (traceHits && excess > 0) {
      const dominant = [...counts].find(([, count]) => count === maximum)[0];
      hits.push({ label: '某數過多', points: excess * WEIGHTS.dominant,
        indices: seq.flatMap((value, i) => value === dominant ? [i] : []) });
    }
  }
  return { total, reasons, hits };
}

function scoreRoad(outcomes, traceHits = false) {
  const sequences = getSequences(toRuns(outcomes), outcomes[0]);
  const red = scoreSequence(sequences.red, traceHits), blue = scoreSequence(sequences.blue, traceHits);
  const greenBanker = scoreSequence(sequences.greenBanker, traceHits), greenPlayer = scoreSequence(sequences.greenPlayer, traceHits);
  return { total: red.total + blue.total + greenBanker.total + greenPlayer.total,
    red, blue, greenBanker, greenPlayer };
}

// 與 app.js 相同：大路 6 列、同色往下、滿列或下方已佔則拖尾。格子只記莊／閒。
function columnHeight(grid, col, maxRows) {
  let h = 0;
  for (let r = 0; r < maxRows; r++) {
    if (grid[r][col]) h++;
    else break;
  }
  return h;
}
function hasAt(grid, col, row) {
  return !!(grid[row] && grid[row][col]);
}
function buildBigRoadGrid(outcomes, rows = 6) {
  const grid = [];
  for (let r = 0; r < rows; r++) grid.push({});
  let curCol = -1, curRow = -1, curColor = null, curStartCol = -1, maxCol = -1;
  for (const color of outcomes) {
    if (curCol < 0) {
      curCol = 0; curRow = 0; curColor = color; curStartCol = 0;
    } else if (color === curColor) {
      const nextRow = curRow + 1;
      if (nextRow < rows && !grid[nextRow][curCol]) curRow = nextRow;
      else {
        let nextCol = curCol + 1;
        while (grid[curRow][nextCol]) nextCol++;
        curCol = nextCol;
      }
    } else {
      let nextCol = curStartCol + 1;
      while (grid[0][nextCol]) nextCol++;
      curCol = nextCol; curRow = 0; curColor = color; curStartCol = nextCol;
    }
    grid[curRow][curCol] = color;
    if (curCol > maxCol) maxCol = curCol;
  }
  return { grid, cols: maxCol + 1, rows };
}
// 移植 app.js buildDerivedRoad：大眼仔 offset=1、小路 2、蟑螂路 3。
function buildDerivedRoad(bigGrid, offset, bigCols, bigRows) {
  const marks = [];
  for (let col = 0; col < bigCols; col++) {
    for (let row = 0; row < bigRows; row++) {
      if (!hasAt(bigGrid, col, row)) break;
      if (col < offset || (col === offset && row === 0)) continue;
      let mark;
      if (row === 0) {
        const hL1 = columnHeight(bigGrid, col - 1, bigRows);
        const hL2 = columnHeight(bigGrid, col - offset - 1, bigRows);
        mark = (hL1 === hL2) ? 'R' : 'B';
      } else {
        const a = hasAt(bigGrid, col - offset, row);
        const b = hasAt(bigGrid, col - offset, row - 1);
        mark = (a === b) ? 'R' : 'B';
      }
      marks.push(mark);
    }
  }
  return marks;
}
function layoutDerivedMarks(marks, rows) {
  rows = rows || 6;
  const grid = [];
  for (let r = 0; r < rows; r++) grid.push({});
  let curCol = -1, curRow = -1, curMark = null, maxCol = -1;
  for (const m of marks) {
    if (curCol < 0) {
      curCol = 0; curRow = 0; curMark = m;
    } else if (m === curMark) {
      let nr = curRow + 1;
      if (nr < rows && !grid[nr][curCol]) curRow = nr;
      else {
        let nc = curCol + 1;
        while (grid[curRow][nc]) nc++;
        curCol = nc;
      }
    } else {
      let nc = curCol + 1;
      while (grid[0][nc]) nc++;
      curCol = nc;
      curRow = 0;
      curMark = m;
    }
    grid[curRow][curCol] = m;
    if (curCol > maxCol) maxCol = curCol;
  }
  return { grid, cols: maxCol + 1, rows };
}
function derivedRunLengths(marks) {
  const runs = [];
  let last;
  for (const mark of marks) {
    if (mark === last) runs[runs.length - 1]++;
    else { runs.push(1); last = mark; }
  }
  return runs;
}
function scoreDerivedRoads(outcomes) {
  const big = buildBigRoadGrid(outcomes);
  const marks = {}, sequences = {}, result = { total: 0, redRatio: 0, marks, sequences };
  const all = [];
  for (const { key, offset } of DERIVED_ROADS) {
    const roadMarks = buildDerivedRoad(big.grid, offset, big.cols, big.rows);
    const redCount = roadMarks.filter(mark => mark === 'R').length;
    marks[key] = roadMarks;
    sequences[key] = derivedRunLengths(roadMarks);
    result[key] = { redRatio: roadMarks.length ? redCount / roadMarks.length : 0 };
    all.push(...roadMarks);
  }
  const redCount = all.filter(mark => mark === 'R').length;
  result.redRatio = all.length ? redCount / all.length : 0;
  // 三條路合併只扣偏紅。少於 10 顆或未超過門檻都不扣，避免同一現象重複計分。
  if (all.length >= 10 && result.redRatio > WEIGHTS.derivedRedBase) {
    result.total = (result.redRatio - WEIGHTS.derivedRedBase) * 10 * WEIGHTS.derivedRed;
  }
  return result;
}

function scoreWithCaps(runs, firstSide, opts, regular = scoreRoad(outcomesFromRuns(runs, firstSide))) {
  const caps = scoreCapExcess(runs, firstSide, opts);
  const result = { ...regular, total: regular.total + caps.total, regularTotal: regular.total,
    capTotal: caps.total, capScores: caps };
  const mode = opts && opts.scoreMode;
  if (opts && !opts.randomMode && (mode === 'derived' || mode === 'both')) {
    const derived = scoreDerivedRoads(outcomesFromRuns(runs, firstSide));
    result.bigEye = derived.bigEye;
    result.smallRoad = derived.smallRoad;
    result.cockroachRoad = derived.cockroachRoad;
    result.derivedTotal = derived.total;
    result.derivedRedRatio = derived.redRatio;
    result.derivedMarks = derived.marks;
    result.derivedSequences = derived.sequences;
    result.scoreMode = mode;
    result.total = (mode === 'both' ? regular.total : 0) + derived.total + caps.total;
  }
  return result;
}

function getRoadHighlights(runs, firstSide = '莊', opts = {}) {
  const highlights = runs.map(() => []);
  if (opts.randomMode) return highlights;
  const capReasons = getViolationColumns(runs, firstSide, opts);
  const capDetails = scoreCapExcess(runs, firstSide, opts).details;
  for (let i = 0; i < runs.length; i++) for (const reason of capReasons[i]) {
    const detail = capDetails.find(item => reason.startsWith(`${item.label}：`) &&
      reason.includes(`${item.length}${item.kind === 'line' ? '顆欄' : '欄的'}`));
    const kind = detail?.kind || (reason.startsWith('同長洞') ? 'hole' : reason.startsWith('同長柱') ? 'pillar' : 'line');
    highlights[i].push({ kind, type: 'cap', text: `上限違規：${reason}（整組+${detail?.points ?? 0}分）` });
  }
  const groups = { red: [], blue: [], greenBanker: [], greenPlayer: [] };
  let previous = '';
  runs.forEach((length, i) => {
    const key = length === 1 ? 'red' : 'blue';
    if (key === previous) groups[key][groups[key].length - 1].push(i);
    else groups[key].push([i]);
    if (length >= 2) {
      const side = (i % 2 === 0) === (firstSide === '莊') ? 'greenBanker' : 'greenPlayer';
      groups[side].push([i]);
    }
    previous = key;
  });
  const score = scoreRoad(outcomesFromRuns(runs, firstSide), true);
  for (const [key, kind, label] of [['red', 'hole', '洞'], ['blue', 'pillar', '柱'],
    ['greenBanker', 'line', '行莊'], ['greenPlayer', 'line', '行閒']]) {
    for (const hit of score[key].hits) {
      const text = `規律計分·${label}：${hit.label}（+${Number(hit.points.toFixed(2))}分）`;
      for (const sequenceIndex of hit.indices) for (const runIndex of groups[key][sequenceIndex]) {
        if (!highlights[runIndex].some(item => item.type === 'score' && item.text === text)) {
          highlights[runIndex].push({ kind, type: 'score', text });
        }
      }
    }
  }
  return highlights;
}

function migrateScoreMode(saved) {
  if (saved && typeof saved === 'object' && !Array.isArray(saved) && Object.hasOwn(saved, 'scoreMode')) {
    return saved.scoreMode;
  }
  return saved && saved.scoreDerived === true ? 'both' : 'big';
}

function normalizeOptions(options = {}) {
  const o = { ...DEFAULTS, ...options };
  if (!Object.hasOwn(options, 'scoreMode') && options.scoreDerived === true) o.scoreMode = 'both';
  const labels = { count: '條數', rounds: '局數', maxDifference: '莊閒差上限', maxRun: '長龍上限',
    startNumber: '起始編號', attempts: '每條嘗試次數', hillSteps: '爬山步數',
    perSideMax: '單邊同長度行上限', combinedMax: '莊閒合計同長度行上限' };
  for (const [key, min, max] of [['count', 1, 100], ['rounds', 1, 1000], ['maxDifference', 0, 1000],
    ['maxRun', 1, 1000], ['startNumber', 0, 1000000], ['attempts', 1, 100000], ['hillSteps', 0, 100000]]) {
    if (!Number.isInteger(o[key]) || o[key] < min || o[key] > max) throw new Error(`${labels[key]}必須是 ${min}～${max} 的整數。`);
  }
  if (typeof o.randomMode !== 'boolean') throw new Error('隨機模式必須為布林值。');
  if (o.scoreMode !== 'big' && o.scoreMode !== 'derived' && o.scoreMode !== 'both') {
    throw new Error('評分範圍必須是 big、derived 或 both。');
  }
  if (!o.randomMode) for (const key of ['perSideMax', 'combinedMax']) {
    if (o[key] !== '' && (!Number.isInteger(o[key]) || o[key] < 0 || o[key] > 1000)) {
      throw new Error(`${labels[key]}必須留白或填入 0～1000 的整數。`);
    }
  }
  if (!o.randomMode && typeof o.includeSingles !== 'boolean') throw new Error('單顆行也算必須為布林值。');
  if (!o.randomMode) for (const [key, label] of [['holeMax', '洞'], ['pillarMax', '柱']]) {
    if (o[key] !== '' && (!Number.isInteger(o[key]) || o[key] < 0 || o[key] > 1000)) {
      throw new Error(`同長度${label}上限必須留白或填入 0～1000 的整數。`);
    }
  }
  if (!o.randomMode && o.maxHoleLength !== '' && (!Number.isInteger(o.maxHoleLength) || o.maxHoleLength < 0 || o.maxHoleLength > 1000)) {
    throw new Error('洞最長必須留白或填入 0～1000 的整數。');
  }
  if (o.rounds % 2 > o.maxDifference) throw new Error('奇數局至少有 1 局莊閒差，請調整局數或莊閒差上限。');
  o.prefix = String(o.prefix).trim();
  if (!o.prefix) throw new Error('請填寫名稱前綴。');
  o.seed = String(o.seed);
  return o;
}

function createRng(seed) {
  if (seed === '' || seed === undefined || seed === null) return Math.random;
  let state = 2166136261;
  for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return function () {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function outcomesFromRuns(runs, first) {
  const values = [];
  runs.forEach((n, i) => { for (let j = 0; j < n; j++) values.push(i % 2 ? (first === '莊' ? '閒' : '莊') : first); });
  return values;
}
function allowedHoleLength(runs, maxHoleLength) {
  if (maxHoleLength === '') return true;
  let length = 0;
  for (const run of runs) {
    length = run === 1 ? length + 1 : 0;
    if (length > maxHoleLength) return false;
  }
  return true;
}
function validRuns(runs, o) {
  return runs.length > 0 && runs.every(n => n >= 1 && n <= o.maxRun && Number.isInteger(n)) &&
    runs.reduce((a, n) => a + n, 0) === o.rounds &&
    Math.abs(runs.reduce((a, n, i) => a + (i % 2 ? -n : n), 0)) <= o.maxDifference &&
    (o.randomMode || allowedHoleLength(runs, o.maxHoleLength));
}

function randomCandidate(o, rng) {
  const cap = Math.min(o.maxRun, o.rounds);
  const weights = Array.from({ length: cap }, (_, i) => [50, 25, 12, 7, 4, 2][i] || 2 * Math.pow(0.5, i - 5));
  const sum = weights.reduce((a, b) => a + b, 0);
  for (let retry = 0; retry < 100; retry++) {
    const runs = [];
    const counts = [{}, {}], total = {};
    let remaining = o.rounds;
    let holeLength = 0;
    while (remaining) {
      // 在抽樣時排除已用盡配額的長度，包含最後截短的欄。
      const side = counts[runs.length % 2];
      let available = o.randomMode ? weights : weights.map((weight, i) => {
        const n = Math.min(i + 1, remaining);
        if (n === 1 && o.maxHoleLength !== '' && holeLength >= o.maxHoleLength) return 0;
        return (n === 1 && !o.includeSingles) ||
          ((o.perSideMax === '' || (side[n] || 0) < o.perSideMax) &&
            (o.combinedMax === '' || (total[n] || 0) < o.combinedMax)) ? weight : 0;
      });
      // 配額不足時保留有界備選；roadSteps 會標示違規，不當成合格路。
      if (!available.some(Boolean)) available = weights;
      let draw = rng() * (available === weights ? sum : available.reduce((a, b) => a + b, 0)), length = cap;
      for (let i = 0; i < cap; i++) { draw -= available[i]; if (draw < 0) { length = i + 1; break; } }
      length = Math.min(length, remaining); runs.push(length); remaining -= length;
      holeLength = length === 1 ? holeLength + 1 : 0;
      side[length] = (side[length] || 0) + 1; total[length] = (total[length] || 0) + 1;
    }
    if (validRuns(runs, o)) return runs;
  }
  // 極窄硬條件的有界備援：從平衡局數逐局選可完成的分支。
  let b = Math.floor(o.rounds / 2), p = o.rounds - b, last = '', streak = 0;
  const values = [];
  while (b + p) {
    const choices = ['莊', '閒'].filter(side => {
      if ((side === '莊' ? b : p) === 0 || (side === last && streak >= cap)) return false;
      const nb = b - (side === '莊' ? 1 : 0), np = p - (side === '閒' ? 1 : 0);
      const nextStreak = side === last ? streak + 1 : 1;
      return nb <= (np + 1) * cap - (side === '莊' ? nextStreak : 0) &&
        np <= (nb + 1) * cap - (side === '閒' ? nextStreak : 0);
    });
    if (!choices.length) throw new Error('無法建立符合條件的路單。');
    const side = choices[Math.floor(rng() * choices.length)];
    streak = side === last ? streak + 1 : 1; last = side;
    values.push(side); if (side === '莊') b--; else p--;
  }
  const fallback = toRuns(values);
  if (!validRuns(fallback, o)) throw new Error(o.maxHoleLength === '' ? '無法建立符合條件的路單。' :
    '目前設定下找不到符合洞最長上限的路單，請放寬條件。');
  return fallback;
}

function mutate(runs, rng) {
  const next = runs.slice(), index = Math.floor(rng() * next.length);
  switch (Math.floor(rng() * 4)) {
    case 0: if (index + 1 < next.length) [next[index], next[index + 1]] = [next[index + 1], next[index]]; break;
    case 1: if (next[index] > 1) { const cut = 1 + Math.floor(rng() * (next[index] - 1)); next.splice(index, 1, cut, next[index] - cut); } break;
    case 2: if (index + 1 < next.length) next.splice(index, 2, next[index] + next[index + 1]); break;
    case 3: { const other = Math.floor(rng() * next.length); if (other !== index && next[other] > 1) { next[index]++; next[other]--; } break; }
  }
  return next;
}


// 同側交換包含單顆欄；亦可在同側兩欄間移動一顆，兩側局數均不變。
function* sameSideNeighbors(runs, maxRun) {
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 2; j < runs.length; j += 2) {
      if (runs[i] === runs[j]) continue;
      const next = runs.slice();
      [next[i], next[j]] = [next[j], next[i]];
      yield next;
    }
  }
  for (let i = 0; i < runs.length; i++) {
    if (runs[i] <= 1) continue;
    for (let j = i % 2; j < runs.length; j += 2) {
      if (i === j || runs[j] >= maxRun || runs[i] === runs[j] + 1) continue; // 與交換相同的候選不重算
      const next = runs.slice(); next[i]--; next[j]++;
      yield next;
    }
  }
}

function* improveSameSideSteps(runs, firstSide, options) {
  if (options.randomMode) return runs;
  const maxChecks = 8000, maxImprovements = 6, beamWidth = 8, epsilon = 1e-9;
  let checks = 0;
  const evaluate = candidate => ({ runs: candidate, score: scoreWithCaps(candidate, firstSide, options),
    violations: checkLengthCaps(candidate, firstSide, options).violations.length +
      checkHoleCaps(candidate, options).violations.length + checkPillarCaps(candidate, options).violations.length });
  let best = evaluate(runs.slice());
  for (let round = 0; round < maxImprovements && checks < maxChecks && best.score.total > epsilon; round++) {
    const origin = best, seen = new Set([origin.runs.join(',')]), plateau = [];
    let improved = null;
    function* inspect(state, rememberPlateau) {
      for (const next of sameSideNeighbors(state.runs, options.maxRun)) {
        if (checks >= maxChecks) break;
        const key = next.join(',');
        if (seen.has(key)) continue;
        seen.add(key); checks++;
        if (checks % 100 === 0) yield checks / maxChecks;
        if (!validRuns(next, options)) continue;
        const candidate = evaluate(next);
        // 中間步不可增加超限，但可暫存稍高的規律分，供第二步走出局部低點。
        // 這些暫存結果不會輸出；完整一步或兩步的結果都必須嚴格降分才採用。
        if (candidate.violations > origin.violations || candidate.score.capTotal > origin.score.capTotal + epsilon) continue;
        if (candidate.score.total < origin.score.total - epsilon) {
          if (!improved || candidate.score.total < improved.score.total - epsilon) improved = candidate;
          if (candidate.score.total <= epsilon) return;
        } else if (rememberPlateau && plateau.length < beamWidth &&
          candidate.score.total <= origin.score.total + WEIGHTS.sameExtra + epsilon) plateau.push(candidate);
      }
    }
    yield* inspect(origin, true);
    if (!improved) {
      for (const state of plateau) {
        yield* inspect(state, false);
        if (improved?.score.total <= epsilon || checks >= maxChecks) break;
      }
    }
    if (!improved) break;
    best = improved;
  }
  return best.runs;
}

function improveSameSideRuns(runs, firstSide, options) {
  const iterator = improveSameSideSteps(runs, firstSide, options);
  let step;
  do { step = iterator.next(); } while (!step.done);
  return step.value;
}

// 同一個分步流程供 Node 同步執行與瀏覽器讓出畫面，保持種子結果一致。
function* roadSteps(options, rng) {
  const o = normalizeOptions(options);
  const first = rng() < 0.5 ? '莊' : '閒';
  let best;
  if (o.randomMode) {
    best = randomCandidate(o, rng);
    yield 1;
  } else {
    let bestScore = Infinity, bestViolations = Infinity;
    const steps = o.attempts + o.hillSteps;
    for (let i = 0; i < steps; i++) {
      const runs = i < o.attempts ? randomCandidate(o, rng) : mutate(best, rng);
      if (validRuns(runs, o)) {
        const violations = checkLengthCaps(runs, first, o).violations.length +
          (o.holeMax === '' ? 0 : checkHoleCaps(runs, o).violations.length) +
          (o.pillarMax === '' ? 0 : checkPillarCaps(runs, o).violations.length);
        const score = scoreWithCaps(runs, first, o).total;
        // 合格路永遠優先。尚無合格路時，只保留已搜尋到違規項目最少的備選。
        if (violations < bestViolations || (violations === bestViolations && score <= bestScore)) {
          best = runs; bestScore = score; bestViolations = violations;
        }
      }
      if ((i + 1) % 25 === 0 || i + 1 === steps) yield 0.85 * (i + 1) / steps;
    }
  }
  if (!o.randomMode) {
    const optimizer = improveSameSideSteps(best, first, o);
    let step;
    do {
      step = optimizer.next();
      if (!step.done) yield 0.85 + 0.15 * step.value;
    } while (!step.done);
    best = step.value;
  }
  const nonTieOutcomes = outcomesFromRuns(best, first);
  const disabledCap = { enabled: false, ok: true, violations: [] };
  return { nonTieOutcomes, runs: best, sequences: getSequences(best, first),
    score: o.randomMode ? null : scoreWithCaps(best, first, o),
    violationColumns: getViolationColumns(best, first, o),
    highlightColumns: getRoadHighlights(best, first, o),
    columnLengths: countColumnLengths(best, first, o),
    holeLengths: countHoleLengths(best), pillarLengths: countPillarLengths(best),
    holeCaps: o.randomMode ? { ...disabledCap } : { enabled: o.holeMax !== '', ...checkHoleCaps(best, o) },
    pillarCaps: o.randomMode ? { ...disabledCap } : { enabled: o.pillarMax !== '', ...checkPillarCaps(best, o) },
    lengthCaps: o.randomMode ? { ...disabledCap } :
      { enabled: o.perSideMax !== '' || o.combinedMax !== '', ...checkLengthCaps(best, first, o) } };
}
function generateRoad(options = {}, rng) {
  const iterator = roadSteps(options, rng || createRng(options.seed));
  let result;
  do { result = iterator.next(); } while (!result.done);
  return result.value;
}
function prefixKey(road) { return road.nonTieOutcomes.slice(0, 20).join(''); }
function roadName(o, index) { return o.prefix + String(o.startNumber + index).padStart(2, '0'); }
function generateRoads(options = {}) {
  const o = normalizeOptions(options), rng = createRng(o.seed), roads = [], used = new Set();
  for (let i = 0; i < o.count; i++) {
    let accepted = false;
    for (let retry = 0; retry < 100; retry++) {
      const road = generateRoad(o, rng), key = prefixKey(road);
      if (used.has(key)) continue;
      used.add(key); roads.push({ name: roadName(o, i), ...road }); accepted = true; break;
    }
    if (!accepted) throw new Error('無法找到前20局不同的路單，請減少條數或放寬條件。');
  }
  return roads;
}
function toImportJson(roads) {
  return { roads: roads.map(road => {
    if (!road.nonTieOutcomes || !road.nonTieOutcomes.length) throw new Error('無法匯出空路單。');
    toRuns(road.nonTieOutcomes);
    return { name: String(road.name), nonTieOutcomes: road.nonTieOutcomes.slice() };
  }) };
}

// UI 共用佈局；座標從 0 起算，保留原卡片的六列與長龍橫向延伸規則。
function roadLayout(road) {
  const cells = [];
  let columns = 0;
  road.runs.forEach((length, i) => {
    const side = i % 2 ? (road.nonTieOutcomes[0] === '莊' ? '閒' : '莊') : road.nonTieOutcomes[0];
    for (let j = 0; j < length; j++) {
      cells.push({ row: Math.min(j, 5), col: columns + Math.max(0, j - 5), side, runIndex: i });
    }
    columns += Math.max(1, length - 5);
  });
  return { columns, rows: 6, cells };
}

function roadCounts(road) {
  const b = road.nonTieOutcomes.filter(n => n === '莊').length;
  return `莊${b} / 閒${road.nonTieOutcomes.length - b} · ${road.nonTieOutcomes.length}局`;
}

function roadmapImageLayout(roads, { cell = 26, gap = 24, padding = 24, titleHeight = 32, minWidth = 240 } = {}) {
  let y = padding;
  const entries = roads.map(road => {
    const layout = roadLayout(road);
    const gridWidth = layout.columns * cell, gridHeight = layout.rows * cell;
    const entry = { ...layout, highlightColumns: road.highlightColumns || [], title: roadCounts(road), x: padding, y, gridY: y + titleHeight,
      gridWidth, gridHeight, width: Math.max(minWidth, gridWidth), height: titleHeight + gridHeight };
    y += entry.height + gap;
    return entry;
  });
  return { entries, cell, gap, padding, titleHeight,
    width: 2 * padding + entries.reduce((max, entry) => Math.max(max, entry.width), 0),
    height: y + padding - (entries.length ? gap : 0) };
}

function drawRoadmapImage(canvas, roads, scale = 2) {
  const layout = roadmapImageLayout(roads);
  canvas.width = Math.ceil(layout.width * scale);
  canvas.height = Math.ceil(layout.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立圖片畫布');
  const styles = typeof getComputedStyle === 'function' ? getComputedStyle(canvas.ownerDocument.documentElement) : null;
  const ink = styles?.getPropertyValue('--ink').trim() || '#07090b';
  const txt = styles?.getPropertyValue('--txt').trim() || '#e8e4d8';
  const gold = styles?.getPropertyValue('--gold-3').trim() || '#a67c35';
  ctx.scale(scale, scale);
  ctx.fillStyle = ink; ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.font = '15px "Noto Sans TC", sans-serif'; ctx.textBaseline = 'top';
  for (const entry of layout.entries) {
    ctx.fillStyle = txt; ctx.fillText(entry.title, entry.x, entry.y);
    ctx.fillStyle = '#0a100f'; ctx.fillRect(entry.x, entry.gridY, entry.gridWidth, entry.gridHeight);
    ctx.strokeStyle = '#2c3634'; ctx.lineWidth = 1; ctx.beginPath();
    for (let col = 0; col <= entry.columns; col++) {
      const x = entry.x + col * layout.cell;
      ctx.moveTo(x, entry.gridY); ctx.lineTo(x, entry.gridY + entry.gridHeight);
    }
    for (let row = 0; row <= entry.rows; row++) {
      const y = entry.gridY + row * layout.cell;
      ctx.moveTo(entry.x, y); ctx.lineTo(entry.x + entry.gridWidth, y);
    }
    ctx.stroke(); ctx.strokeStyle = gold;
    ctx.strokeRect(entry.x, entry.gridY, entry.gridWidth, entry.gridHeight);
    ctx.lineWidth = 2;
    for (const { row, col, side, runIndex } of entry.cells) {
      const kinds = highlightKinds(entry.highlightColumns[runIndex] || []);
      if (kinds.length) {
        const x = entry.x + col * layout.cell, y = entry.gridY + row * layout.cell;
        kinds.forEach((kind, i) => {
          ctx.fillStyle = HIGHLIGHT_COLORS[kind].fill;
          ctx.fillRect(x + 1 + i * (layout.cell - 2) / kinds.length, y + 1,
            (layout.cell - 2) / kinds.length, layout.cell - 2);
        });
        ctx.strokeStyle = HIGHLIGHT_COLORS[kinds[0]].stroke;
        ctx.strokeRect(x + 1, y + 1, layout.cell - 2, layout.cell - 2);
      }
      ctx.strokeStyle = side === '莊' ? '#ff6576' : '#68aaff';
      ctx.beginPath();
      ctx.arc(entry.x + (col + .5) * layout.cell, entry.gridY + (row + .5) * layout.cell, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  return layout;
}

function initUI() {
  const form = document.getElementById('settings'), results = document.getElementById('results');
  const status = document.getElementById('status'), progress = document.getElementById('progress');
  const download = document.getElementById('download');
  const roadmapImage = document.getElementById('roadmap-image'), roadmapDialog = document.getElementById('roadmap-dialog');
  const roadmapContent = document.getElementById('roadmap-content'), roadmapCopy = document.getElementById('roadmap-copy');
  const roadmapStatus = document.getElementById('roadmap-status');
  let roads = [], generatedOptions, busy = false, rerollNumber = 0;
  const randomModeInput = form.elements.namedItem('randomMode');
  const randomFields = ['perSideMax', 'combinedMax', 'holeMax', 'pillarMax', 'maxHoleLength',
    'includeSingles', 'attempts', 'hillSteps', 'scoreMode'];
  const settingsKey = 'luanlu.settings.v1';
  function saveSettings() {
    const settings = {};
    for (const key of Object.keys(DEFAULTS)) {
      const field = form.elements.namedItem(key);
      settings[key] = typeof DEFAULTS[key] === 'boolean' ? field.checked : field.value;
    }
    try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch { /* 儲存不可用時仍可使用頁面 */ }
  }
  function restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(settingsKey));
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
      const migrated = { ...saved, scoreMode: migrateScoreMode(saved) };
      for (const key of Object.keys(DEFAULTS)) {
        if (!Object.hasOwn(migrated, key)) continue;
        const value = migrated[key], field = form.elements.namedItem(key);
        if (typeof DEFAULTS[key] === 'boolean') {
          if (typeof value === 'boolean') field.checked = value;
        } else if (typeof value === 'string') field.value = value;
      }
    } catch { /* 損壞或無法讀取時沿用頁面預設值 */ }
  }
  function syncRandomFields() {
    for (const key of randomFields) form.elements.namedItem(key).disabled = randomModeInput.checked;
  }
  restoreSettings();
  randomModeInput.addEventListener('change', syncRandomFields);
  syncRandomFields();
  form.addEventListener('input', saveSettings);
  form.addEventListener('change', saveSettings);
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  const element = (tag, className, text) => {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  };
  const setLengthCapText = (node, text) => {
    node.replaceChildren(...text.split(/(同長度行上限|洞|柱)/).flatMap(part => part === '同長度行上限'
      ? ['同長度', element('span', 'term-greenBanker', '行'), '上限'] :
      part === '洞' || part === '柱' ? [element('span', part === '洞' ? 'term-red' : 'term-blue', part)] : [part]));
    return node;
  };
  const points = n => Number(n.toFixed(2)).toString();
  const percent = ratio => `${Math.round((ratio || 0) * 100)}%`;
  const reasonText = reasons => reasons.length ? reasons.map(r => `${r.label}×${points(r.count)}（${points(r.points)}分）`).join('、') : '無規律扣分';
  function setBusy(value) {
    busy = value;
    form.querySelector('fieldset').disabled = value;
    results.querySelectorAll('button').forEach(button => { button.disabled = value; });
    download.disabled = value || !roads.length;
    roadmapImage.disabled = value || !roads.length;
    results.setAttribute('aria-busy', String(value));
  }
  function roadGrid(road) {
    const scroll = element('div', 'road-scroll'), grid = element('div', 'road-grid');
    const allReasons = [...new Set((road.highlightColumns || []).flat().map(item => item.text))];
    grid.setAttribute('role', 'img'); grid.setAttribute('aria-label', `大路欄長：${road.runs.join('、')}；首欄${road.nonTieOutcomes[0]}` +
      (allReasons.length ? `；標記：${allReasons.join('；')}` : ''));
    const layout = roadLayout(road);
    for (const { row, col, side, runIndex } of layout.cells) {
      const highlights = road.highlightColumns?.[runIndex] || [];
      const kinds = highlightKinds(highlights);
      const cell = element('span', `road-cell ${side === '莊' ? 'banker' : 'player'}${kinds.length ? ' highlighted' : ''}`);
      cell.style.gridRow = String(row + 1); cell.style.gridColumn = String(col + 1);
      if (kinds.length) {
        const colors = kinds.map(kind => HIGHLIGHT_COLORS[kind]);
        cell.style.background = `linear-gradient(90deg, ${colors.map((color, i) =>
          `${color.fill} ${i * 100 / colors.length}% ${(i + 1) * 100 / colors.length}%`).join(', ')})`;
        cell.style.outlineColor = colors[0].stroke;
        cell.title = highlights.map(item => item.text).join('；');
      }
      cell.append(element('i', '', '')); grid.append(cell);
    }
    grid.style.gridTemplateColumns = `repeat(${layout.columns}, 26px)`;
    scroll.append(grid); return scroll;
  }
  function render() {
    results.replaceChildren();
    roads.forEach((road, index) => {
      const card = element('article', 'road-card');
      const heading = element('div', 'card-heading'), title = element('div', '');
      title.append(element('h2', '', road.name));
      title.append(element('p', 'counts', roadCounts(road)));
      const derived = road.score?.derivedSequences ? {
        sequences: road.score.derivedSequences, redRatio: road.score.derivedRedRatio,
        total: road.score.derivedTotal, bigEye: road.score.bigEye,
        smallRoad: road.score.smallRoad, cockroachRoad: road.score.cockroachRoad
      } : scoreDerivedRoads(road.nonTieOutcomes);
      const mode = generatedOptions.scoreMode;
      const part = (included, label, value) => element('span', 'score-part', `${label} ${value}${included ? '' : '（未計入）'}`);
      const score = element('div', 'score', generatedOptions.randomMode ? '不評分' : points(road.score.total));
      const caption = element('small', '');
      if (generatedOptions.randomMode) caption.textContent = '隨機模式';
      else caption.append('總分：', part(mode !== 'derived', '規律', points(road.score.regularTotal)),
        ' ＋ ', part(mode !== 'big', '下三路偏紅', points(derived.total)),
        ' ＋ ', part(true, '超限', points(road.score.capTotal)));
      score.append(caption);
      heading.append(title, score); card.append(heading);
      card.append(roadGrid(road));
      if (generatedOptions.randomMode) {
        card.append(element('p', 'road-reasons', '隨機模式：行、洞、柱限制與規律評分已關閉。'));
      } else {
        const capDetails = road.score.capScores.details;
        const annotated = (messages, kind) => {
          const details = capDetails.filter(item => item.kind === kind);
          return messages.map((message, i) => `${message}（超出${details[i].excess}次，+${details[i].points}分）`).join('；');
        };
        card.append(setLengthCapText(element('p', road.lengthCaps.ok ? 'road-reasons' : 'length-violation'), !road.lengthCaps.enabled ? '同長度行上限：不限' :
          road.lengthCaps.ok ? '同長度行上限：全部合格' : `同長度行上限未通過（嘗試範圍內的最少違規備選）：${annotated(road.lengthCaps.violations, 'line')}`));
        for (const [key, label] of [['hole', '洞'], ['pillar', '柱']]) {
          const cap = road[`${key}Caps`];
          card.append(setLengthCapText(element('p', cap.ok ? 'road-reasons' : 'length-violation'),
            !cap.enabled ? `同長度${label}上限：不限` : cap.ok ? `同長度${label}上限：全部合格` :
              `同長度${label}上限未通過（嘗試範圍內的最少違規備選）：${annotated(cap.violations, key)}`));
        }
      }
      for (const [key, label] of [['red', '洞'], ['blue', '柱'], ['greenBanker', '行莊'], ['greenPlayer', '行閒']]) {
        const section = element('div', `sequence ${key}`);
        const title = `${label}：${road.sequences[key].join('、') || '無'}`;
        if (generatedOptions.randomMode) section.append(element('strong', '', title));
        else {
          const reasons = element('p', '');
          const suffix = mode === 'derived' ? '（未計入總分）' : '';
          reasons.append(element('span', `term-${key}`, `${label}：`), reasonText(road.score[key].reasons));
          section.append(element('strong', '', `${title}　／ ${points(road.score[key].total)}分${suffix}`), reasons);
        }
        card.append(section);
      }
      for (const { key, label } of DERIVED_ROADS) {
        const section = element('div', `sequence ${key}`);
        const seq = derived.sequences[key].join('、') || '無';
        section.append(element('strong', '', `${label}：${seq} ／ 紅 ${percent(derived[key].redRatio)}`));
        card.append(section);
      }
      if (!generatedOptions.randomMode) {
        const suffix = mode === 'big' ? '（未計入總分）' : '';
        card.append(element('p', 'road-reasons derived-summary',
          `下三路合計紅 ${percent(derived.redRatio)}，偏紅 ${points(derived.total)} 分${suffix}`));
      }
      const reroll = element('button', 'secondary', '重抽這條'); reroll.type = 'button';
      reroll.disabled = busy; reroll.addEventListener('click', () => run(index)); card.append(reroll);
      results.append(card);
    });
  }
  function readOptions() {
    const o = {};
    for (const key of Object.keys(DEFAULTS)) {
      const field = form.elements.namedItem(key);
      const value = field.value;
      o[key] = typeof DEFAULTS[key] === 'boolean' ? field.checked :
        key === 'prefix' || key === 'seed' || key === 'scoreMode' || (['perSideMax', 'combinedMax', 'holeMax', 'pillarMax', 'maxHoleLength'].includes(key) && value === '')
          ? value : Number(value);
    }
    return normalizeOptions(o);
  }
  async function run(index = null) {
    if (busy) return;
    try {
      const o = index === null ? readOptions() : generatedOptions;
      const rng = createRng(index === null ? o.seed : (o.seed === '' ? '' : `${o.seed}/重抽/${++rerollNumber}/${index}`));
      const next = index === null ? [] : roads.slice();
      const used = new Set(next.filter((_, i) => i !== index).map(prefixKey));
      setBusy(true); progress.value = 0; status.textContent = '準備產生…'; await pause();
      const count = index === null ? o.count : 1;
      for (let i = 0; i < count; i++) {
        let accepted = false;
        for (let retry = 0; retry < 100; retry++) {
          const iterator = roadSteps(o, rng);
          let step;
          do {
            step = iterator.next();
            if (!step.done) {
              progress.value = (i + step.value) / count;
              status.textContent = `產生第${i + 1}／${count}條 · ${Math.round(step.value * 100)}%${retry ? `（前20局重複，重試${retry}）` : ''}`;
              await pause();
            }
          } while (!step.done);
          const road = step.value, key = prefixKey(road);
          if (used.has(key)) continue;
          used.add(key);
          if (index === null) next.push({ name: roadName(o, i), ...road });
          else next[index] = { name: roads[index].name, ...road };
          accepted = true; break;
        }
        if (!accepted) throw new Error('無法找到前20局不同的路單，請減少條數或放寬條件。');
      }
      roads = next; generatedOptions = o; render(); progress.value = 1;
      const failed = roads.filter(road => !road.lengthCaps.ok || !road.holeCaps.ok || !road.pillarCaps.ok).length;
      setLengthCapText(status, `${o.randomMode ? '隨機模式' : ''}已完成${roads.length}條${failed ? `，其中${failed}條未通過長度上限，請查看卡片違規內容` : ''}，可下載 JSON。`);
    } catch (error) { setLengthCapText(status, `產生失敗：${error.message}`); }
    finally { setBusy(false); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); saveSettings(); run(); });
  roadmapImage.addEventListener('click', () => {
    if (busy || !roads.length) return;
    roadmapStatus.textContent = '';
    roadmapContent.replaceChildren(...roads.map(road => {
      const entry = element('section', 'roadmap-entry');
      entry.append(element('p', 'counts', roadCounts(road)), roadGrid(road));
      return entry;
    }));
    roadmapDialog.showModal(); roadmapContent.scrollTop = 0; roadmapContent.scrollLeft = 0;
  });
  document.getElementById('roadmap-close').addEventListener('click', () => roadmapDialog.close());
  roadmapCopy.addEventListener('click', async () => {
    roadmapCopy.disabled = true; roadmapStatus.textContent = '';
    try {
      const canvas = document.createElement('canvas');
      drawRoadmapImage(canvas, roads, Math.max(2, window.devicePixelRatio || 1));
      const blobPromise = new Promise((resolve, reject) => canvas.toBlob(blob =>
        blob ? resolve(blob) : reject(new Error('無法產生 PNG')), 'image/png'));
      // 立即啟動剪貼簿寫入，保留點擊的使用者啟用狀態；PNG 編碼完成後再交付。
      const blobReady = blobPromise.catch(() => null);
      let copied = false;
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
          copied = true;
        } catch { /* 權限或平台不支援時，使用同一張 PNG 下載。 */ }
      }
      const blob = await blobReady;
      if (!blob) throw new Error('無法產生 PNG');
      if (copied) roadmapStatus.textContent = '已複製';
      else {
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = '路單圖.png';
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        roadmapStatus.textContent = '無法複製，已改為下載 PNG';
      }
    } catch (error) { roadmapStatus.textContent = `圖片產生失敗：${error.message}`; }
    finally { roadmapCopy.disabled = false; }
  });
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(toImportJson(roads), null, 2)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = '目標路單.json';
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
  else initUI();
}
if (typeof module !== 'undefined') module.exports = { WEIGHTS, DEFAULTS, DERIVED_ROADS, toRuns, getSequences, countColumnLengths, checkLengthCaps,
  countHoleLengths, countPillarLengths, checkHoleCaps, checkPillarCaps, getViolationColumns,
  scoreSequence, scoreRoad, scoreCapExcess, scoreWithCaps, getRoadHighlights, improveSameSideRuns,
  migrateScoreMode,
  buildBigRoadGrid, buildDerivedRoad, layoutDerivedMarks, derivedRunLengths, scoreDerivedRoads,
  generateRoad, generateRoads, toImportJson, createRng,
  roadLayout, roadmapImageLayout, drawRoadmapImage };
