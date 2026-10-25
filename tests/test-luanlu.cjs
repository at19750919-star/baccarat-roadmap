'use strict';
const assert = require('node:assert/strict');
const { WEIGHTS, toRuns, getSequences, scoreSequence, scoreRoad, generateRoad,
  generateRoads, toImportJson, createRng } = require('../亂路/luanlu.js');

function outcomes(runs, first = '莊') {
  return runs.flatMap((length, i) => Array(length).fill(i % 2 ? (first === '莊' ? '閒' : '莊') : first));
}
function checkRoad(road, rounds = 82, difference = 4, maxRun = 6) {
  const values = road.nonTieOutcomes;
  assert.equal(values.length, rounds);
  assert(values.every(n => n === '莊' || n === '閒'));
  assert(Math.abs(values.filter(n => n === '莊').length * 2 - rounds) <= difference);
  assert(Math.max(...toRuns(values)) <= maxRun);
  assert.deepEqual(road.runs, toRuns(values));
  assert.deepEqual(road.sequences, getSequences(road.runs, values[0]));
  assert.deepEqual(road.score, scoreRoad(values));
}
// 複製參考匯入器的 token 及 nonTieOutcomes 判斷；不執行或改動排牌程式。
function normalizeOutcomeToken(token) {
  const s = String(token ?? '').trim().toUpperCase();
  if (s === 'B' || s === '莊' || s === 'BANKER') return '莊';
  if (s === 'P' || s === '閒' || s === '閑' || s === 'PLAYER') return '閒';
  if (s === 'T' || s === '和' || s === 'TIE') return '和';
  return null;
}
function normalizeRoadEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const nonTieOutcomes = Array.isArray(entry.nonTieOutcomes) && entry.nonTieOutcomes.length
    ? entry.nonTieOutcomes.map(normalizeOutcomeToken).filter(x => x === '莊' || x === '閒') : [];
  if (!nonTieOutcomes.length) return null;
  return { name: String(entry.name).trim(), nonTieOutcomes };
}

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`通過 ${passed}：${name}`); }

test('範例欄長的紅藍綠符合定義', () => {
  const runs = [1, 1, 3, 2, 1, 4, 2, 2, 1, 1, 1];
  assert.deepEqual(toRuns(outcomes(runs)), runs);
  assert.deepEqual(getSequences(runs), { red: [2, 1, 3], blue: [2, 3], greenBanker: [3, 2], greenPlayer: [2, 4, 2] });
  assert.deepEqual(getSequences(runs, '閒'), { red: [2, 1, 3], blue: [2, 3], greenBanker: [2, 4, 2], greenPlayer: [3, 2] });
  assert.deepEqual(getSequences([]), { red: [], blue: [], greenBanker: [], greenPlayer: [] });
});
test('規律計分與邊界逐項核對', () => {
  assert.equal(scoreSequence([]).total, 0);
  assert.equal(scoreSequence([2, 2]).total, WEIGHTS.adjacent);
  assert.equal(scoreSequence([2, 2, 2]).total, 2 * WEIGHTS.adjacent + WEIGHTS.sameExtra);
  assert.equal(scoreSequence([1, 2, 1, 2]).total, WEIGHTS.alternating + WEIGHTS.period);
  assert.equal(scoreSequence([1, 2, 1, 2, 1]).reasons.find(r => r.label === '交替').count, 2);
  assert.equal(scoreSequence([1, 2, 3, 4]).total, WEIGHTS.ordered);
  assert.equal(scoreSequence([4, 3, 2, 1, 2, 3]).total, 2 * WEIGHTS.ordered);
  assert.equal(scoreSequence([1, 3, 5, 1, 3, 5]).total, WEIGHTS.period);
  assert.equal(scoreSequence([2, 2, 2, 4]).reasons.find(r => r.label.startsWith('某數')).points, 7.5);
  assert.equal(scoreRoad(outcomes([1, 1, 1, 1])).road.total, WEIGHTS.longRed);
  assert.equal(scoreRoad(outcomes([2, 2, 2, 2, 2])).road.total, WEIGHTS.longBlue);
});

