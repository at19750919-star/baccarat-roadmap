/* 百家樂板路單 — 核心邏輯
 * 資料來源:使用者手動按鈕記錄
 * 一筆 round: { r: 'B'|'P'|'T', bp: bool, pp: bool }
 *   - r  : 莊 B / 閒 P / 和 T
 *   - bp : 莊對
 *   - pp : 閒對
 * 本檔負責:
 *   1. 記錄 rounds
 *   2. 渲染珠盤路
 *   3. 從 rounds 計算「大路」(bigRoad:二維陣列 cols[col][row])
 *   4. 從大路計算三條衍生路(大眼仔 / 小路 / 甲由路)
 *   5. 下局預測(假設下一局為莊 / 為閒時,三條衍生路各自的顏色)
 *   6. 統計與 UI
 */

// ---------- 狀態 ----------
const state = {
  rounds: [],        // 全部按鈕記錄
  cols: 6,           // 珠盤路、大路的列數(高度)
};

const LS_KEY = "baccarat_road_rounds_v1";

// ---------- 持久化 ----------
function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state.rounds)); } catch (_) {}
}
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) state.rounds = arr;
  } catch (_) {}
}

// ---------- 資料轉換:從 rounds 生成大路 ----------
// 大路規則:
//   - 只看非和局的結果(B / P 會佔格子;T 疊在現任格子上畫斜線)
//   - 同結果在同一欄往下延伸,直到觸底或「撞到下一欄同行已有格」才拐彎往右(拖尾)
//   - 不同結果開新欄,從第 1 列起
//   - 和局:若目前還沒有任何非和局,暫存到「queue」;否則疊加到最近一格(該格 tieCount + 1)
//   - 對子:附加到「該局」出現的大路格子上;若該局是和局,則附加到該格(也就是最近那格)
//
// 回傳:
//   grid: 6 列 x cols 欄的二維陣列,grid[row][col] = cell or null
//     cell = { r: 'B'|'P', tie: 0, pairB: bool, pairP: bool, idx: 該局在 rounds 的 index }
//   columns: cols 陣列,每個欄只存該欄最後一個 cell 的 row、主色
function buildBigRoad(rounds) {
  const rows = 6;
  const grid = []; // grid[row] = { col: cell }
  for (let r = 0; r < rows; r++) grid.push({});

  let curCol = -1;
  let curRow = -1;
  let curColor = null;
  let maxCol = -1;

  // 取最後一格 cell 指標
  function lastCell() {
    if (curCol < 0 || curRow < 0) return null;
    return grid[curRow][curCol] || null;
  }

  // 把 cell 放到 (row, col);若該欄更長就擴張 maxCol
  function putCell(row, col, cell) {
    grid[row][col] = cell;
    if (col > maxCol) maxCol = col;
  }

  // 給定要寫入的下一個非和局結果(B 或 P),決定它落在哪個 (row, col)
  function placeNext(color) {
    // 第一筆
    if (curCol < 0) {
      curCol = 0;
      curRow = 0;
      curColor = color;
      return { row: 0, col: 0 };
    }
    if (color === curColor) {
      // 嘗試往下
      let nextRow = curRow + 1;
      // 條件:沒超過底部 & 下方該格還沒被佔
      if (nextRow < rows && !grid[nextRow][curCol]) {
        curRow = nextRow;
        return { row: nextRow, col: curCol };
      }
      // 拖尾:往右走,row 停在 curRow
      let nextCol = curCol + 1;
      // 若 nextCol 同 row 已被佔(例如來自更早的紀錄),繼續往右
      while (grid[curRow][nextCol]) nextCol++;
      curCol = nextCol;
      return { row: curRow, col: nextCol };
    } else {
      // 開新欄
      let nextCol = curCol + 1;
      // 避開既有格(罕見;初始化時通常不會發生)
      while (grid[0][nextCol]) nextCol++;
      curCol = nextCol;
      curRow = 0;
      curColor = color;
      return { row: 0, col: nextCol };
    }
  }

  let tieQueueOnStart = 0; // 開局前全部都是和局時累積的和數

  for (let i = 0; i < rounds.length; i++) {
    const rd = rounds[i];
    if (rd.r === 'T') {
      const lc = lastCell();
      if (lc) {
        lc.tie = (lc.tie || 0) + 1;
      } else {
        tieQueueOnStart += 1;
      }
      // 和局可能帶對子(罕見但合法)
      if (lc) {
        if (rd.bp) lc.pairB = true;
        if (rd.pp) lc.pairP = true;
      }
      continue;
    }
    // B 或 P
    const pos = placeNext(rd.r);
    const cell = {
      r: rd.r,
      tie: 0,
      pairB: !!rd.bp,
      pairP: !!rd.pp,
      idx: i,
    };
    // 如果這是第一個非和局,把開局時累積的和數掛上去
    if (tieQueueOnStart > 0 && curCol === 0 && curRow === 0 && pos.row === 0 && pos.col === 0) {
      cell.tie = tieQueueOnStart;
      tieQueueOnStart = 0;
    }
    putCell(pos.row, pos.col, cell);
  }

  return { grid, cols: maxCol + 1, rows };
}

