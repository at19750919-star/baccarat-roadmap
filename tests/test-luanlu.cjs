'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { WEIGHTS, DEFAULTS, DERIVED_ROADS, toRuns, getSequences, scoreSequence, scoreRoad, generateRoad,
  generateRoads, toImportJson, createRng, countColumnLengths, checkLengthCaps,
  countHoleLengths, countPillarLengths, checkHoleCaps, checkPillarCaps,
  getViolationColumns, getRoadHighlights, scoreCapExcess, scoreWithCaps,
  improveSameSideRuns, buildBigRoadGrid, buildDerivedRoad, layoutDerivedMarks,
  derivedRunLengths, scoreDerivedRoads, migrateScoreMode } = require('../亂路/luanlu.js');
const oldLuanlu = require('../亂路/備份-20261104/luanlu.js');

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
  if (road.score) {
    const regular = scoreRoad(values);
    for (const key of ['red', 'blue', 'greenBanker', 'greenPlayer']) assert.deepEqual(road.score[key], regular[key]);
    assert.equal(road.score.regularTotal, regular.total);
    const derivedTotal = road.score.derivedTotal || 0;
    const regularPart = road.score.scoreMode === 'derived' ? 0 : regular.total;
    assert.equal(road.score.total, regularPart + road.score.capTotal + derivedTotal);
  }
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
  assert.equal(scoreSequence([1, 2, 1, 2]).total, WEIGHTS.alternating);
  assert.equal(scoreSequence([1, 2, 1, 2, 1]).reasons.find(r => r.label === '交替').count, 2);
  assert.equal(scoreSequence([1, 2, 3, 4]).total, WEIGHTS.ordered);
  assert.equal(scoreSequence([4, 3, 2, 1, 2, 3]).total, 2 * WEIGHTS.ordered);
  assert.equal(scoreSequence([1, 3, 5, 1, 3, 5]).total, WEIGHTS.period);
  assert.equal(scoreSequence([2, 2, 2, 4]).reasons.find(r => r.label.startsWith('某數')).points, 7.5);
  const longHole = scoreRoad(outcomes([1, 1, 1, 1]));
  assert.equal(longHole.total, 0);
  assert.deepEqual(longHole.red, scoreSequence([4]));
  const longPillar = scoreRoad(outcomes([2, 2, 2, 2, 2, 2]));
  assert.equal(longPillar.total, longPillar.red.total + longPillar.blue.total +
    longPillar.greenBanker.total + longPillar.greenPlayer.total);
  assert.deepEqual(longPillar.blue, scoreSequence([6]));
});

test('兩數交替不重複計週期，三數週期與同數週期仍計分', () => {
  const abab = scoreSequence([1, 2, 1, 2], true);
  assert.equal(abab.reasons.find(r => r.label === '交替').count, 1);
  assert.equal(abab.reasons.find(r => r.label === '週期'), undefined);
  assert(abab.hits.some(hit => hit.label === '交替'));
  assert(!abab.hits.some(hit => hit.label === '週期'));
  assert.equal(scoreSequence([1, 2, 1, 2, 1]).reasons.find(r => r.label === '交替').count, 2);
  assert.equal(scoreSequence([1, 2, 1, 2, 1]).reasons.find(r => r.label === '週期'), undefined);
  assert.equal(scoreSequence([1, 2, 3, 1, 2, 3]).reasons.find(r => r.label === '週期').count, 1);
  assert.equal(scoreSequence([2, 2, 2, 2]).reasons.find(r => r.label === '週期').count, 1);
  const runs = [2, 2, 3, 2, 2, 2, 3];
  const road = scoreRoad(outcomes(runs));
  assert.equal(road.greenBanker.total, WEIGHTS.alternating);
  assert(!road.greenBanker.reasons.some(reason => reason.label === '週期'));
  const highlights = getRoadHighlights(runs, '莊', { perSideMax: '', combinedMax: '', holeMax: '', pillarMax: '' });
  for (const i of [0, 2, 4, 6]) {
    assert(highlights[i].some(item => item.kind === 'line' && item.text.includes('交替')));
    assert(!highlights[i].some(item => item.text.includes('週期')));
  }
});

test('計分命中位置保留原分數，並映射到行、洞、柱原始欄位', () => {
  for (const seq of [[2, 2, 2], [1, 2, 1, 2], [1, 2, 3, 4], [2, 2, 2, 4]]) {
    const plain = scoreSequence(seq), traced = scoreSequence(seq, true);
    assert.equal(traced.total, plain.total);
    assert(Math.abs(traced.hits.reduce((sum, hit) => sum + hit.points, 0) - plain.total) < 1e-9);
  }
  const opts = { perSideMax: 2, combinedMax: 3, holeMax: '', pillarMax: '' };
  assert.equal(scoreRoad(outcomes([2, 2, 2])).total, 3);
  const line = getRoadHighlights([2, 2, 2], '莊', opts);
  assert.deepEqual(line.map(items => items.map(item => item.kind)), [['line'], [], ['line']]);
  assert(line.flat().every(item => item.type === 'score' && item.text.includes('規律計分')));
  const hole = getRoadHighlights([1, 1, 2, 1, 1], '莊', opts);
  assert.deepEqual(hole.map(items => items.some(item => item.kind === 'hole')), [true, true, false, true, true]);
  const pillar = getRoadHighlights([2, 3, 1, 4, 5], '莊', opts);
  assert.deepEqual(pillar.map(items => items.some(item => item.kind === 'pillar')), [true, true, false, true, true]);
  const overlap = getRoadHighlights([2, 2, 1, 2, 2], '莊', { ...opts, combinedMax: 3 });
  for (const i of [0, 1, 3, 4]) {
    assert(overlap[i].some(item => item.kind === 'line' && item.type === 'cap'));
    assert(overlap[i].some(item => item.kind === 'pillar' && item.type === 'score'));
    assert(overlap[i].some(item => item.text.includes('上限違規') && item.text.includes('+1分')));
  }
  const capOnly = [1, 1, 1, 1];
  const strict = { perSideMax: '', combinedMax: '', holeMax: 0, pillarMax: '' };
  assert(getViolationColumns(capOnly, '莊', strict).some(items => items.length > 0));
  assert.equal(scoreRoad(outcomes(capOnly)).total, 0);
  assert(getRoadHighlights(capOnly, '莊', strict).every(items => items.some(item => item.type === 'cap' && item.kind === 'hole')));
  assert(getRoadHighlights([2, 2], '莊', opts).every(items => items.length === 0));
  assert(getRoadHighlights([2, 2, 2], '莊', { ...opts, randomMode: true }).every(items => items.length === 0));
});

