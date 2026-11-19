'use strict';
/**
 * 亂路（luanlu.js）下三路評分實驗與對照腳本
 *
 * 實驗組別（每組 N = 500 份路單，每份 82 局有效莊閒）：
 * 1. 自然隨機（Natural Random）：依真實百家樂機率（莊 45.86%、閒 44.62%、和 9.52%）抽樣，跳過和局湊滿 82 局（另附含和局共 82 局之紅比例驗證）。
 * 2. 現行預設（Current Default, scoreMode='big'）：直接呼叫 luanlu.js 預設參數（只算大路規律分與上限）。
 * 3. 現行下三路（Current Derived, scoreMode='both'）：直接呼叫 luanlu.js 開啟下三路評分（只扣三路最長同色段 M > 6，每顆 1 分）。
 * 4. 建議改法（Proposed Fix, scoreMode='both'）：
 *    對大眼仔、小路、蟑螂路三條下三路各自計算並加總：
 *    (a) 紅比例目標區間（45%～55%）：|redRatio - 0.5| 超過 0.05 的部分，每 1%（0.01）扣 1 分（權重 derivedRed = 100）。
 *    (b) 同色串長度分布累進扣分：每條路中每一段長度 > 3（即 >= 4）的同色串，設 d = run - 3，扣 d*(d+1)/2 * 2 分（4顆扣2分、5顆扣6分、6顆扣12分、7顆扣20分）。
 *    (c) 連續單跳（紅藍交替）過長扣分：每條路中連續單跳（run === 1）超過 4 顆時，每多 1 顆扣 2 分（防止演算法為逃避同色串而排出 RBRBRB... 單跳長龍）。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const luanlu = require(path.resolve(__dirname, '../亂路/luanlu.js'));

const SAMPLE_SIZE = 500;
const PROPOSED_WEIGHTS = Object.freeze({
  ...luanlu.WEIGHTS,
  derivedRunBase: 3,
  derivedRun: 2,
  derivedRedTolerance: 0.05,
  derivedRed: 100,
  derivedAltBase: 4,
  derivedAlt: 2
});

// 建議改法的 scoreDerivedRoads 實作
function scoreDerivedRoadsProposed(outcomes) {
  const big = luanlu.buildBigRoadGrid(outcomes);
  const marks = {}, sequences = {}, result = {
    total: 0, redRatio: 0, redCount: 0, blueCount: 0,
    longestRun: 0, longestRoad: luanlu.DERIVED_ROADS[0].key, longestColor: null, marks, sequences
  };
  for (const { key, offset } of luanlu.DERIVED_ROADS) {
    const roadMarks = luanlu.buildDerivedRoad(big.grid, offset, big.cols, big.rows);
    let redCount = 0, longestRun = 0, longestColor = null, run = 0, color = null;
    for (const mark of roadMarks) {
      if (mark === 'R') redCount++;
      if (mark === color) run++;
      else { run = 1; color = mark; }
      if (run > longestRun) { longestRun = run; longestColor = color; }
    }
    const blueCount = roadMarks.length - redCount;
    const redRatio = roadMarks.length ? redCount / roadMarks.length : 0;
    const runs = luanlu.derivedRunLengths(roadMarks);
    marks[key] = roadMarks;
    sequences[key] = runs;

    // (a) 紅藍比例偏離 [45%, 55%] 目標區間扣分
    const redDev = Math.max(0, Math.abs(redRatio - 0.5) - PROPOSED_WEIGHTS.derivedRedTolerance);
    let roadScore = redDev * PROPOSED_WEIGHTS.derivedRed;

    // (b) 每段長度 > 3 (即 >= 4) 的同色串累進扣分 + (c) 連續單跳 > 4 顆扣分
    let singleStreak = 0;
    for (const r of runs) {
      if (r > PROPOSED_WEIGHTS.derivedRunBase) {
        const d = r - PROPOSED_WEIGHTS.derivedRunBase;
        roadScore += (d * (d + 1) / 2) * PROPOSED_WEIGHTS.derivedRun;
      }
      if (r === 1) {
        singleStreak++;
        if (singleStreak > PROPOSED_WEIGHTS.derivedAltBase) {
          roadScore += PROPOSED_WEIGHTS.derivedAlt;
        }
      } else {
        singleStreak = 0;
      }
    }

    result[key] = {
      redRatio, redCount, blueCount,
      longestRun, longestColor, total: roadScore
    };
    result.redCount += redCount;
    result.blueCount += blueCount;
    result.total += roadScore;
    if (longestRun > result.longestRun) {
      result.longestRun = longestRun;
      result.longestRoad = key;
      result.longestColor = longestColor;
    }
  }
  const allCount = result.redCount + result.blueCount;
  result.redRatio = allCount ? result.redCount / allCount : 0;
  return result;
}

// 複製 luanlu.js 的產生流程，僅將 scoreDerivedRoads 替換為 scoreDerivedRoadsProposed、預設 scoreMode 改為 'both'
function generateRoadProposed(options = {}, rng) {
  const o = { ...luanlu.DEFAULTS, scoreMode: 'both', ...options };
  const activeRng = rng || luanlu.createRng(o.seed);
  const first = activeRng() < 0.5 ? '莊' : '閒';
  const cap = Math.min(o.maxRun, o.rounds);
  const weights = Array.from({ length: cap }, (_, i) => [50, 25, 12, 7, 4, 2][i] || 2 * Math.pow(0.5, i - 5));
  const sum = weights.reduce((a, b) => a + b, 0);

  function outcomesFromRuns(runs) {
    const values = [];
    runs.forEach((n, i) => { for (let j = 0; j < n; j++) values.push(i % 2 ? (first === '莊' ? '閒' : '莊') : first); });
    return values;
  }
  function allowedHoleLength(runs) {
    if (o.maxHoleLength === '') return true;
    let length = 0;
    for (const r of runs) {
      length = r === 1 ? length + 1 : 0;
      if (length > o.maxHoleLength) return false;
    }
    return true;
  }
  function validRuns(runs) {
    return runs.length > 0 && runs.every(n => n >= 1 && n <= o.maxRun && Number.isInteger(n)) &&
      runs.reduce((a, n) => a + n, 0) === o.rounds &&
      Math.abs(runs.reduce((a, n, i) => a + (i % 2 ? -n : n), 0)) <= o.maxDifference &&
      (o.randomMode || allowedHoleLength(runs));
  }
  function randomCandidate() {
    for (let retry = 0; retry < 100; retry++) {
      const runs = [], counts = [{}, {}], total = {};
      let remaining = o.rounds, holeLength = 0;
      while (remaining) {
        const side = counts[runs.length % 2];
        let available = o.randomMode ? weights : weights.map((weight, i) => {
          const n = Math.min(i + 1, remaining);
          if (n === 1 && o.maxHoleLength !== '' && holeLength >= o.maxHoleLength) return 0;
          return (n === 1 && !o.includeSingles) ||
            ((o.perSideMax === '' || (side[n] || 0) < o.perSideMax) &&
              (o.combinedMax === '' || (total[n] || 0) < o.combinedMax)) ? weight : 0;
        });
        if (!available.some(Boolean)) available = weights;
        let draw = activeRng() * (available === weights ? sum : available.reduce((a, b) => a + b, 0)), length = cap;
        for (let i = 0; i < cap; i++) { draw -= available[i]; if (draw < 0) { length = i + 1; break; } }
        length = Math.min(length, remaining); runs.push(length); remaining -= length;
        holeLength = length === 1 ? holeLength + 1 : 0;
        side[length] = (side[length] || 0) + 1; total[length] = (total[length] || 0) + 1;
      }
      if (validRuns(runs)) return runs;
    }
    throw new Error('無法建立符合條件的路單。');
  }
  function mutate(runs) {
    const next = runs.slice(), index = Math.floor(activeRng() * next.length);
    switch (Math.floor(activeRng() * 4)) {
      case 0: if (index + 1 < next.length) [next[index], next[index + 1]] = [next[index + 1], next[index]]; break;
      case 1: if (next[index] > 1) { const cut = 1 + Math.floor(activeRng() * (next[index] - 1)); next.splice(index, 1, cut, next[index] - cut); } break;
      case 2: if (index + 1 < next.length) next.splice(index, 2, next[index] + next[index + 1]); break;
      case 3: { const other = Math.floor(activeRng() * next.length); if (other !== index && next[other] > 1) { next[index]++; next[other]--; } break; }
    }
    return next;
  }
  function scoreWithCapsProposed(runs) {
    const outcomes = outcomesFromRuns(runs);
    const regular = luanlu.scoreRoad(outcomes);
    const caps = luanlu.scoreCapExcess(runs, first, o);
    const result = { ...regular, total: regular.total + caps.total, regularTotal: regular.total, capTotal: caps.total, capScores: caps };
    const mode = o.scoreMode;
    if (!o.randomMode && (mode === 'derived' || mode === 'both')) {
      const derived = scoreDerivedRoadsProposed(outcomes);
      result.bigEye = derived.bigEye;
      result.smallRoad = derived.smallRoad;
      result.cockroachRoad = derived.cockroachRoad;
      result.derivedTotal = derived.total;
      result.derivedRedRatio = derived.redRatio;
      result.derivedRedCount = derived.redCount;
      result.derivedBlueCount = derived.blueCount;
      result.derivedMarks = derived.marks;
      result.derivedSequences = derived.sequences;
      result.longestRun = derived.longestRun;
      result.longestRoad = derived.longestRoad;
      result.longestColor = derived.longestColor;
      result.scoreMode = mode;
      result.total = (mode === 'both' ? regular.total : 0) + derived.total + caps.total;
    }
    return result;
  }

  let best, bestScore = Infinity, bestViolations = Infinity;
  const steps = o.attempts + o.hillSteps;
  for (let i = 0; i < steps; i++) {
    const runs = i < o.attempts ? randomCandidate() : mutate(best);
    if (validRuns(runs)) {
      const violations = luanlu.checkLengthCaps(runs, first, o).violations.length +
        (o.holeMax === '' ? 0 : luanlu.checkHoleCaps(runs, o).violations.length) +
        (o.pillarMax === '' ? 0 : luanlu.checkPillarCaps(runs, o).violations.length);
      const score = scoreWithCapsProposed(runs).total;
      if (violations < bestViolations || (violations === bestViolations && score <= bestScore)) {
        best = runs; bestScore = score; bestViolations = violations;
      }
    }
  }

  function* sameSideNeighbors(runs) {
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 2; j < runs.length; j += 2) {
        if (runs[i] === runs[j]) continue;
        const next = runs.slice(); [next[i], next[j]] = [next[j], next[i]]; yield next;
      }
    }
    for (let i = 0; i < runs.length; i++) {
      if (runs[i] <= 1) continue;
      for (let j = i % 2; j < runs.length; j += 2) {
        if (i === j || runs[j] >= o.maxRun || runs[i] === runs[j] + 1) continue;
        const next = runs.slice(); next[i]--; next[j]++; yield next;
      }
    }
  }
  const maxChecks = 8000, maxImprovements = 6, beamWidth = 8, epsilon = 1e-9;
  let checks = 0;
  const evaluate = candidate => ({
    runs: candidate,
    score: scoreWithCapsProposed(candidate),
    violations: luanlu.checkLengthCaps(candidate, first, o).violations.length +
      luanlu.checkHoleCaps(candidate, o).violations.length +
      luanlu.checkPillarCaps(candidate, o).violations.length
  });
  let curBest = evaluate(best.slice());
  for (let round = 0; round < maxImprovements && checks < maxChecks && curBest.score.total > epsilon; round++) {
    const origin = curBest, seen = new Set([origin.runs.join(',')]), plateau = [];
    let improved = null;
    function inspect(state, rememberPlateau) {
      for (const next of sameSideNeighbors(state.runs)) {
        if (checks >= maxChecks) break;
        const key = next.join(',');
        if (seen.has(key)) continue;
        seen.add(key); checks++;
        if (!validRuns(next)) continue;
        const candidate = evaluate(next);
        if (candidate.violations > origin.violations || candidate.score.capTotal > origin.score.capTotal + epsilon) continue;
        if (candidate.score.total < origin.score.total - epsilon) {
          if (!improved || candidate.score.total < improved.score.total - epsilon) improved = candidate;
          if (candidate.score.total <= epsilon) return;
        } else if (rememberPlateau && plateau.length < beamWidth &&
          candidate.score.total <= origin.score.total + PROPOSED_WEIGHTS.sameExtra + epsilon) {
          plateau.push(candidate);
        }
      }
    }
    inspect(origin, true);
    if (!improved) {
      for (const state of plateau) {
        inspect(state, false);
        if (improved?.score.total <= epsilon || checks >= maxChecks) break;
      }
    }
    if (!improved) break;
    curBest = improved;
  }

  return {
    nonTieOutcomes: outcomesFromRuns(curBest.runs),
    runs: curBest.runs,
    score: curBest.score,
    violations: curBest.violations
  };
}

// 分析單條路單的所有指標
function analyzeRoad(outcomes) {
  const bigScore = luanlu.scoreRoad(outcomes).total;
  const runs = luanlu.toRuns(outcomes);
  const violations = luanlu.checkLengthCaps(runs, outcomes[0], luanlu.DEFAULTS).violations.length;
  const big = luanlu.buildBigRoadGrid(outcomes);
  const d = luanlu.scoreDerivedRoads(outcomes);
  const result = {
    bigScore,
    violations,
    overallRedRatio: d.redRatio,
    maxLongestRun: d.longestRun,
    sumRunsGe4: 0,
    sumRunsGe5: 0,
    sumRunsGe6: 0
  };

  for (const { key, offset } of luanlu.DERIVED_ROADS) {
    const marks = d.marks[key];
    const seq = d.sequences[key];
    const n = marks.length;
    let red = 0, trans = 0, curAlt = 1, maxAlt = 1, altGe5 = 0;
    for (let i = 0; i < n; i++) {
      if (marks[i] === 'R') red++;
      if (i > 0) {
        if (marks[i] !== marks[i - 1]) {
          trans++;
          curAlt++;
          if (curAlt > maxAlt) maxAlt = curAlt;
        } else {
          if (curAlt >= 5) altGe5++;
          curAlt = 1;
        }
      }
    }
    if (curAlt >= 5) altGe5++;

    // 分別統計紅串與藍串長度
    let redRunsGe4 = 0, blueRunsGe4 = 0, runsGe4 = 0, runsGe5 = 0, runsGe6 = 0;
    let fakeBreakCount = 0; // >=3紅 + 1藍 + >=3紅（一藍假斷紅龍）
    const firstMark = marks[0];
    for (let idx = 0; idx < seq.length; idx++) {
      const r = seq[idx];
      const color = (idx % 2 === 0) ? firstMark : (firstMark === 'R' ? 'B' : 'R');
      if (r >= 4) {
        runsGe4++;
        if (color === 'R') redRunsGe4++;
        else blueRunsGe4++;
      }
      if (r >= 5) runsGe5++;
      if (r >= 6) runsGe6++;
      if (idx >= 2 && color === 'R' && r >= 3 && seq[idx - 1] === 1 && seq[idx - 2] >= 3) {
        fakeBreakCount++;
      }
    }

    // 拆解頂格 (row=0) 與直落格 (row=1, row>=2) 的紅球比例
    let r0R = 0, r0All = 0, r1R = 0, r1All = 0, r2R = 0, r2All = 0;
    for (let col = 0; col < big.cols; col++) {
      for (let row = 0; row < big.rows; row++) {
        if (!big.grid[row] || !big.grid[row][col]) break;
        if (col < offset || (col === offset && row === 0)) continue;
        let isRed;
        if (row === 0) {
          let h1 = 0, h2 = 0;
          for (let r = 0; r < 6; r++) if (big.grid[r][col - 1]) h1++; else break;
          for (let r = 0; r < 6; r++) if (big.grid[r][col - offset - 1]) h2++; else break;
          isRed = (h1 === h2);
          r0All++; if (isRed) r0R++;
        } else {
          const a = !!(big.grid[row] && big.grid[row][col - offset]);
          const b = !!(big.grid[row - 1] && big.grid[row - 1][col - offset]);
          isRed = (a === b);
          if (row === 1) { r1All++; if (isRed) r1R++; }
          else { r2All++; if (isRed) r2R++; }
        }
      }
    }

    result.sumRunsGe4 += runsGe4;
    result.sumRunsGe5 += runsGe5;
    result.sumRunsGe6 += runsGe6;

    result[key] = {
      redRatio: n ? red / n : 0,
      longestRun: d[key].longestRun,
      runsGe4,
      redRunsGe4,
      blueRunsGe4,
      runsGe5,
      runsGe6,
      altRatio: n > 1 ? trans / (n - 1) : 0,
      maxAlt,
      altGe5,
      fakeBreakCount,
      seqScore: luanlu.scoreSequence(seq).total,
      r0RedRatio: r0All ? r0R / r0All : 0,
      r1RedRatio: r1All ? r1R / r1All : 0,
      r2RedRatio: r2All ? r2R / r2All : 0
    };
  }
  return result;
}

if (!isMainThread) {
  const { mode, indices } = workerData;
  const results = [];
  for (const idx of indices) {
    const rng = luanlu.createRng(`exp-road-${mode}-${idx}`);
    let outcomes;
    if (mode === 'natural') {
      outcomes = [];
      while (outcomes.length < 82) {
        const r = rng() * 100;
        if (r < 45.86) outcomes.push('莊');
        else if (r < 45.86 + 44.62) outcomes.push('閒');
      }
    } else if (mode === 'naturalWithTies82') {
      outcomes = [];
      for (let round = 0; round < 82; round++) {
        const r = rng() * 100;
        if (r < 45.86) outcomes.push('莊');
        else if (r < 45.86 + 44.62) outcomes.push('閒');
      }
    } else if (mode === 'currentBig') {
      outcomes = luanlu.generateRoad({ scoreMode: 'big' }, rng).nonTieOutcomes;
    } else if (mode === 'currentBoth') {
      outcomes = luanlu.generateRoad({ scoreMode: 'both' }, rng).nonTieOutcomes;
    } else if (mode === 'proposed') {
      outcomes = generateRoadProposed({ scoreMode: 'both' }, rng).nonTieOutcomes;
    }
    results.push(analyzeRoad(outcomes));
  }
  parentPort.postMessage(results);
} else {
  async function runGroup(mode, count) {
    const numWorkers = Math.min(os.cpus().length, 16);
    const buckets = Array.from({ length: numWorkers }, () => []);
    for (let i = 0; i < count; i++) buckets[i % numWorkers].push(i);
    const chunks = await Promise.all(buckets.map(indices => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { mode, indices } });
      worker.on('message', resolve);
      worker.on('error', reject);
    })));
    return chunks.flat();
  }

  function statsOf(arr) {
    const n = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const sd = Math.sqrt(variance);
    const sorted = [...arr].sort((a, b) => a - b);
    const pct = p => sorted[Math.floor((n - 1) * p)];
    return {
      mean, sd, min: sorted[0], p10: pct(0.1), p25: pct(0.25),
      p50: pct(0.5), p75: pct(0.75), p90: pct(0.9), max: sorted[n - 1]
    };
  }

  function summarizeGroup(items) {
    const n = items.length;
    const out = {
      count: n,
      bigScore: statsOf(items.map(x => x.bigScore)),
      violationRate: items.filter(x => x.violations > 0).length / n,
      overallRedRatio: statsOf(items.map(x => x.overallRedRatio * 100)),
      maxLongestRun: statsOf(items.map(x => x.maxLongestRun)),
      maxLongestGt6Rate: items.filter(x => x.maxLongestRun > 6).length / n * 100,
      maxLongestGe6Rate: items.filter(x => x.maxLongestRun >= 6).length / n * 100,
      sumRunsGe4: statsOf(items.map(x => x.sumRunsGe4)),
      sumRunsGe5: statsOf(items.map(x => x.sumRunsGe5)),
      sumRunsGe6: statsOf(items.map(x => x.sumRunsGe6))
    };
    for (const { key } of luanlu.DERIVED_ROADS) {
      const sub = items.map(x => x[key]);
      const reds = sub.map(x => x.redRatio * 100);
      const longs = sub.map(x => x.longestRun);
      out[key] = {
        redRatio: statsOf(reds),
        redGe60Rate: reds.filter(r => r >= 60).length / n * 100,
        redGe65Rate: reds.filter(r => r >= 65).length / n * 100,
        redIn45To55Rate: reds.filter(r => r >= 45 && r <= 55).length / n * 100,
        longestRun: statsOf(longs),
        longestGe6Rate: longs.filter(l => l >= 6).length / n * 100,
        longestGt6Rate: longs.filter(l => l > 6).length / n * 100,
        runsGe4: statsOf(sub.map(x => x.runsGe4)),
        redRunsGe4: statsOf(sub.map(x => x.redRunsGe4)),
        blueRunsGe4: statsOf(sub.map(x => x.blueRunsGe4)),
        runsGe5: statsOf(sub.map(x => x.runsGe5)),
        runsGe6: statsOf(sub.map(x => x.runsGe6)),
        altRatio: statsOf(sub.map(x => x.altRatio * 100)),
        maxAlt: statsOf(sub.map(x => x.maxAlt)),
        altGe5: statsOf(sub.map(x => x.altGe5)),
        fakeBreakCount: statsOf(sub.map(x => x.fakeBreakCount)),
        seqScore: statsOf(sub.map(x => x.seqScore)),
        r0RedRatio: statsOf(sub.map(x => x.r0RedRatio * 100)),
        r1RedRatio: statsOf(sub.map(x => x.r1RedRatio * 100)),
        r2RedRatio: statsOf(sub.map(x => x.r2RedRatio * 100))
      };
    }
    return out;
  }

  (async () => {
    const t0 = Date.now();
    console.log(`開始執行實驗（每組 N = ${SAMPLE_SIZE}，使用 ${Math.min(os.cpus().length, 16)} 個 Worker 執行緒）...`);
    const natural = summarizeGroup(await runGroup('natural', SAMPLE_SIZE));
    const naturalWithTies82 = summarizeGroup(await runGroup('naturalWithTies82', SAMPLE_SIZE));
    const currentBig = summarizeGroup(await runGroup('currentBig', SAMPLE_SIZE));
    const currentBoth = summarizeGroup(await runGroup('currentBoth', SAMPLE_SIZE));
    const proposed = summarizeGroup(await runGroup('proposed', SAMPLE_SIZE));

    const summary = { natural, naturalWithTies82, currentBig, currentBoth, proposed };
    const outPath = path.resolve(__dirname, 'experiment-results.json');
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`全部完成！耗時 ${((Date.now() - t0) / 1000).toFixed(1)} 秒。結果已存至 ${outPath}`);

    for (const [label, g] of [
      ['自然隨機 (82局有效莊閒)', natural],
      ['自然隨機 (含和局共82局，約74局莊閒)', naturalWithTies82],
      ['現行預設 (scoreMode=big)', currentBig],
      ['現行下三路 (scoreMode=both)', currentBoth],
      ['建議改法 (Proposed)', proposed]
    ]) {
      console.log(`\n==================== ${label} (N=${g.count}) ====================`);
      console.log(`大路規律分: ${g.bigScore.mean.toFixed(2)} (SD=${g.bigScore.sd.toFixed(2)}) | 行上限違規率: ${(g.violationRate * 100).toFixed(1)}%`);
      console.log(`三路合計紅比例: ${g.overallRedRatio.mean.toFixed(2)}% | 三路最大最長同色: avg=${g.maxLongestRun.mean.toFixed(2)} (p50=${g.maxLongestRun.p50}, p90=${g.maxLongestRun.p90}, max=${g.maxLongestRun.max}, >6佔${g.maxLongestGt6Rate.toFixed(1)}%)`);
      console.log(`三路合計同色串數: 長>=4 avg=${g.sumRunsGe4.mean.toFixed(2)} | 長>=5 avg=${g.sumRunsGe5.mean.toFixed(2)} | 長>=6 avg=${g.sumRunsGe6.mean.toFixed(2)}`);
      for (const { key, label: rLabel } of luanlu.DERIVED_ROADS) {
        const r = g[key];
        console.log(`  【${rLabel} (${key})】`);
        console.log(`    紅比例: 平均 ${r.redRatio.mean.toFixed(2)}% (SD=${r.redRatio.sd.toFixed(2)}%, P10=${r.redRatio.p10.toFixed(1)}%, P50=${r.redRatio.p50.toFixed(1)}%, P90=${r.redRatio.p90.toFixed(1)}%, 範圍 ${r.redRatio.min.toFixed(1)}%～${r.redRatio.max.toFixed(1)}%)`);
        console.log(`    紅比例分布: 45~55%均衡區間佔 ${r.redIn45To55Rate.toFixed(1)}% | >=60%佔 ${r.redGe60Rate.toFixed(1)}% | >=65%佔 ${r.redGe65Rate.toFixed(1)}%`);
        console.log(`    最長同色串: 平均 ${r.longestRun.mean.toFixed(2)} (P50=${r.longestRun.p50}, P90=${r.longestRun.p90}, max=${r.longestRun.max}, >=6佔 ${r.longestGe6Rate.toFixed(1)}%, >6佔 ${r.longestGt6Rate.toFixed(1)}%)`);
        console.log(`    長>=4同色串數: 平均 ${r.runsGe4.mean.toFixed(2)} (紅串 ${r.redRunsGe4.mean.toFixed(2)} / 藍串 ${r.blueRunsGe4.mean.toFixed(2)}) | 長>=5: ${r.runsGe5.mean.toFixed(2)} | 長>=6: ${r.runsGe6.mean.toFixed(2)}`);
        console.log(`    其他規律: 紅藍交替率=${r.altRatio.mean.toFixed(2)}% | 最長單跳=${r.maxAlt.mean.toFixed(2)} | 一藍假斷紅龍=${r.fakeBreakCount.mean.toFixed(2)}次 | 同色段規律分=${r.seqScore.mean.toFixed(1)}`);
        console.log(`    各列紅比例: 頂格(row=0)=${r.r0RedRatio.mean.toFixed(1)}% | 第2格(row=1)=${r.r1RedRatio.mean.toFixed(1)}% | 第3格+(row>=2)=${r.r2RedRatio.mean.toFixed(1)}%`);
      }
    }
  })();
}