// 取某欄的高度(連續從 row 0 開始有多少格):
// 注意:欄可能因為拖尾而「中斷」,高度以最頂端連續段為準(傳統板路定義)
function columnHeight(grid, col, maxRows) {
  let h = 0;
  for (let r = 0; r < maxRows; r++) {
    if (grid[r][col]) h++;
    else break;
  }
  return h;
}

// 取某欄是否存在某 row(用於「有無」判斷)
function hasAt(grid, col, row) {
  return !!(grid[row] && grid[row][col]);
}

// ---------- 衍生路演算法 ----------
// 傳入大路 grid(6 列 × N 欄)與 offset(大眼仔=1, 小路=2, 甲由路=3)
// 對每一個「從 col = offset + 1 起,且該欄存在」的非和局主格子,
// 我們要判斷它是「紅」還是「藍」:
//   - 當該格位於「新一欄」的開頭(row === 0,或前一列同欄是空):比較 col-offset 欄與 col-offset-1 欄的高度
//     相等 → 紅;不等 → 藍
//   - 否則(延續同欄往下拖):看「前 offset 欄同 row 的左鄰(col-offset, row)」與(col-offset, row-1)
//     兩格是否都存在:兩格都有或都沒有 → 紅(齊整);只有一格 → 藍(不齊整)
//
// 這是通用「大眼仔」式判斷,大眼仔 offset=1、小路 offset=2、甲由路 offset=3。

function buildDerivedRoad(bigGrid, offset, bigCols, bigRows) {
  // 收集「判斷點」順序:從大路遍歷,遇到 col >= offset+1 的格子才產出一筆
  // 遍歷順序:逐欄(左到右),每欄逐列(上到下),這樣衍生路的排列順序與大路對應
  const marks = []; // 'R' | 'B'(這裡的 R/B 指紅/藍,不是莊/閒)
  for (let col = 0; col < bigCols; col++) {
    for (let row = 0; row < bigRows; row++) {
      if (!hasAt(bigGrid, col, row)) break; // 該欄到底
      if (col < offset + 1) continue; // 還沒到判斷起點
      let mark;
      // 判斷「此格是否為該欄的第一格」:row === 0 → 新欄開頭
      if (row === 0) {
        // 比較兩欄高度
        const hL1 = columnHeight(bigGrid, col - offset - 1, bigRows);
        const hL2 = columnHeight(bigGrid, col - offset, bigRows);
        mark = (hL1 === hL2) ? 'R' : 'B';
      } else {
        // 延續:檢查「左 offset 欄、同 row」與「左 offset 欄、row-1」是否兩格都有/都沒有
        const a = hasAt(bigGrid, col - offset, row);
        const b = hasAt(bigGrid, col - offset, row - 1);
        mark = (a === b) ? 'R' : 'B';
      }
      marks.push(mark);
    }
  }
  return marks;
}