test('超出上限逐次加分，總分含規律分與超限分', () => {
  const four = [2, 2, 6, 6, 7, 2, 2, 3, 5, 6, 4, 4];
  const onlyCombined = { perSideMax: '', combinedMax: 3, holeMax: '', pillarMax: '' };
  assert.equal(scoreRoad(outcomes(four)).total, 0);
  assert.equal(scoreCapExcess(four, '莊', onlyCombined).total, 1);
  assert.deepEqual([scoreWithCaps(four, '莊', onlyCombined).regularTotal,
    scoreWithCaps(four, '莊', onlyCombined).capTotal, scoreWithCaps(four, '莊', onlyCombined).total], [0, 1, 1]);
  assert.equal(scoreCapExcess([2, 2, 2, 2, 2, 2], '莊', onlyCombined).line, 3);
  const both = scoreCapExcess([2, 2, 2, 2], '莊', { perSideMax: 1, combinedMax: 3 });
  assert.equal(both.line, 3);
  assert.deepEqual(both.details.map(item => item.excess), [1, 1, 1]);
  const segments = scoreCapExcess([1, 2, 1, 3, 1], '莊',
    { perSideMax: '', combinedMax: '', holeMax: 1, pillarMax: 1 });
  assert.deepEqual([segments.hole, segments.pillar, segments.total], [2, 1, 3]);
  const segmentHighlights = getRoadHighlights([1, 2, 1, 3, 1], '莊',
    { perSideMax: '', combinedMax: '', holeMax: 1, pillarMax: 1 });
  assert(segmentHighlights[0].some(item => item.kind === 'hole' && item.type === 'cap' && item.text.includes('整組+2分')));
  assert(segmentHighlights[1].some(item => item.kind === 'pillar' && item.type === 'cap' && item.text.includes('整組+1分')));
  const mixed = [2, 2, 1, 2, 2], mixedScore = scoreWithCaps(mixed, '莊', onlyCombined);
  assert.equal(mixedScore.capTotal, 1);
  assert.equal(mixedScore.total, scoreRoad(outcomes(mixed)).total + 1);
  assert.equal(scoreCapExcess(mixed, '莊', { ...onlyCombined, randomMode: true }).total, 0);
  assert(getRoadHighlights(mixed, '莊', { ...onlyCombined, randomMode: true }).every(items => items.length === 0));
  const generated = generateRoad({ rounds: 8, maxRun: 1, maxDifference: 0,
    includeSingles: true, attempts: 1, hillSteps: 0, seed: 1 });
  assert.equal(generated.score.regularTotal, 0);
  assert.equal(generated.score.capTotal, 9);
  assert.equal(generated.score.total, 9);
  assert(generated.highlightColumns.every(items => items.some(item => item.type === 'cap')));
});

test('同長度統計排除單跳、依首欄分邊，包含不相鄰的同長度欄', () => {
  const runs = [1, 1, 3, 2, 1, 4, 2, 2, 1, 1, 1];
  assert.deepEqual(countColumnLengths(runs, '莊'), {
    banker: { 2: 1, 3: 1 }, player: { 2: 2, 4: 1 }, total: { 2: 3, 3: 1, 4: 1 }
  });
  assert.deepEqual(countColumnLengths(runs, '閒'), {
    banker: { 2: 2, 4: 1 }, player: { 2: 1, 3: 1 }, total: { 2: 3, 3: 1, 4: 1 }
  });
  assert.deepEqual(countColumnLengths([]), { banker: {}, player: {}, total: {} });
  assert.deepEqual(checkLengthCaps(runs, '莊'), { ok: true, violations: [] });
  assert.equal(countColumnLengths(runs, '莊', { includeSingles: true }).total[1], 6);
});
test('單邊、合計各自檢查；可調上限、單跳及邊界皆正確', () => {
  const side = checkLengthCaps([2, 1, 2, 1, 2], '莊');
  assert.equal(side.ok, false); assert.equal(side.violations.length, 1);
  assert.match(side.violations[0], /莊 2顆欄有 3 欄/);
  const total = checkLengthCaps([2, 2, 2, 2], '閒');
  assert.equal(total.violations.length, 1); assert.match(total.violations[0], /合計/);
  assert.equal(checkLengthCaps([2, 2, 2, 2], '莊', { combinedMax: 4 }).ok, true);
  assert.equal(checkLengthCaps([2, 1, 2, 1, 2], '閒', { perSideMax: 3 }).ok, true);
  assert.equal(checkLengthCaps([1, 1, 1, 1]).ok, true);
  assert.equal(checkLengthCaps([1, 1, 1, 1], '莊', { includeSingles: true }).ok, false);
  assert.equal(checkLengthCaps([1, 1, 1], '莊', { includeSingles: true }).ok, true);
});
test('單邊或合計留白時，該項不限，另一項仍照設定檢查', () => {
  const runs = [2, 2, 2, 2, 2, 2];
  assert.deepEqual(checkLengthCaps(runs, '莊', { perSideMax: '', combinedMax: '' }), { ok: true, violations: [] });
  assert.equal(checkLengthCaps(runs, '莊', { perSideMax: '', combinedMax: 3 }).violations.length, 1);
  assert.equal(checkLengthCaps(runs, '莊', { perSideMax: 2, combinedMax: '' }).violations.length, 2);
  const road = generateRoad({ rounds: 8, maxRun: 1, maxDifference: 0, includeSingles: true,
    perSideMax: '', combinedMax: '', attempts: 2, hillSteps: 20, seed: 1 });
  assert.deepEqual(road.lengthCaps, { enabled: false, ok: true, violations: [] });
});
test('洞最長留空不限，填 1 或 4 約束所有輸出，無解時明確失敗', () => {
  const longestHole = runs => Math.max(0, ...getSequences(runs).red);
  const base = { count: 3, rounds: 20, maxDifference: 2, maxRun: 6,
    includeSingles: false, attempts: 100, hillSteps: 50, seed: '洞最長' };
  assert.deepEqual(generateRoads({ ...base, maxHoleLength: '' }), generateRoads(base));
  const unrestricted = generateRoad({ ...base, rounds: 8, maxRun: 1, maxDifference: 0,
    maxHoleLength: '', attempts: 2, hillSteps: 0 });
  assert.equal(longestHole(unrestricted.runs), 8);
  for (const maxHoleLength of [1, 4]) {
    for (const seed of ['洞最長', 1, 2, 3]) {
      const roads = generateRoads({ ...base, maxHoleLength, seed });
      assert.equal(roads.length, 3);
      roads.forEach(road => {
        checkRoad(road, 20, 2, 6);
        assert(longestHole(road.runs) <= maxHoleLength);
      });
    }
  }
  assert.throws(() => generateRoad({ ...base, maxHoleLength: -1 }), /洞最長/);
  assert.throws(() => generateRoad({ ...base, rounds: 8, maxRun: 1, maxDifference: 0,
    maxHoleLength: 4, attempts: 2, hillSteps: 0 }), /洞最長/);
});
test('隨機模式忽略行洞柱限制和評分，但保留基本條件與種子', () => {
  const options = { randomMode: true, rounds: 8, maxRun: 1, maxDifference: 0,
    perSideMax: 0, combinedMax: 0, includeSingles: true, holeMax: 0, pillarMax: 0,
    maxHoleLength: 0, attempts: 1, hillSteps: 0, seed: '隨機' };
  const road = generateRoad(options);
  assert.equal(road.nonTieOutcomes.length, 8);
  assert(road.runs.every(n => n === 1));
  assert.equal(road.score, null);
  assert(road.violationColumns.every(items => items.length === 0));
  for (const key of ['lengthCaps', 'holeCaps', 'pillarCaps']) {
    assert.deepEqual(road[key], { enabled: false, ok: true, violations: [] });
  }
  assert.deepEqual(generateRoad(options), road);
  assert.deepEqual(generateRoad({ ...options, attempts: 3000, hillSteps: 2000 }), road);
  assert.throws(() => generateRoad({ ...options, randomMode: false }), /洞最長/);
  assert.throws(() => generateRoad({ ...options, maxDifference: -1 }), /莊閒差/);
  assert.throws(() => generateRoad({ ...options, randomMode: 'true' }), /隨機/);
  const seeded = { randomMode: true, count: 3, rounds: 20, maxRun: 4,
    maxDifference: 2, perSideMax: 0, combinedMax: 0, holeMax: 0,
    pillarMax: 0, maxHoleLength: 0, seed: '可重現' };
  const roads = generateRoads(seeded);
  assert.deepEqual(generateRoads(seeded), roads);
  assert.deepEqual(generateRoads({ ...seeded, perSideMax: '', combinedMax: '',
    holeMax: '', pillarMax: '', maxHoleLength: '' }), roads);
  assert(roads.some(item => item.runs.some(n => n > 1)));
  roads.forEach(item => {
    assert.equal(item.nonTieOutcomes.length, 20);
    assert(Math.max(...item.runs) <= 4);
    assert(Math.abs(item.nonTieOutcomes.filter(x => x === '莊').length * 2 - 20) <= 2);
    assert.equal(item.score, null);
  });
});
test('違規位置供文字說明，同長整組與重疊原因仍正確', () => {
  const runs = [2, 1, 2, 1, 2];
  const reasons = getViolationColumns(runs, '莊', {
    perSideMax: 2, combinedMax: 2, holeMax: 1, pillarMax: 2 });
  assert.deepEqual(reasons.map(items => items.length), [3, 1, 3, 1, 3]);
  for (const i of [0, 2, 4]) {
    assert(reasons[i].some(text => text.includes('單邊行')));
    assert(reasons[i].some(text => text.includes('合計行')));
    assert(reasons[i].some(text => text.includes('同長柱')));
  }
  for (const i of [1, 3]) assert(reasons[i].some(text => text.includes('同長洞')));
  const playerSide = getViolationColumns(runs, '閒', { perSideMax: 2, combinedMax: '' });
  assert([0, 2, 4].every(i => playerSide[i].some(text => text.includes('閒單邊行'))));
  const pillars = getViolationColumns([2, 2, 1, 2, 2], '莊', {
    perSideMax: '', combinedMax: '', holeMax: '', pillarMax: 1 });
  assert.deepEqual(pillars.map(items => items.length), [1, 1, 0, 1, 1]);
  assert(getViolationColumns(runs, '莊', { randomMode: true, perSideMax: 0,
    combinedMax: 0, holeMax: 0, pillarMax: 0 }).every(items => items.length === 0));
  assert(getViolationColumns(runs, '莊', { perSideMax: 5, combinedMax: 5,
    holeMax: 5, pillarMax: 5 }).every(items => items.length === 0));
  const road = generateRoad({ rounds: 8, maxRun: 1, maxDifference: 0,
    includeSingles: true, attempts: 2, hillSteps: 0, seed: 1 });
  assert(road.violationColumns.every(items => items.length > 0));
  assert(road.highlightColumns.every(items => items.some(item => item.type === 'cap')));
  assert(generateRoad({ seed: 1 }).violationColumns.every(items => items.length === 0));
});

