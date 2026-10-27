'use strict';

// 規律懲罰用正數累加，越低越好。更改權重只需調整此處。
const WEIGHTS = Object.freeze({ adjacent: 3, sameExtra: 5, alternating: 4,
  ordered: 3, period: 4, dominant: 3, longRed: 4, longBlue: 3 });
const DEFAULTS = Object.freeze({ count: 5, rounds: 82, maxDifference: 4, maxRun: 6,
  prefix: '路單-AT', startNumber: 1, attempts: 3000, hillSteps: 2000, seed: '',
  perSideMax: 2, combinedMax: 3, includeSingles: false, enableLengthCaps: true });

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

// 預設排除單跳；第三個參數供「單跳也算」及卡片統計使用。
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
      if (count > max) violations.push(`${label} ${length}顆欄有 ${count} 欄，超過上限 ${max} 欄`);
    }
  }
  return { ok: violations.length === 0, violations };
}

function scoreSequence(seq) {
  const reasons = [];
  let total = 0;
  function add(label, count, weight) {
    if (count > 0) { const points = count * weight; total += points; reasons.push({ label, count, points }); }
  }
  let adjacent = 0, sameExtra = 0, alternating = 0, ordered = 0, period = 0;
  let sameLength = 1, altLength = 2, orderLength = 1, direction = 0;
  for (let i = 1; i < seq.length; i++) {
    sameLength = seq[i] === seq[i - 1] ? sameLength + 1 : 1;
    if (sameLength >= 2) adjacent++;
    if (sameLength >= 3) sameExtra++;
    if (i >= 2) {
      altLength = seq[i] === seq[i - 2] && seq[i] !== seq[i - 1] ? altLength + 1 : 2;
      // ABAB 首次達四項計一次，以後每延長一項再計一次。
      if (altLength >= 4) alternating++;
    }
    const diff = seq[i] - seq[i - 1];
    if (Math.abs(diff) === 1) {
      orderLength = diff === direction ? orderLength + 1 : 2;
      // 每個最大連續遞增／遞減段只計一次。
      if (orderLength === 3) ordered++;
      direction = diff;
    } else { orderLength = 1; direction = 0; }
  }
  for (const size of [2, 3]) {
    for (let i = 0; i + size * 2 <= seq.length; i++) {
      if (seq.slice(i, i + size).every((n, j) => n === seq[i + size + j])) period++;
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
    add('某數過多（每10個百分點）', Math.max(0, (maximum / seq.length - 0.5) * 10), WEIGHTS.dominant);
  }
  return { total, reasons };
}

function scoreRoad(outcomes) {
  const sequences = getSequences(toRuns(outcomes), outcomes[0]);
  const red = scoreSequence(sequences.red), blue = scoreSequence(sequences.blue);
  const greenBanker = scoreSequence(sequences.greenBanker), greenPlayer = scoreSequence(sequences.greenPlayer);
  const reasons = [];
  for (const [key, limit, weight, label] of [['red', 3, WEIGHTS.longRed, '長段單跳'], ['blue', 4, WEIGHTS.longBlue, '長段兩顆以上']]) {
    const count = sequences[key].reduce((sum, n) => sum + Math.max(0, n - limit), 0);
    if (count) reasons.push({ label, count, points: count * weight });
  }
  const road = { total: reasons.reduce((sum, r) => sum + r.points, 0), reasons };
  return { total: red.total + blue.total + greenBanker.total + greenPlayer.total + road.total,
    red, blue, greenBanker, greenPlayer, road, reasons };
}

function normalizeOptions(options = {}) {
  const o = { ...DEFAULTS, ...options };
  const labels = { count: '條數', rounds: '局數', maxDifference: '莊閒差上限', maxRun: '長龍上限',
    startNumber: '起始編號', attempts: '每條嘗試次數', hillSteps: '爬山步數',
    perSideMax: '單邊同長度上限', combinedMax: '莊閒合計上限' };
  for (const [key, min, max] of [['count', 1, 100], ['rounds', 1, 1000], ['maxDifference', 0, 1000],
    ['maxRun', 1, 1000], ['startNumber', 0, 1000000], ['attempts', 1, 100000], ['hillSteps', 0, 100000],
    ['perSideMax', 0, 1000], ['combinedMax', 0, 1000]]) {
    if (!Number.isInteger(o[key]) || o[key] < min || o[key] > max) throw new Error(`${labels[key]}必須是 ${min}～${max} 的整數。`);
  }
  for (const key of ['includeSingles', 'enableLengthCaps']) {
    if (typeof o[key] !== 'boolean') throw new Error('同長度上限開關必須為布林值。');
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
function validRuns(runs, o) {
  return runs.length > 0 && runs.every(n => n >= 1 && n <= o.maxRun && Number.isInteger(n)) &&
    runs.reduce((a, n) => a + n, 0) === o.rounds &&
    Math.abs(runs.reduce((a, n, i) => a + (i % 2 ? -n : n), 0)) <= o.maxDifference;
}

function randomCandidate(o, rng) {
  const cap = Math.min(o.maxRun, o.rounds);
  const weights = Array.from({ length: cap }, (_, i) => [50, 25, 12, 7, 4, 2][i] || 2 * Math.pow(0.5, i - 5));
  const sum = weights.reduce((a, b) => a + b, 0);
  for (let retry = 0; retry < 100; retry++) {
    const runs = [];
    const counts = [{}, {}], total = {};
    let remaining = o.rounds;
    while (remaining) {
      // 在抽樣時排除已用盡配額的長度，包含最後截短的欄。
      const side = counts[runs.length % 2];
      let available = weights;
      if (o.enableLengthCaps) {
        available = weights.map((weight, i) => {
          const n = Math.min(i + 1, remaining);
          return (n === 1 && !o.includeSingles) ||
            ((side[n] || 0) < o.perSideMax && (total[n] || 0) < o.combinedMax) ? weight : 0;
        });
        // 配額不足時保留有界備選；roadSteps 會標示違規，不當成合格路。
        if (!available.some(Boolean)) available = weights;
      }
      let draw = rng() * (available === weights ? sum : available.reduce((a, b) => a + b, 0)), length = cap;
      for (let i = 0; i < cap; i++) { draw -= available[i]; if (draw < 0) { length = i + 1; break; } }
      length = Math.min(length, remaining); runs.push(length); remaining -= length;
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
  return toRuns(values);
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

// 同一個分步流程供 Node 同步執行與瀏覽器讓出畫面，保持種子結果一致。
function* roadSteps(options, rng) {
  const o = normalizeOptions(options);
  const first = rng() < 0.5 ? '莊' : '閒';
  let best, bestScore = Infinity, bestViolations = Infinity;
  const steps = o.attempts + o.hillSteps;
  for (let i = 0; i < steps; i++) {
    const runs = i < o.attempts ? randomCandidate(o, rng) : mutate(best, rng);
    if (validRuns(runs, o)) {
      const violations = o.enableLengthCaps ? checkLengthCaps(runs, first, o).violations.length : 0;
      const score = scoreRoad(outcomesFromRuns(runs, first)).total;
      // 合格路永遠優先。尚無合格路時，只保留已搜尋到違規項目最少的備選。
      if (violations < bestViolations || (violations === bestViolations && score <= bestScore)) {
        best = runs; bestScore = score; bestViolations = violations;
      }
    }
    if ((i + 1) % 25 === 0 || i + 1 === steps) yield (i + 1) / steps;
  }
  const nonTieOutcomes = outcomesFromRuns(best, first);
  return { nonTieOutcomes, runs: best, sequences: getSequences(best, first), score: scoreRoad(nonTieOutcomes),
    columnLengths: countColumnLengths(best, first, o),
    lengthCaps: { enabled: o.enableLengthCaps, ...(o.enableLengthCaps ? checkLengthCaps(best, first, o) : { ok: true, violations: [] }) } };
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

function initUI() {
  const form = document.getElementById('settings'), results = document.getElementById('results');
  const status = document.getElementById('status'), progress = document.getElementById('progress');
  const download = document.getElementById('download');
  let roads = [], generatedOptions, busy = false, rerollNumber = 0;
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  const element = (tag, className, text) => {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text; return node;
  };
  const points = n => Number(n.toFixed(2)).toString();
  const reasonText = reasons => reasons.length ? reasons.map(r => `${r.label}×${points(r.count)}（${points(r.points)}分）`).join('、') : '無規律扣分';
  function setBusy(value) {
    busy = value;
    form.querySelector('fieldset').disabled = value;
    results.querySelectorAll('button').forEach(button => { button.disabled = value; });
    download.disabled = value || !roads.length;
    results.setAttribute('aria-busy', String(value));
  }
  function render() {
    results.replaceChildren();
    roads.forEach((road, index) => {
      const card = element('article', 'road-card');
      const heading = element('div', 'card-heading'), title = element('div', '');
      title.append(element('h2', '', road.name));
      const b = road.nonTieOutcomes.filter(n => n === '莊').length;
      title.append(element('p', 'counts', `莊${b} / 閒${road.nonTieOutcomes.length - b} · ${road.nonTieOutcomes.length}局`));
      const score = element('div', 'score', points(road.score.total)); score.append(element('small', '', '規律總分'));
      heading.append(title, score); card.append(heading);
      const scroll = element('div', 'road-scroll'), grid = element('div', 'road-grid');
      grid.setAttribute('role', 'img'); grid.setAttribute('aria-label', `大路欄長：${road.runs.join('、')}；首欄${road.nonTieOutcomes[0]}`);
      // 超過六顆的自訂長龍，從第六列橫向延伸，並保留欄與欄的間距。
      let column = 0;
      road.runs.forEach((length, i) => {
        const side = i % 2 ? (road.nonTieOutcomes[0] === '莊' ? '閒' : '莊') : road.nonTieOutcomes[0];
        for (let j = 0; j < length; j++) {
          const cell = element('span', `road-cell ${side === '莊' ? 'banker' : 'player'}`);
          cell.style.gridRow = String(Math.min(j, 5) + 1);
          cell.style.gridColumn = String(column + Math.max(0, j - 5) + 1);
          cell.append(element('i', '', '')); grid.append(cell);
        }
        column += Math.max(1, length - 5);
      });
      grid.style.gridTemplateColumns = `repeat(${column}, 26px)`;
      scroll.append(grid); card.append(scroll);
      const stats = element('p', 'length-stats', '長度統計：');
      for (const [side, label] of [['banker', '莊'], ['player', '閒'], ['total', '合計']]) {
        stats.append(element('span', '', `${side === 'banker' ? '' : '｜'}${label} `));
        const entries = Object.entries(road.columnLengths[side]);
        if (!entries.length) stats.append(element('span', '', '無 '));
        for (const [length, count] of entries) {
          const max = side === 'total' ? generatedOptions.combinedMax : generatedOptions.perSideMax;
          stats.append(element('span', road.lengthCaps.enabled && count > max ? 'length-violation' : '', `${length}顆×${count} `));
        }
      }
      card.append(stats);
      card.append(element('p', road.lengthCaps.ok ? 'road-reasons' : 'length-violation', !road.lengthCaps.enabled ? '同長度上限：未啟用' :
        road.lengthCaps.ok ? '同長度上限：全部合格' : `同長度上限未通過（嘗試範圍內的最少違規備選）：${road.lengthCaps.violations.join('；')}`));
      for (const [key, label] of [['red', '洞'], ['blue', '柱'], ['greenBanker', '行莊'], ['greenPlayer', '行閒']]) {
        const section = element('div', `sequence ${key}`);
        const reasons = element('p', '');
        reasons.append(element('span', `term-${key}`, `${label}：`), reasonText(road.score[key].reasons));
        section.append(element('strong', '', `${label}：${road.sequences[key].join('、') || '無'}　／ ${points(road.score[key].total)}分`),
          reasons); card.append(section);
      }
      card.append(element('p', 'road-reasons', `大路：${reasonText(road.score.road.reasons)}`));
      const reroll = element('button', 'secondary', '重抽這條'); reroll.type = 'button';
      reroll.disabled = busy; reroll.addEventListener('click', () => run(index)); card.append(reroll);
      results.append(card);
    });
  }
  function readOptions() {
    const data = new FormData(form), o = {};
    for (const key of Object.keys(DEFAULTS)) o[key] = typeof DEFAULTS[key] === 'boolean' ? data.has(key) :
      key === 'prefix' || key === 'seed' ? data.get(key) : Number(data.get(key));
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
      const failed = roads.filter(road => !road.lengthCaps.ok).length;
      status.textContent = `已完成${roads.length}條${failed ? `，其中${failed}條未通過同長度上限，請查看卡片違規內容` : ''}，可下載 JSON。`;
    } catch (error) { status.textContent = `產生失敗：${error.message}`; }
    finally { setBusy(false); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); run(); });
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
if (typeof module !== 'undefined') module.exports = { WEIGHTS, DEFAULTS, toRuns, getSequences, countColumnLengths, checkLengthCaps,
  scoreSequence, scoreRoad, generateRoad, generateRoads, toImportJson, createRng };