// 把 marks(線性序列)排成 6xN 網格:同色往下,不同色換欄,拖尾
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
      if (nr < rows && !grid[nr][curCol]) {
        curRow = nr;
      } else {
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

// ---------- 下局預測 ----------
// 對三條衍生路各自判斷:若下一局是 B(或 P),衍生路上會多一顆什麼顏色的點
function predictNextMark(rounds, nextColor, offset) {
  const hypo = rounds.concat([{ r: nextColor, bp: false, pp: false }]);
  const big = buildBigRoad(hypo);
  const marks = buildDerivedRoad(big.grid, offset, big.cols, big.rows);
  const origMarks = buildDerivedRoad(buildBigRoad(rounds).grid, offset,
                                     buildBigRoad(rounds).cols,
                                     buildBigRoad(rounds).rows);
  if (marks.length > origMarks.length) {
    return marks[marks.length - 1]; // 'R' or 'B'
  }
  return null; // 新增這局不產生衍生路的新點
}

// ---------- 渲染 ----------
function renderBead() {
  const el = document.getElementById('beadBoard');
  el.innerHTML = '';
  const rows = 6;
  const cols = 20;
  // 依序填入:每欄 6 格,填滿才換欄
  const cells = rows * cols;
  for (let i = 0; i < cells; i++) {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.style.gridColumn = (col + 1);
    cell.style.gridRow = (row + 1);
    // rounds 依序填充
    const idx = col * rows + row;
    if (idx < state.rounds.length) {
      const rd = state.rounds[idx];
      const bead = document.createElement('div');
      bead.className = `bead ${rd.r}`;
      if (rd.bp) bead.classList.add('pair-bp');
      if (rd.pp) bead.classList.add('pair-pp');
      if (rd.l6) {
        bead.classList.add('l6');
        bead.textContent = '6';
      } else {
        bead.textContent = rd.r === 'B' ? '莊' : rd.r === 'P' ? '閒' : '和';
      }
      cell.appendChild(bead);
    }
    el.appendChild(cell);
  }
}

// 只對「當前進行中的連勝」做動畫:
// 從頭走訪累積 buf(遇到和局不打斷、遇到對色重置),走完後若最後一段 >= minLen 才點亮;
// 一旦出現對色,buf 立刻重置 → 歷史龍段不再閃爍
function computeDragonIdxs(rounds, minLen) {
  minLen = minLen || 6;
  const dragonIdxs = new Set();
  const dragonSeq = new Map(); // idx -> 該格在龍內的序位(0-based,用於動畫波浪延遲)
  let buf = [];
  let color = null;
  for (let i = 0; i < rounds.length; i++) {
    const rd = rounds[i];
    if (rd.r === 'T') continue;
    if (rd.r === color) {
      buf.push(i);
    } else {
      color = rd.r;
      buf = [i];
    }
  }
  if (buf.length >= minLen) {
    buf.forEach((i, k) => {
      dragonIdxs.add(i);
      dragonSeq.set(i, k);
    });
  }
  return { dragonIdxs, dragonSeq };
}

function renderBigRoad(big) {
  const el = document.getElementById('bigRoad');
  el.innerHTML = '';
  const rows = 6;
  const cols = 39;
  const { dragonIdxs, dragonSeq } = computeDragonIdxs(state.rounds, 6);
  const dragonLen = dragonIdxs.size;
  const isSuperDragon = dragonLen >= 7; // 連七觸發大絕招

  // 巨龍特效
  const dragonOverlay = document.getElementById('dragonOverlay');
  const dragonCombo = document.getElementById('dragonCombo');
  if (dragonOverlay) {
    if (isSuperDragon) {
      dragonOverlay.classList.add('active');
      if (dragonCombo && dragonCombo.textContent != dragonLen) {
        dragonCombo.textContent = dragonLen;
        
        // 數字彈出動畫
        dragonCombo.classList.remove('pop');
        void dragonCombo.offsetWidth; // 強制重繪以重啟動畫
        dragonCombo.classList.add('pop');

        // 整條龍跟著打擊震動特效
        dragonOverlay.classList.remove('hit');
        void dragonOverlay.offsetWidth;
        dragonOverlay.classList.add('hit');
      }
    } else {
      dragonOverlay.classList.remove('active');
      dragonOverlay.classList.remove('hit');
      if (dragonCombo) dragonCombo.textContent = '';
    }
  }

  // 輔助函式：判斷某格是否為現任長龍的一部份
  const isDragonCell = (r, c) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const cell = big.grid[r] && big.grid[r][c];
    return cell && dragonIdxs.has(cell.idx);
  };

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.gridColumn = (c + 1);
      cell.style.gridRow = (r + 1);
      
      const src = big.grid[r] && big.grid[r][c];

      // 繪製霓虹外框 (當達到連七條件且此格屬於該長龍時)
      if (isSuperDragon && src && dragonIdxs.has(src.idx)) {
        const neon = document.createElement('div');
        neon.className = 'dragon-neon';
        if (src.r === 'P') neon.classList.add('player-dragon');
        // 只繪製沒有與其他龍身相接的邊
        if (!isDragonCell(r - 1, c)) neon.classList.add('t');
        if (!isDragonCell(r + 1, c)) neon.classList.add('b');
        if (!isDragonCell(r, c - 1)) neon.classList.add('l');
        if (!isDragonCell(r, c + 1)) neon.classList.add('r');
        
        // 延遲動畫，從頭到尾亮起
        const seq = dragonSeq.get(src.idx) || 0;
        neon.style.animationDelay = `${seq * 0.08}s`;
        cell.appendChild(neon);
      }

      if (src) {
        const circle = document.createElement('div');
        circle.className = `big-circle ${src.r}`;
        if (src.tie && src.tie > 0) circle.classList.add('tie-mark');
        if (dragonIdxs.has(src.idx)) {
          circle.classList.add('dragon');
          const seq = dragonSeq.get(src.idx) || 0;
          // 波浪延遲:每顆差 0.12s,形成由頭延伸到尾的脈動
          circle.style.setProperty('--dragon-delay', `${seq * 0.12}s`);
        }
        if (src.pairB) {
          const m = document.createElement('span');
          m.className = 'mark-bp';
          circle.appendChild(m);
        }
        if (src.pairP) {
          const m = document.createElement('span');
          m.className = 'mark-pp';
          circle.appendChild(m);
        }
        cell.appendChild(circle);
      }
      el.appendChild(cell);
    }
  }
}