let roads;
test('種子1產生20條，局數、莊閒差、長龍、同長度上限與前20局去重均通過', () => {
  roads = generateRoads({ count: 20, seed: 1 });
  roads.forEach(road => {
    checkRoad(road);
    assert.equal(checkLengthCaps(road.runs, road.nonTieOutcomes[0]).ok, true);
    assert.deepEqual(road.columnLengths, countColumnLengths(road.runs, road.nonTieOutcomes[0]));
    assert.deepEqual(road.lengthCaps, { enabled: true, ok: true, violations: [] });
  });
  assert.equal(new Set(roads.map(road => road.nonTieOutcomes.slice(0, 20).join(''))).size, 20);
  assert.equal(roads[0].name, '路單-AT01');
  assert.equal(roads[19].name, '路單-AT20');
});
test('同設定、同種子重跑20條完全相同', () => {
  assert.deepEqual(generateRoads({ count: 20, seed: 1 }), roads);
  assert.deepEqual(generateRoad({ seed: '單條' }), generateRoad({ seed: '單條' }));
});
test('全單跳無額外長段評分；連續雙顆仍因行規律而加分', () => {
  const single = scoreRoad(outcomes(Array(82).fill(1))).total;
  const double = scoreRoad(outcomes(Array(41).fill(2))).total;
  assert.equal(single, 0);
  for (const road of roads) {
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
test('爬山與產出前交換不增加總分，且仍符合硬條件', () => {
  const options = { seed: '爬山', attempts: 50, hillSteps: 0 };
  const before = generateRoad(options, createRng(options.seed));
  const after = generateRoad({ ...options, hillSteps: 500 }, createRng(options.seed));
  checkRoad(before); checkRoad(after);
  assert(after.score.total <= before.score.total + 1e-9);
  assert.equal(before.lengthCaps.ok, true); assert.equal(after.lengthCaps.ok, true);
});
test('產出前同側交換只接受總分下降，並保留局數、兩側局數及各項限制', () => {
  const runs = [2, 4, 2, 2, 2, 3, 2, 2, 2, 5, 2, 6, 2, 6, 2, 4];
  const options = { rounds: 48, maxRun: 6, maxDifference: 16, maxHoleLength: '',
    perSideMax: '', combinedMax: '', holeMax: '', pillarMax: '' };
  const before = scoreWithCaps(runs, '莊', options), improved = improveSameSideRuns(runs, '莊', options);
  const after = scoreWithCaps(improved, '莊', options);
  assert.equal(scoreRoad(outcomes(runs)).greenPlayer.total, 3);
  assert.equal(scoreRoad(outcomes(improved)).greenPlayer.total, 0);
  assert(after.total < before.total);
  assert(after.capTotal <= before.capTotal);
  for (const side of [0, 1]) assert.equal(improved.filter((_, i) => i % 2 === side).reduce((a, b) => a + b, 0),
    runs.filter((_, i) => i % 2 === side).reduce((a, b) => a + b, 0));
  assert(improved.every(n => Number.isInteger(n) && n >= 1 && n <= options.maxRun));
  assert.deepEqual(improveSameSideRuns(runs, '莊', options), improved);
  assert.deepEqual(improveSameSideRuns(runs, '莊', { ...options, randomMode: true }), runs);
  // 同側都是2顆時，光交換不會改善；同側移動一顆可消除相鄰重複。
  const transfer = [2, 3, 2, 4], transferOptions = { ...options, rounds: 11, maxDifference: 3 };
  assert.equal(scoreWithCaps(transfer, '莊', transferOptions).total, 3);
  const transferred = improveSameSideRuns(transfer, '莊', transferOptions);
  assert.equal(scoreWithCaps(transferred, '莊', transferOptions).total, 0);
  assert.equal(transferred[0] + transferred[2], 4);
  assert.equal(transferred[1] + transferred[3], 7);
  const stable = [2, 3], stableOptions = { ...options, rounds: 5, maxDifference: 1 };
  assert.deepEqual(improveSameSideRuns(stable, '莊', stableOptions), stable);
  const holes = [1, 2, 1, 3, 1, 2, 1, 4];
  const holeOptions = { ...options, rounds: 15, maxDifference: 9, maxHoleLength: 1 };
  const holeResult = improveSameSideRuns(holes, '莊', holeOptions);
  assert(Math.max(0, ...getSequences(holeResult).red) <= 1);
  assert(scoreWithCaps(holeResult, '莊', holeOptions).total <= scoreWithCaps(holes, '莊', holeOptions).total);
});
test('完整82局回歸：單顆交換與暫升分的兩步調整能消除重複柱', () => {
  const runs = [6,1,1,1,1,1,4,5,2,2,1,1,1,1,5,3,1,5,2,3,1,1,1,1,4,6,3,1,1,1,1,1,6,4,1,1,1];
  const options = { rounds: 82, maxRun: 6, maxDifference: 4, maxHoleLength: 5,
    perSideMax: 2, combinedMax: 3, holeMax: 2, pillarMax: 2 };
  assert.equal(scoreWithCaps(runs, '閒', options).total, 3);
  const intermediate = runs.slice();
  [intermediate[0], intermediate[2]] = [intermediate[2], intermediate[0]];
  assert.equal(scoreWithCaps(intermediate, '閒', options).total, 6);
  [intermediate[14], intermediate[16]] = [intermediate[16], intermediate[14]];
  assert.equal(scoreWithCaps(intermediate, '閒', options).total, 0);
  const result = improveSameSideRuns(runs, '閒', options);
  assert.equal(scoreWithCaps(result, '閒', options).total, 0);
  assert.deepEqual(runs, [6,1,1,1,1,1,4,5,2,2,1,1,1,1,5,3,1,5,2,3,1,1,1,1,4,6,3,1,1,1,1,1,6,4,1,1,1]);
  for (const side of [0, 1]) {
    assert.equal(result.filter((_, i) => i % 2 === side).reduce((a, b) => a + b, 0),
      runs.filter((_, i) => i % 2 === side).reduce((a, b) => a + b, 0));
  }
  assert(Math.max(...getSequences(result).red) <= 5);
  assert(checkLengthCaps(result, '閒', options).ok);
  assert(checkHoleCaps(result, options).ok);
  assert(checkPillarCaps(result, options).ok);
  assert.deepEqual(improveSameSideRuns(runs, '閒', options), result);
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
  assert.throws(() => generateRoad({ perSideMax: -1 }), /整數/);
  assert.throws(() => generateRoad({ combinedMax: 1.5 }), /整數/);
  assert.throws(() => generateRoad({ includeSingles: 'false' }), /布林值/);
  assert.throws(() => generateRoads({ count: 3, rounds: 1, maxDifference: 1, attempts: 1, hillSteps: 0, seed: '不足' }), /前20局/);
});
test('連續重抽不合格時，平衡備援仍產生符合硬條件的路單', () => {
  // 此亂數固定抽6顆欄，82局尾欄為4，莊閒差2；零差限制迫使走備援。
  checkRoad(generateRoad({ maxDifference: 0, attempts: 1, hillSteps: 0, perSideMax: '', combinedMax: '' }, () => 0.999), 82, 0, 6);
});
test('不可能的同長度上限有界回傳並標示，兩欄留空後不限', () => {
  const options = { rounds: 8, maxRun: 1, maxDifference: 0, includeSingles: true,
    attempts: 2, hillSteps: 20, seed: 1 };
  const road = generateRoad(options);
  checkRoad(road, 8, 0, 1);
  assert.deepEqual(road.columnLengths, { banker: { 1: 4 }, player: { 1: 4 }, total: { 1: 8 } });
  assert.equal(road.lengthCaps.ok, false);
  assert.equal(road.lengthCaps.violations.length, 3);
  assert.deepEqual(road.lengthCaps.violations, checkLengthCaps(road.runs, road.nonTieOutcomes[0], options).violations);
  const unlimited = generateRoad({ ...options, perSideMax: '', combinedMax: '' });
  checkRoad(unlimited, 8, 0, 1);
  assert.deepEqual(unlimited.lengthCaps, { enabled: false, ok: true, violations: [] });
});
test('備選優先減少違規項目，爬山不能以較低分數換取更多違規', () => {
  const options = { seed: 1, includeSingles: true, attempts: 20, hillSteps: 0 };
  const before = generateRoad(options), after = generateRoad({ ...options, hillSteps: 500 });
  checkRoad(before); checkRoad(after);
  assert.equal(before.lengthCaps.ok, false); assert.equal(after.lengthCaps.ok, false);
  assert(after.lengthCaps.violations.length <= before.lengthCaps.violations.length);
  if (after.lengthCaps.violations.length === before.lengthCaps.violations.length) assert(after.score.total <= before.score.total);
});
test('洞柱統計符合範例，包含頭尾、空序列與莊閒混看的不相鄰同長度', () => {
  const runs = [1, 1, 3, 2, 1, 4, 2, 2, 1, 1, 1];
  assert.deepEqual(countHoleLengths(runs), { 1: 1, 2: 1, 3: 1 });
  assert.deepEqual(countPillarLengths(runs), { 2: 1, 3: 1 });
  assert.deepEqual(countHoleLengths([]), {});
  assert.deepEqual(countPillarLengths([]), {});
  assert.deepEqual(countHoleLengths([1, 1, 1]), { 3: 1 });
  assert.deepEqual(countPillarLengths([2, 6, 3]), { 3: 1 });
  assert.deepEqual(countHoleLengths([2, 3]), {});
  assert.deepEqual(countPillarLengths([1, 1]), {});
  // 洞序列 [1,2,1]：兩個長度1不相鄰、起始莊閒也不同，仍須加總。
  assert.deepEqual(countHoleLengths([1, 2, 1, 1, 2, 1]), { 1: 2, 2: 1 });
  // 柱序列 [1,2,1]，按欄數分組，不加總各欄顆數。
  assert.deepEqual(countPillarLengths([2, 1, 3, 4, 1, 6]), { 1: 2, 2: 1 });
});
test('洞柱上限逐個長度加總，等於上限合格、空白不限、零禁止出現', () => {
  const runs = [1, 2, 1, 1, 2, 1];
  assert.deepEqual(checkHoleCaps(runs), { ok: true, violations: [] });
  assert.deepEqual(checkPillarCaps(runs, { pillarMax: '' }), { ok: true, violations: [] });
  const hole = checkHoleCaps(runs, { holeMax: 1 });
  assert.equal(hole.ok, false); assert.equal(hole.violations.length, 1);
  assert.match(hole.violations[0], /1欄的洞出現 2 次/);
  assert.equal(checkHoleCaps(runs, { holeMax: 2 }).ok, true);
  assert.equal(checkPillarCaps(runs, { pillarMax: 2 }).ok, true);
  assert.equal(checkPillarCaps(runs, { pillarMax: 1 }).violations.length, 1);
  assert.equal(checkHoleCaps(runs, { holeMax: 0 }).violations.length, 2);
  assert.equal(checkPillarCaps(runs, { pillarMax: 0 }).violations.length, 1);
  assert.equal(checkHoleCaps([], { holeMax: 0 }).ok, true);
  assert.equal(checkPillarCaps([], { pillarMax: 0 }).ok, true);
  for (const key of ['holeMax', 'pillarMax']) {
    for (const value of [-1, 1.5, 1001, NaN, null, '1']) {
      assert.throws(() => generateRoad({ [key]: value }), /必須留白或填入/);
    }
  }
});
test('種子1、洞上限1、柱上限2產生10條，全部合格或帶有完整違規標記', () => {
  const options = { seed: 1, count: 10, holeMax: 1, pillarMax: 2 };
  const limited = generateRoads(options);
  assert.equal(limited.length, 10);
  assert.equal(new Set(limited.map(r => r.nonTieOutcomes.slice(0, 20).join(''))).size, 10);
  for (const road of limited) {
    checkRoad(road);
    assert.deepEqual(road.holeLengths, countHoleLengths(road.runs));
    assert.deepEqual(road.pillarLengths, countPillarLengths(road.runs));
    assert.deepEqual(road.holeCaps, { enabled: true, ...checkHoleCaps(road.runs, options) });
    assert.deepEqual(road.pillarCaps, { enabled: true, ...checkPillarCaps(road.runs, options) });
    assert.deepEqual(road.lengthCaps, { enabled: true, ...checkLengthCaps(road.runs, road.nonTieOutcomes[0], options) });
    for (const cap of [road.lengthCaps, road.holeCaps, road.pillarCaps]) {
      assert.equal(cap.ok, cap.violations.length === 0);
      cap.violations.forEach(text => assert.match(text, /超過上限/));
    }
  }
  console.log(`  洞1／柱2：${limited.filter(r => r.lengthCaps.ok && r.holeCaps.ok && r.pillarCaps.ok).length}條全部合格，其餘明確標違規`);
});
test('洞柱限制獨立於行上限，不可能條件標記，候選及爬山按全部違規數優先', () => {
  const impossible = generateRoad({ rounds: 8, maxRun: 1, maxDifference: 0, perSideMax: '', combinedMax: '',
    holeMax: 0, pillarMax: 0, attempts: 2, hillSteps: 20, seed: 1 });
  checkRoad(impossible, 8, 0, 1);
  assert.equal(impossible.lengthCaps.enabled, false);
  assert.equal(impossible.holeCaps.ok, false);
  assert.equal(impossible.pillarCaps.ok, true);
  const options = { seed: 1, holeMax: 0, pillarMax: 0, attempts: 20, hillSteps: 0 };
  const violations = r => r.lengthCaps.violations.length + r.holeCaps.violations.length + r.pillarCaps.violations.length;
  const before = generateRoad(options), after = generateRoad({ ...options, hillSteps: 500 });
  checkRoad(before); checkRoad(after);
  // 不同搜尋預算可能走到不同的兩步局部解；驗證同一輸入優化前後不惡化，
  // 而非假設兩次獨立搜尋的最終結果必然隨預算單調改善。
  for (const road of [before, after]) {
    const o = { ...require('../亂路/luanlu.js').DEFAULTS, ...options };
    const result = improveSameSideRuns(road.runs, road.nonTieOutcomes[0], o);
    const total = scoreWithCaps(result, road.nonTieOutcomes[0], o);
    const groups = checkLengthCaps(result, road.nonTieOutcomes[0], o).violations.length +
      checkHoleCaps(result, o).violations.length + checkPillarCaps(result, o).violations.length;
    assert(groups <= violations(road));
    assert(total.capTotal <= road.score.capTotal + 1e-9);
    assert(total.total <= road.score.total + 1e-9);
    assert.deepEqual(road.highlightColumns, getRoadHighlights(road.runs, road.nonTieOutcomes[0], o));
  }
  const validOptions = { seed: 1, holeMax: 10, pillarMax: 10, attempts: 20, hillSteps: 0 };
  const validBefore = generateRoad(validOptions), validAfter = generateRoad({ ...validOptions, hillSteps: 500 });
  assert.equal(violations(validBefore), 0); assert.equal(violations(validAfter), 0);
  assert.equal(validBefore.score.capTotal, 0); assert.equal(validAfter.score.capTotal, 0);
});
test('洞柱上限留白與預設設定產生相同結果', () => {
  const blank = generateRoads({ count: 10, seed: 1, holeMax: '', pillarMax: '' });
  assert.deepEqual(blank, roads.slice(0, 10));
  blank.forEach(road => {
    assert.deepEqual(road.holeCaps, { enabled: false, ok: true, violations: [] });
    assert.deepEqual(road.pillarCaps, { enabled: false, ok: true, violations: [] });
  });
});
test('路單圖佈局與卡片欄位一致，固定六列，畫布隨條數與最大欄數調整', () => {
  const { roadLayout, roadmapImageLayout } = require('../亂路/luanlu.js');
  const generated = generateRoads({ count: 3, seed: 1 });
  const longRuns = [8, 1, 7, 6];
  const longRoad = { runs: longRuns, nonTieOutcomes: outcomes(longRuns, '閒') };
  const samples = [...generated, longRoad];
  const before = JSON.stringify(samples);
  for (const options of [{ cell: 26, gap: 24, padding: 24, titleHeight: 32, minWidth: 240 },
    { cell: 30, gap: 12, padding: 16, titleHeight: 40, minWidth: 200 }]) {
    for (let count = 1; count <= samples.length; count++) {
      const selected = samples.slice(0, count), layout = roadmapImageLayout(selected, options);
      const columns = selected.map(road => road.runs.reduce((sum, run) => sum + Math.max(1, run - 5), 0));
      assert.equal(layout.entries.length, count);
      layout.entries.forEach((entry, i) => {
        assert.equal(entry.columns, columns[i]); assert.equal(entry.rows, 6);
        assert.equal(entry.gridWidth, columns[i] * options.cell);
        assert.equal(entry.gridHeight, 6 * options.cell);
        assert.equal(entry.width, Math.max(options.minWidth, columns[i] * options.cell));
        assert.equal(entry.height, options.titleHeight + 6 * options.cell);
        assert.equal(entry.y, options.padding + i * (entry.height + options.gap));
        assert.equal(entry.gridY, entry.y + options.titleHeight);
        assert.equal(entry.cells.length, selected[i].nonTieOutcomes.length);
        assert.deepEqual(entry.cells.map(cell => cell.side), selected[i].nonTieOutcomes);
        assert(entry.cells.every(cell => cell.row >= 0 && cell.row < 6 && cell.col >= 0 && cell.col < entry.columns));
        const b = selected[i].nonTieOutcomes.filter(side => side === '莊').length;
        assert.equal(entry.title, `莊${b} / 閒${selected[i].nonTieOutcomes.length - b} · ${selected[i].nonTieOutcomes.length}局`);
      });
      assert.equal(layout.width, 2 * options.padding + Math.max(options.minWidth, Math.max(...columns) * options.cell));
      assert.equal(layout.height, 2 * options.padding + count * (options.titleHeight + 6 * options.cell) + (count - 1) * options.gap);
    }
  }
  const longLayout = roadLayout(longRoad);
  assert.equal(longLayout.columns, 7);
  assert.deepEqual(longLayout.cells.slice(5, 9), [
    { row: 5, col: 0, side: '閒', runIndex: 0 }, { row: 5, col: 1, side: '閒', runIndex: 0 },
    { row: 5, col: 2, side: '閒', runIndex: 0 }, { row: 0, col: 3, side: '莊', runIndex: 1 }
  ]);
  assert.equal(roadmapImageLayout([]).height, 48);
  assert.equal(roadmapImageLayout([]).width, 48);
  assert.equal(JSON.stringify(samples), before, '顯示佈局不得改動路單資料');
});

function loadAppDerived() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const start = src.indexOf('function buildBigRoad(');
  const end = src.indexOf('// ---------- 下局預測');
  assert(start >= 0 && end > start, '無法從 app.js 擷取衍生路函式');
  const sandbox = {};
  vm.runInNewContext(`${src.slice(start, end)}
    this.buildBigRoad = buildBigRoad;
    this.buildDerivedRoad = buildDerivedRoad;
    this.layoutDerivedMarks = layoutDerivedMarks;`, sandbox);
  return sandbox;
}
function toAppRounds(values) {
  return values.map(n => ({ r: n === '莊' ? 'B' : 'P', bp: false, pp: false }));
}
function occupancy(grid, cols, rows) {
  const cells = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    if (grid[r] && grid[r][c]) cells.push(`${r},${c}`);
  }
  return cells;
}
function asData(value) { return JSON.parse(JSON.stringify(value)); }

test('只算大路時，固定種子產出與修改前完全相同', () => {
  const cases = [
    { seed: 1 },
    { seed: '單條' },
    { seed: '爬山', attempts: 50, hillSteps: 0 },
    { count: 3, seed: 2 }
  ];
  for (const options of cases) {
    if (options.count) {
      assert.deepEqual(generateRoads(options), oldLuanlu.generateRoads(options));
      assert.deepEqual(generateRoads({ ...options, scoreMode: 'big' }), oldLuanlu.generateRoads(options));
      assert.deepEqual(generateRoads({ ...options, scoreDerived: false }), oldLuanlu.generateRoads(options));
    } else {
      assert.deepEqual(generateRoad(options), oldLuanlu.generateRoad(options));
      assert.deepEqual(generateRoad({ ...options, scoreMode: 'big' }), oldLuanlu.generateRoad(options));
      assert.deepEqual(generateRoad({ ...options, scoreDerived: false }), oldLuanlu.generateRoad(options));
    }
  }
});

// 獨立以邏輯欄長推導，不讀網格，也不沿用正式程式的有格／無格判斷。
function logicalDerivedMarks(lengths, k) {
  const marks = [];
  for (let n = k; n < lengths.length; n++) {
    for (let r = n === k ? 2 : 1; r <= lengths[n]; r++) {
      const red = r === 1
        ? lengths[n - 1] === lengths[n - 1 - k]
        : lengths[n - k] !== r - 1;
      marks.push(red ? 'R' : 'B');
    }
  }
  return marks;
}

test('換欄比較前一欄與隔 offset 欄，兩組指定欄長符合驗收序列', () => {
  const app = loadAppDerived();
  const cases = [
    { runs: [5, 4, 5, 1, 3], expected: { 2: 'RRRRRBRR' } },
    { runs: [4, 3, 2, 2, 3, 4, 3, 1], expected: {
      2: 'RBRBRBBRBRBRRR', 3: 'RBRRRRBRBRBB'
    } }
  ];
  for (const { runs, expected } of cases) {
    const values = outcomes(runs, '莊');
    for (const [name, big, build] of [
      ['亂路', buildBigRoadGrid(values), buildDerivedRoad],
      ['主程式', app.buildBigRoad(toAppRounds(values)), app.buildDerivedRoad]
    ]) for (const [offset, sequence] of Object.entries(expected)) {
      assert.equal(build(big.grid, Number(offset), big.cols, big.rows).join(''), sequence,
        `${name} offset=${offset} 欄長=${runs}`);
    }
  }
});

test('2000 組隨機欄長 1～6，兩份程式的三條路皆符合獨立邏輯欄算法', () => {
  const app = loadAppDerived();
  const rng = createRng('換欄獨立對照-2000');
  for (let sample = 0; sample < 2000; sample++) {
    const runs = Array.from({ length: 1 + Math.floor(rng() * 40) },
      () => 1 + Math.floor(rng() * 6));
    const values = outcomes(runs, sample % 2 ? '閒' : '莊');
    for (const [name, big, build] of [
      ['亂路', buildBigRoadGrid(values), buildDerivedRoad],
      ['主程式', app.buildBigRoad(toAppRounds(values)), app.buildDerivedRoad]
    ]) for (const { offset } of DERIVED_ROADS) {
      assert.deepEqual(asData(build(big.grid, offset, big.cols, big.rows)),
        logicalDerivedMarks(runs, offset),
        `${name} 第 ${sample + 1} 組 offset=${offset} 欄長=${runs}`);
    }
  }
});

test('衍生路紅藍與排法等於 app.js，至少三條固定路單', () => {
  const app = loadAppDerived();
  const samples = [
    outcomes([1, 1, 3, 2, 1, 4, 2, 2, 1, 1, 1], '莊'),
    outcomes([8, 1, 7, 2, 6, 3, 9, 1, 1, 4], '閒'),
    outcomes(Array(20).fill(1), '莊'),
    generateRoad({ seed: 1, attempts: 20, hillSteps: 0 }).nonTieOutcomes
  ];
  assert(samples.length >= 3);
  for (const values of samples) {
    const appBig = app.buildBigRoad(toAppRounds(values));
    const luBig = buildBigRoadGrid(values);
    assert.equal(luBig.rows, 6);
    assert.equal(luBig.cols, appBig.cols);
    assert.equal(appBig.rows, 6);
    assert.deepEqual(occupancy(luBig.grid, luBig.cols, luBig.rows), occupancy(appBig.grid, appBig.cols, appBig.rows));
    for (const { key, offset } of DERIVED_ROADS) {
      const luMarks = buildDerivedRoad(luBig.grid, offset, luBig.cols, luBig.rows);
      const appMarks = app.buildDerivedRoad(appBig.grid, offset, appBig.cols, appBig.rows);
      assert.deepEqual(asData(luMarks), asData(appMarks), `${key} offset=${offset}`);
      assert.deepEqual(asData(layoutDerivedMarks(luMarks, 6)), asData(app.layoutDerivedMarks(appMarks, 6)));
    }
  }
});

test('下三路從指定欄第二格開始，首格不足時延至下一欄', () => {
  const app = loadAppDerived();
  for (const runs of [[1, 2], [1, 1, 2]]) {
    const values = outcomes(runs);
    const grids = [
      [buildBigRoadGrid(values), buildDerivedRoad],
      [app.buildBigRoad(toAppRounds(values)), app.buildDerivedRoad]
    ];
    const expected = runs.length === 2 ? [['B'], [], []] : [['R', 'B'], ['B'], []];
    for (const [big, build] of grids) for (const { offset } of DERIVED_ROADS) {
      assert.deepEqual(asData(build(big.grid, offset, big.cols, big.rows)), expected[offset - 1]);
      // 逐局核對標記出現位置：第2欄第2格，或第3欄第1、2格。
      const prefixes = values.map((_, i) => {
        const prefix = buildBigRoadGrid(values.slice(0, i + 1));
        return asData(build(prefix.grid, offset, prefix.cols, prefix.rows));
      });
      const expectedPrefixes = runs.length === 2
        ? (offset === 1 ? [[], [], ['B']] : [[], [], []])
        : (offset === 1 ? [[], [], ['R'], ['R', 'B']]
          : offset === 2 ? [[], [], [], ['B']] : [[], [], [], []]);
      assert.deepEqual(prefixes, expectedPrefixes);
    }
  }
});

test('欄長1234循環，第5至8欄的下三路標記逐欄符合驗收例', () => {
  const app = loadAppDerived();
  const runs = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];
  const expected = [
    ['B', 'BB', 'BRB', 'BRRB'],
    ['B', 'BR', 'BBR', 'BRBR'],
    ['B', 'BR', 'BRR', 'BBRR']
  ];
  const values = outcomes(runs);
  for (const [big, build] of [
    [buildBigRoadGrid(values), buildDerivedRoad],
    [app.buildBigRoad(toAppRounds(values)), app.buildDerivedRoad]
  ]) for (const { offset } of DERIVED_ROADS) {
    const marks = asData(build(big.grid, offset, big.cols, big.rows));
    let index = runs.slice(offset, 4).reduce((sum, n) => sum + n, 0) - 1;
    const columns = runs.slice(4, 8).map(length => {
      const column = marks.slice(index, index + length).join('');
      index += length;
      return column;
    });
    assert.deepEqual(columns, expected[offset - 1]);
  }
});