let roads;
test('固定種子產生20條，局數、莊閒差、長龍與前20局去重均通過', () => {
  roads = generateRoads({ count: 20, seed: 'Codex-驗收-20261026' });
  roads.forEach(road => checkRoad(road));
  assert.equal(new Set(roads.map(road => road.nonTieOutcomes.slice(0, 20).join(''))).size, 20);
  assert.equal(roads[0].name, '路單-AT01');
  assert.equal(roads[19].name, '路單-AT20');
});
test('同設定、同種子重跑20條完全相同', () => {
  assert.deepEqual(generateRoads({ count: 20, seed: 'Codex-驗收-20261026' }), roads);
  assert.deepEqual(generateRoad({ seed: '單條' }), generateRoad({ seed: '單條' }));
});
test('全單跳與連續雙顆的分數明顯高於產生結果', () => {
  const single = scoreRoad(outcomes(Array(82).fill(1))).total;
  const double = scoreRoad(outcomes(Array(41).fill(2))).total;
  for (const road of roads) {
    assert(single > road.score.total + 100);
    assert(double > road.score.total + 100);
  }
  console.log(`  規律路：全單跳 ${single}、連續雙顆 ${double}；產生路最高 ${Math.max(...roads.map(r => r.score.total)).toFixed(2)}`);
});
test('JSON往返後可通過參考匯入判斷，僅匯出名稱與莊閒', () => {
  const exported = JSON.parse(JSON.stringify(toImportJson(roads)));
  assert.deepEqual(Object.keys(exported), ['roads']);
  exported.roads.forEach((road, i) => {
    assert.deepEqual(Object.keys(road), ['name', 'nonTieOutcomes']);
    assert.deepEqual(normalizeRoadEntry(road), { name: roads[i].name, nonTieOutcomes: roads[i].nonTieOutcomes });
  });
  assert.deepEqual(normalizeRoadEntry({ name: '混合', nonTieOutcomes: ['B', 'P', '莊', '閒', 'T', '和', '?'] }).nonTieOutcomes, ['莊', '閒', '莊', '閒']);
  assert.equal(normalizeRoadEntry({ nonTieOutcomes: ['T', '?'] }), null);
  assert.throws(() => toImportJson([{ name: '空', nonTieOutcomes: [] }]), /空/);
  assert.throws(() => toImportJson([{ name: '和', nonTieOutcomes: ['和'] }]), /只能/);
});
test('爬山不增加規律分數，且仍符合硬條件', () => {
  const options = { seed: '爬山', attempts: 50, hillSteps: 0 };
  const before = generateRoad(options, createRng(options.seed));
  const after = generateRoad({ ...options, hillSteps: 500 }, createRng(options.seed));
  checkRoad(after); assert(after.score.total <= before.score.total);
});
test('自訂條件、編號及不可能條件有界處理', () => {
  const custom = generateRoads({ count: 3, rounds: 31, maxDifference: 1, maxRun: 3,
    attempts: 100, hillSteps: 100, seed: '自訂', prefix: '自訂-', startNumber: 9 });
  custom.forEach(road => checkRoad(road, 31, 1, 3));
  assert.deepEqual(custom.map(r => r.name), ['自訂-09', '自訂-10', '自訂-11']);
  checkRoad(generateRoad({ rounds: 1, maxDifference: 1, attempts: 1, hillSteps: 0, seed: '一局' }), 1, 1, 6);
  checkRoad(generateRoad({ rounds: 8, maxDifference: 0, maxRun: 1, attempts: 1, hillSteps: 20, seed: '全單跳' }), 8, 0, 1);
  assert.throws(() => generateRoads({ rounds: 81, maxDifference: 0 }), /奇數/);
  assert.throws(() => generateRoads({ rounds: 0 }), /整數/);
  assert.throws(() => generateRoads({ attempts: 0 }), /整數/);
  assert.throws(() => generateRoads({ count: 3, rounds: 1, maxDifference: 1, attempts: 1, hillSteps: 0, seed: '不足' }), /前20局/);
});
test('連續重抽不合格時，平衡備援仍產生符合硬條件的路單', () => {
  // 此亂數固定抽6顆欄，82局尾欄為4，莊閒差2；零差限制迫使走備援。
  checkRoad(generateRoad({ maxDifference: 0, attempts: 1, hillSteps: 0 }, () => 0.999), 82, 0, 6);
});
console.log(`全部 ${passed} 項測試通過。`);