function renderDerived(idPrefix, marks, shape) {
  const el = document.getElementById(idPrefix);
  el.innerHTML = '';
  const rows = 6;
  const cols = 29;
  const laid = layoutDerivedMarks(marks, rows);
  const shapeClass = shape || 'hollow';
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.gridColumn = (c + 1);
      cell.style.gridRow = (r + 1);
      const m = laid.grid[r] && laid.grid[r][c];
      if (m) {
        const dot = document.createElement('div');
        dot.className = `derived-dot shape-${shapeClass}` + (m === 'B' ? ' blue' : '');
        cell.appendChild(dot);
      }
      el.appendChild(cell);
    }
  }
}

function renderStats() {
  let cB = 0, cP = 0, cT = 0, cBP = 0, cPP = 0, cL6 = 0;
  for (const rd of state.rounds) {
    if (rd.r === 'B') cB++;
    else if (rd.r === 'P') cP++;
    else if (rd.r === 'T') cT++;
    if (rd.bp) cBP++;
    if (rd.pp) cPP++;
    if (rd.l6) cL6++;
  }
  document.getElementById('cntB').textContent = cB;
  document.getElementById('cntP').textContent = cP;
  document.getElementById('cntT').textContent = cT;
  document.getElementById('cntBP').textContent = cBP;
  document.getElementById('cntPP').textContent = cPP;
  document.getElementById('cntL6').textContent = cL6;
  document.getElementById('totalCount').textContent = state.rounds.length;
}

function renderPredict() {
  const sets = [
    { key: 'BE', offset: 1 },
    { key: 'SR', offset: 2 },
    { key: 'CR', offset: 3 },
  ];
  for (const s of sets) {
    for (const color of ['B', 'P']) {
      const dot = document.getElementById(`p${s.key}_${color}`);
      if (!dot) continue;
      const m = predictNextMark(state.rounds, color, s.offset);
      dot.classList.remove('red', 'blue');
      if (m === 'R') dot.classList.add('red');
      else if (m === 'B') dot.classList.add('blue');
    }
  }
}