test('三種評分範圍的總分組成，搜尋使用該總分', () => {
  assert.equal(DEFAULTS.scoreMode, 'big');
  assert.equal(WEIGHTS.derivedRunBase, 6);
  assert.equal(WEIGHTS.derivedRun, 1);
  assert.equal(WEIGHTS.derivedRedBase, undefined);
  assert.equal(WEIGHTS.derivedRed, undefined);
  assert.equal(WEIGHTS.derivedLongRun, undefined);
  assert.equal(WEIGHTS.bigEye, undefined);
  assert.equal(WEIGHTS.smallRoad, undefined);
  assert.equal(WEIGHTS.cockroachRoad, undefined);
  const values = outcomes([2, 2, 2, 2, 2, 2, 2, 2]);
  const runs = toRuns(values);
  const regular = scoreRoad(values).total;
  const derived = scoreDerivedRoads(values);
  const capOpts = { perSideMax: '', combinedMax: '', holeMax: '', pillarMax: 0 };
  const capTotal = scoreCapExcess(runs, '莊', capOpts).total;
  assert(capTotal > 0);
  assert(regular > 0);
  assert.equal(derived.longestRun, 13);
  assert.equal(derived.longestRoad, 'bigEye');
  assert.equal(derived.longestColor, 'R');
  assert.equal(derived.total, (13 - WEIGHTS.derivedRunBase) * WEIGHTS.derivedRun);
  assert.equal(derived.total, 7);
  const big = scoreWithCaps(runs, '莊', { ...capOpts, scoreMode: 'big' });
  const onlyDerived = scoreWithCaps(runs, '莊', { ...capOpts, scoreMode: 'derived' });
  const both = scoreWithCaps(runs, '莊', { ...capOpts, scoreMode: 'both' });
  assert.equal(big.derivedTotal, undefined);
  assert.equal(big.longestRun, undefined);
  assert.equal(big.scoreMode, undefined);
  assert.equal(big.total, regular + capTotal);
  assert.equal(big.regularTotal, regular);
  assert.equal(onlyDerived.regularTotal, regular);
  assert.equal(onlyDerived.derivedTotal, derived.total);
  assert.equal(onlyDerived.total, derived.total + capTotal);
  assert.notEqual(onlyDerived.total, regular + derived.total + capTotal);
  assert.equal(both.total, regular + derived.total + capTotal);
  assert.equal(both.derivedRedRatio, derived.redRatio);
  assert.equal(both.longestRun, derived.longestRun);
  assert.equal(both.longestRoad, derived.longestRoad);
  assert.equal(both.longestColor, derived.longestColor);
  assert.equal(onlyDerived.longestRun, derived.longestRun);
  for (const mode of ['big', 'derived', 'both']) {
    const road = generateRoad({ seed: 1, scoreMode: mode, attempts: 30, hillSteps: 0 });
    checkRoad(road);
    const scored = scoreDerivedRoads(road.nonTieOutcomes);
    if (mode === 'big') assert.equal(road.score.derivedTotal, undefined);
    else {
      assert.equal(road.score.derivedTotal, scored.total);
      assert.equal(road.score.scoreMode, mode);
    }
    const regularPart = mode === 'derived' ? 0 : road.score.regularTotal;
    const derivedPart = mode === 'big' ? 0 : road.score.derivedTotal;
    assert.equal(road.score.total, regularPart + derivedPart + road.score.capTotal);
  }
  const random = generateRoad({ seed: 1, randomMode: true, scoreMode: 'both', attempts: 1, hillSteps: 0 });
  assert.equal(random.score, null);
  assert.deepEqual(random.nonTieOutcomes, oldLuanlu.generateRoad({
    seed: 1, randomMode: true, attempts: 1, hillSteps: 0
  }).nonTieOutcomes);
});