function renderAll() {
  const big = buildBigRoad(state.rounds);
  renderBead();
  renderBigRoad(big);
  renderDerived('bigEye', buildDerivedRoad(big.grid, 1, big.cols, big.rows), 'hollow');
  renderDerived('smallRoad', buildDerivedRoad(big.grid, 2, big.cols, big.rows), 'solid');
  renderDerived('cockroachRoad', buildDerivedRoad(big.grid, 3, big.cols, big.rows), 'slash');
  renderStats();
  renderPredict();
  saveState();
}

// ---------- 互動 ----------
function addRound(r, mods) {
  mods = mods || {};
  state.rounds.push({
    r,
    bp: !!mods.bp,
    pp: !!mods.pp,
    l6: !!mods.l6,
  });
  renderAll();
}

function undo() {
  if (state.rounds.length === 0) return;
  state.rounds.pop();
  renderAll();
}

function clearAll() {
  if (!confirm('確定要清盤?此操作無法復原')) return;
  state.rounds = [];
  renderAll();
}

// ---------- 語音播報 (Web Speech API) ----------
const SOUND_KEY = 'baccarat_sound_enabled_v1';
const speech = {
  enabled: true,           // 由音效圖示按鈕切換,localStorage 持久化
  lang: 'zh-TW',
  rate: 0.95,              // 略低於預設,字清楚又不會拖
  pitch: 1.0,
  volume: 1.0,
  voice: null,             // 啟動後挑一個中文聲音
};
function loadSoundPref() {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    speech.enabled = v !== '0';
  } catch (_) { speech.enabled = true; }
}
const VOLUME_KEY = 'baccarat_sound_volume_v1';
function loadVolumePref() {
  try {
    const v = parseFloat(localStorage.getItem(VOLUME_KEY));
    if (!isNaN(v) && v >= 0 && v <= 1) speech.volume = v;
  } catch (_) {}
}
function changeVolume(delta) {
  let v = +(speech.volume + delta).toFixed(2);
  if (v < 0.1) v = 0.1;
  if (v > 1.0) v = 1.0;
  speech.volume = v;
  try { localStorage.setItem(VOLUME_KEY, String(v)); } catch (_) {}
  // 試聽當前音量
  if (speech.enabled) {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance('音量');
    utt.lang = speech.lang;
    utt.rate = speech.rate;
    utt.pitch = speech.pitch;
    utt.volume = speech.volume;
    if (speech.voice) utt.voice = speech.voice;
    speechSynthesis.speak(utt);
  }
}
function applySoundUI() {
  const btn = document.getElementById('soundToggleBtn');
  if (!btn) return;
  btn.classList.toggle('muted', !speech.enabled);
  const label = speech.enabled ? '音效:開啟(點擊關閉)' : '音效:關閉(點擊開啟)';
  btn.title = label;
  btn.setAttribute('aria-label', label);
}
function toggleSound() {
  speech.enabled = !speech.enabled;
  try { localStorage.setItem(SOUND_KEY, speech.enabled ? '1' : '0'); } catch (_) {}
  applySoundUI();
  if (!speech.enabled && 'speechSynthesis' in window) speechSynthesis.cancel();
}
// 與百家3.0 assistant.html 同一套 voice 優先順序;
// Google 系列通常輸出比 Microsoft 大聲很多
const SPEECH_VOICE_HINTS = [
  'Google 國語',
  'Google',
  'Mei-Jia',
  'Ting-Ting',
  'Sin-ji',
  'Microsoft HsiaoChen',
  'Microsoft Yating',
  'Microsoft Zhiwei',
  'Microsoft Hanhan',
];
function pickChineseVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;
  const lower = s => String(s || '').toLowerCase();
  for (const hint of SPEECH_VOICE_HINTS) {
    const found = voices.find(v => lower(v.name).includes(lower(hint)));
    if (found) { speech.voice = found; break; }
  }
  if (!speech.voice) {
    speech.voice =
      voices.find(v => /zh.?TW/i.test(v.lang)) ||
      voices.find(v => /zh.?HK/i.test(v.lang)) ||
      voices.find(v => /zh.?CN/i.test(v.lang)) ||
      voices.find(v => /^zh/i.test(v.lang)) ||
      null;
  }
  if (speech.voice) {
    console.log('[TTS] 選用 voice:', speech.voice.name, '|', speech.voice.lang);
  }
}
function speak(text) {
  if (!speech.enabled || !text) return;
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel(); // 中斷上一句,避免疊聲
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = speech.lang;
    utt.rate = speech.rate;
    utt.pitch = speech.pitch;
    utt.volume = speech.volume;
    if (speech.voice) utt.voice = speech.voice;
    speechSynthesis.speak(utt);
  } catch (_) {}
}
// 依 action (B/P/T) 與 mods ({bp, pp, l6}) 組合語音
// Lucky6 獨立:一律播「恭喜眾幸運六」(l6 只會綁莊,不再疊加對子語音)
// 其他情況組合:[莊對][閒對] + (莊贏/閒贏/和贏)
function speakAction(action, mods) {
  // 向後相容:舊呼叫傳 string(如 'bp') → 轉成 mods 物件
  if (typeof mods === 'string') {
    const key = mods;
    mods = {};
    if (key) mods[key] = true;
  }
  mods = mods || {};
  if (mods.l6) { speak('恭喜眾幸運六'); return; }

  let prefix = '';
  if (mods.bp) prefix += '莊對';
  if (mods.pp) prefix += '閒對';

  let outcome = '';
  if (action === 'B') outcome = '莊贏';
  else if (action === 'P') outcome = '閒贏';
  else if (action === 'T') outcome = '和贏';

  speak(prefix + outcome);
}