test('下三路只扣三條路中最長的同色段', () => {
  assert.deepEqual(derivedRunLengths([]), []);
  assert.deepEqual(derivedRunLengths(['R', 'R', 'B', 'B', 'R', 'R', 'R']), [2, 2, 3]);
  const allRed = scoreDerivedRoads(outcomes(Array(30).fill(1)));
  assert.deepEqual(allRed.marks.bigEye, Array(28).fill('R'));
  assert.deepEqual(allRed.marks.smallRoad, Array(27).fill('R'));
  assert.deepEqual(allRed.marks.cockroachRoad, Array(26).fill('R'));
  assert.equal(allRed.bigEye.longestRun, 28);
  assert.equal(allRed.bigEye.longestColor, 'R');
  assert.equal(allRed.smallRoad.longestRun, 27);
  assert.equal(allRed.smallRoad.longestColor, 'R');
  assert.equal(allRed.cockroachRoad.longestRun, 26);
  assert.equal(allRed.cockroachRoad.longestColor, 'R');
  assert.equal(allRed.longestRun, 28);
  assert.equal(allRed.longestRoad, 'bigEye');
  assert.equal(allRed.longestColor, 'R');
  assert.equal(allRed.redCount, 81);
  assert.equal(allRed.blueCount, 0);
  assert.equal(allRed.redRatio, 1);
  assert.equal(allRed.total, 22);
  assert.equal([28, 27, 26].reduce((sum, length) => sum + (length - WEIGHTS.derivedRunBase), 0), 63);
  assert.notEqual(allRed.total, 63);
  for (const { key } of DERIVED_ROADS) assert.equal(allRed[key].reasons, undefined);

  const exact = scoreDerivedRoads(outcomes(Array(8).fill(1)));
  assert.equal(exact.longestRun, 6);
  assert.equal(exact.longestRoad, 'bigEye');
  assert.equal(exact.longestColor, 'R');
  assert.equal(exact.total, 0);
  const justOver = scoreDerivedRoads(outcomes(Array(9).fill(1)));
  assert.equal(justOver.longestRun, 7);
  assert.equal(justOver.longestRoad, 'bigEye');
  assert.equal(justOver.total, 1);

  // 小路 9 顆全藍，長過大眼仔與蟑螂路，藍色長串一樣扣分。
  const blue = scoreDerivedRoads(outcomes([1, 1, 2, 2, 1, 1, 2, 2]));
  assert.deepEqual(blue.marks.smallRoad, Array(9).fill('B'));
  assert.equal(blue.smallRoad.longestRun, 9);
  assert.equal(blue.smallRoad.longestColor, 'B');
  assert(blue.bigEye.longestRun < 9);
  assert(blue.cockroachRoad.longestRun < 9);
  assert.equal(blue.longestRun, 9);
  assert.equal(blue.longestRoad, 'smallRoad');
  assert.equal(blue.longestColor, 'B');
  assert.equal(blue.total, 3);
  assert(scoreSequence(blue.sequences.bigEye).total > 0);
  assert.notEqual(blue.total, DERIVED_ROADS.reduce((sum, { key }) => sum + scoreSequence(blue.sequences[key]).total, 0));

  // 三條都超過 6，只扣最長的大眼仔，不是 (13-6)+(11-6)+(9-6)。
  const longColumns = scoreDerivedRoads(outcomes([2, 2, 2, 2, 2, 2, 2, 2]));
  assert.equal(longColumns.bigEye.longestRun, 13);
  assert.equal(longColumns.smallRoad.longestRun, 11);
  assert.equal(longColumns.cockroachRoad.longestRun, 9);
  assert.equal(longColumns.longestRoad, 'bigEye');
  assert.equal(longColumns.longestColor, 'R');
  assert.equal(longColumns.total, 7);
  assert.notEqual(longColumns.total, 15);

  // 紅比例 62.5% 仍低於舊門檻，但小路有 9 顆連續紅，現在要扣。
  const low = scoreDerivedRoads(outcomes([4, 1, 4, 1, 4, 1]));
  assert.equal(low.redRatio, 0.625);
  assert.equal(low.longestRun, 9);
  assert.equal(low.longestRoad, 'smallRoad');
  assert.equal(low.longestColor, 'R');
  assert.equal(low.total, 3);

  // 9 顆、舊規則因少於 10 顆不扣；現在大眼仔連續 7 紅，扣 1。
  const few = scoreDerivedRoads(outcomes([5, 5, 3]));
  const fewCount = DERIVED_ROADS.reduce((sum, { key }) => sum + few.marks[key].length, 0);
  assert.equal(fewCount, 9);
  assert.equal(few.bigEye.longestRun, 7);
  assert.equal(few.longestRoad, 'bigEye');
  assert.equal(few.longestColor, 'R');
  assert.equal(few.total, 1);

  const tie = scoreDerivedRoads(outcomes([1, 1, 6]));
  assert.equal(tie.bigEye.longestRun, 4);
  assert.equal(tie.smallRoad.longestRun, 4);
  assert.equal(tie.longestRoad, 'bigEye');
  assert.equal(tie.longestColor, 'R');
  const tieLater = scoreDerivedRoads(outcomes([1, 1, 2, 5]));
  assert.equal(tieLater.smallRoad.longestRun, 3);
  assert.equal(tieLater.smallRoad.longestColor, 'B');
  assert.equal(tieLater.cockroachRoad.longestRun, 3);
  assert.equal(tieLater.cockroachRoad.longestColor, 'R');
  assert.equal(tieLater.bigEye.longestRun, 2);
  assert.equal(tieLater.longestRoad, 'smallRoad');
  assert.equal(tieLater.longestColor, 'B');

  const short = scoreDerivedRoads(outcomes(Array(6).fill(1)));
  assert.equal(DERIVED_ROADS.reduce((sum, { key }) => sum + short.marks[key].length, 0), 9);
  assert.equal(short.longestRun, 4);
  assert.equal(short.total, 0);
  for (const values of [[], outcomes([1, 2]), outcomes([1, 1, 2])]) {
    const scored = scoreDerivedRoads(values);
    assert(scored.longestRun <= WEIGHTS.derivedRunBase);
    assert.equal(scored.total, 0);
    assert.equal(scored.longestRoad, 'bigEye');
    for (const { key } of DERIVED_ROADS) {
      assert.deepEqual(scored.sequences[key], derivedRunLengths(scored.marks[key]));
      assert.equal(typeof scored[key].redRatio, 'number');
      assert.equal(typeof scored[key].longestRun, 'number');
    }
  }
  assert.equal(scoreDerivedRoads([]).longestColor, null);
});

test('指定欄長的下三路紅藍顆數，評分總分不變', () => {
  const runs = [6, 5, 3, 1, 5, 2, 1, 1, 1, 1, 2, 4, 5, 3, 1, 1, 1, 1, 1, 6, 4, 3, 1, 1, 1, 4, 1, 1, 1, 1, 1, 6, 2, 1, 1, 1, 1];
  const values = outcomes(runs, '莊');
  const scored = scoreDerivedRoads(values);
  assert.deepEqual([scored.bigEye.redCount, scored.bigEye.blueCount], [48, 27]);
  assert.deepEqual([scored.smallRoad.redCount, scored.smallRoad.blueCount], [37, 33]);
  assert.deepEqual([scored.cockroachRoad.redCount, scored.cockroachRoad.blueCount], [34, 33]);
  assert.deepEqual([scored.redCount, scored.blueCount], [119, 93]);
  assert.equal(scored.bigEye.redRatio, 48 / 75);
  assert.equal(scored.smallRoad.redRatio, 37 / 70);
  assert.equal(scored.cockroachRoad.redRatio, 34 / 67);
  assert.equal(scored.redRatio, 119 / 212);
  assert.equal(scored.bigEye.longestRun, 4);
  assert.equal(scored.bigEye.longestColor, 'R');
  assert.equal(scored.smallRoad.longestRun, 5);
  assert.equal(scored.smallRoad.longestColor, 'B');
  assert.equal(scored.cockroachRoad.longestRun, 6);
  assert.equal(scored.cockroachRoad.longestColor, 'R');
  assert.equal(scored.longestRun, 6);
  assert.equal(scored.longestRoad, 'cockroachRoad');
  assert.equal(scored.longestColor, 'R');
  assert.equal(scored.total, 0);
  const regular = scoreRoad(values).total;
  const capOpts = { perSideMax: '', combinedMax: '', holeMax: '', pillarMax: '' };
  const capTotal = scoreCapExcess(runs, '莊', capOpts).total;
  const modes = {
    big: scoreWithCaps(runs, '莊', { ...capOpts, scoreMode: 'big' }),
    derived: scoreWithCaps(runs, '莊', { ...capOpts, scoreMode: 'derived' }),
    both: scoreWithCaps(runs, '莊', { ...capOpts, scoreMode: 'both' })
  };
  assert.equal(modes.big.total, regular + capTotal);
  assert.equal(modes.big.longestRun, undefined);
  assert.equal(modes.derived.total, capTotal);
  assert.equal(modes.both.total, regular + capTotal);
  for (const mode of ['derived', 'both']) {
    const withCaps = modes[mode];
    assert.equal(withCaps.derivedRedCount, 119);
    assert.equal(withCaps.derivedBlueCount, 93);
    assert.deepEqual([withCaps.bigEye.redCount, withCaps.bigEye.blueCount], [48, 27]);
    assert.deepEqual([withCaps.smallRoad.redCount, withCaps.smallRoad.blueCount], [37, 33]);
    assert.deepEqual([withCaps.cockroachRoad.redCount, withCaps.cockroachRoad.blueCount], [34, 33]);
    assert.equal(withCaps.bigEye.longestRun, 4);
    assert.equal(withCaps.smallRoad.longestRun, 5);
    assert.equal(withCaps.smallRoad.longestColor, 'B');
    assert.equal(withCaps.cockroachRoad.longestRun, 6);
    assert.equal(withCaps.cockroachRoad.longestColor, 'R');
    assert.equal(withCaps.longestRun, 6);
    assert.equal(withCaps.longestRoad, 'cockroachRoad');
    assert.equal(withCaps.longestColor, 'R');
    assert.equal(withCaps.derivedRedRatio, scored.redRatio);
    assert.equal(withCaps.derivedTotal, 0);
  }
});