// ---------- 截圖:把整個 .app 轉成 PNG 下載 ----------
async function takeScreenshot() {
  if (typeof html2canvas !== 'function') {
    alert('截圖套件載入失敗,請檢查網路連線。');
    return;
  }
  const target = document.querySelector('.app');
  if (!target) return;
  try {
    const canvas = await html2canvas(target, {
      backgroundColor: '#7a0b0b',
      scale: window.devicePixelRatio > 1 ? 2 : 1.5,
      useCORS: true,
      logging: false,
    });
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fname = `baccarat_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  } catch (err) {
    console.error(err);
    alert('截圖失敗:' + err.message);
  }
}

// ---------- 全螢幕切換 ----------
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    const root = document.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
    if (req) req.call(root).catch(err => console.warn('無法進入全螢幕:', err));
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exit) exit.call(document);
  }
}

// ---------- 全螢幕等比縮放:保持 1920×1080 設計稿、視口變化時等比貼合 ----------
function fitApp() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  document.documentElement.style.setProperty('--app-scale', scale);
}
window.addEventListener('resize', fitApp);

// ---------- 初始化 ----------
document.addEventListener('DOMContentLoaded', () => {
  fitApp();
  loadState();
  loadSoundPref();
  loadVolumePref();
  applySoundUI();
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn) soundBtn.addEventListener('click', toggleSound);
  const volUpBtn = document.getElementById('volumeUpBtn');
  if (volUpBtn) volUpBtn.addEventListener('click', () => changeVolume(0.2));
  const volDownBtn = document.getElementById('volumeDownBtn');
  if (volDownBtn) volDownBtn.addEventListener('click', () => changeVolume(-0.2));
  // 啟動 TTS:有些瀏覽器 voices 是非同步載入,綁 onvoiceschanged 後再選一次
  pickChineseVoice();
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = pickChineseVoice;
  }
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mods = {};
      if (btn.dataset.mod) mods[btn.dataset.mod] = true;
      speakAction(btn.dataset.action, mods);
      addRound(btn.dataset.action, mods);
    });
  });
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  const shotBtn = document.getElementById('screenshotBtn');
  if (shotBtn) shotBtn.addEventListener('click', takeScreenshot);
  const fsBtn = document.getElementById('fullscreenBtn');
  if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    if (fsBtn) fsBtn.classList.toggle('active', !!document.fullscreenElement);
  });
  const confirmBtn = document.getElementById('confirmBtn');
  if (confirmBtn) confirmBtn.addEventListener('click', () => {
    // TODO: 確定按鈕功能待使用者指定
  });

  // 鍵盤快捷(模擬專用百家樂鍵盤):
  //   1=莊  2=閒  3=和  4=莊對  5=閒對  6=Lucky6
  //   累積按鍵 → Enter 提交(順序不限,重複按同鍵無效)
  //   範例:1→Enter = 莊;1→4→Enter = 莊對莊贏;2→4→5→Enter = 閒贏兼見莊對+閒對
  //   Numpad7 單擊 = 退(undo),連按兩下 = 設定金額(聚焦第一個限額輸入框)
  //   Numpad9 連按兩下 = 清(clear)
  //   Numpad8 連按兩下 = 全螢幕切換
  const pendingKeys = new Set();
  const DOUBLE_PRESS_MS = 250;
  const lastPressAt = new Map();
  const pendingSingleTimer = new Map();
  function focusFirstLimit() {
    const input = document.querySelector('.limit-input');
    if (input) { input.focus(); input.select(); }
  }
  // 限額輸入框內:Enter = 下一個輸入框(最後一個則失焦)、Esc = 失焦回主操作區
  // 為了配合沒有 Tab 的小鍵盤
  document.querySelectorAll('.limit-input').forEach((input, idx, list) => {
    input.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        input.blur();
        e.preventDefault();
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        const next = list[idx + 1];
        if (next) { next.focus(); next.select(); }
        else input.blur();
        e.preventDefault();
      }
    });
  });
  function codeToDigit(code) {
    if (!code) return null;
    if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    return null;
  }
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if ((e.code === 'KeyF' || e.code === 'NumpadDivide') && !e.ctrlKey && !e.altKey && !e.metaKey) {
      toggleFullscreen();
      e.preventDefault();
      return;
    }
    // Numpad7:單擊 undo、雙擊 設定金額
    if (e.code === 'Numpad7') {
      const now = performance.now();
      const prev = lastPressAt.get(e.code) || 0;
      if (now - prev <= DOUBLE_PRESS_MS) {
        lastPressAt.delete(e.code);
        const t = pendingSingleTimer.get(e.code);
        if (t) { clearTimeout(t); pendingSingleTimer.delete(e.code); }
        focusFirstLimit();
      } else {
        lastPressAt.set(e.code, now);
        const t = setTimeout(() => {
          pendingSingleTimer.delete(e.code);
          lastPressAt.delete(e.code);
          undo();
        }, DOUBLE_PRESS_MS);
        pendingSingleTimer.set(e.code, t);
      }
      e.preventDefault();
      return;
    }
    // Numpad8 / Numpad9:只有雙擊動作
    if (e.code === 'Numpad8' || e.code === 'Numpad9') {
      const now = performance.now();
      const prev = lastPressAt.get(e.code) || 0;
      if (now - prev <= DOUBLE_PRESS_MS) {
        lastPressAt.delete(e.code);
        if (e.code === 'Numpad8') toggleFullscreen();
        else clearAll();
      } else {
        lastPressAt.set(e.code, now);
      }
      e.preventDefault();
      return;
    }
    const d = codeToDigit(e.code);
    if (d && '123456'.includes(d)) {
      pendingKeys.add(d);
      e.preventDefault();
      return;
    }
    if (e.code === 'NumpadEnter' || e.code === 'Enter') {
      if (pendingKeys.size === 0) return;
      let r = null;
      if (pendingKeys.has('1')) r = 'B';
      else if (pendingKeys.has('2')) r = 'P';
      else if (pendingKeys.has('3')) r = 'T';
      else if (pendingKeys.has('6')) r = 'B'; // 幸運6 必為莊贏 → 不需再按 1
      if (!r) { pendingKeys.clear(); e.preventDefault(); return; }
      const mods = {
        bp: pendingKeys.has('4'),
        pp: pendingKeys.has('5'),
        l6: pendingKeys.has('6'),
      };
      speakAction(r, mods);
      addRound(r, mods);
      pendingKeys.clear();
      e.preventDefault();
    }
  });

  renderAll();
});