test('舊 scoreDerived 轉成評分範圍，錯誤值丟中文錯誤', () => {
  assert.equal(migrateScoreMode({ scoreDerived: true }), 'both');
  assert.equal(migrateScoreMode({ scoreDerived: false }), 'big');
  assert.equal(migrateScoreMode({}), 'big');
  assert.equal(migrateScoreMode(null), 'big');
  assert.equal(migrateScoreMode({ scoreMode: 'derived', scoreDerived: true }), 'derived');
  assert.equal(migrateScoreMode({ scoreDerived: 'true' }), 'big');
  const legacy = generateRoad({ seed: 1, scoreDerived: true, attempts: 30, hillSteps: 0 });
  const both = generateRoad({ seed: 1, scoreMode: 'both', attempts: 30, hillSteps: 0 });
  assert.deepEqual(legacy, both);
  assert.equal(legacy.score.total, legacy.score.regularTotal + legacy.score.derivedTotal + legacy.score.capTotal);
  assert.throws(() => generateRoad({ scoreMode: 'yes' }), /評分範圍必須是 big、derived 或 both/);
  assert.throws(() => generateRoad({ scoreMode: true }), /評分範圍必須是 big、derived 或 both/);
  assert.throws(() => generateRoad({ scoreMode: '' }), /評分範圍必須是 big、derived 或 both/);
});
test('莊閒差與長龍留白代表不限，非法值仍丟中文錯誤', () => {
  const road = generateRoad({ seed: 7, maxDifference: '', maxRun: '', attempts: 30, hillSteps: 30 });
  assert.equal(road.nonTieOutcomes.length, 82);
  assert.ok(generateRoad({ seed: 7, rounds: 81, maxDifference: '', attempts: 30, hillSteps: 0 }));
  const dragon = generateRoad({ seed: 1, rounds: 20, maxDifference: '', maxRun: '', randomMode: true });
  assert.equal(dragon.runs.reduce((a, b) => a + b, 0), 20);
  assert.throws(() => generateRoad({ maxRun: 0 }), /長龍上限必須留白或填入/);
  assert.throws(() => generateRoad({ maxDifference: -1 }), /莊閒差上限必須留白或填入/);
});
console.log(`全部 ${passed} 項測試通過。`);
