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
function layoutDerivedMarks(marks) {
  const rows = 6;
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
  const cols = Math.max(12, Math.ceil(state.rounds.length / rows));
  el.style.gridTemplateRows = `repeat(${rows}, var(--cell))`;
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
      bead.textContent = rd.r === 'B' ? '莊' : rd.r === 'P' ? '閒' : '和';
      cell.appendChild(bead);
    }
    el.appendChild(cell);
  }
}

function renderBigRoad(big) {
  const el = document.getElementById('bigRoad');
  el.innerHTML = '';
  const rows = 6;
  const cols = Math.max(20, big.cols + 2);
  el.style.gridTemplateRows = `repeat(${rows}, var(--cell))`;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.gridColumn = (c + 1);
      cell.style.gridRow = (r + 1);
      const src = big.grid[r] && big.grid[r][c];
      if (src) {
        const circle = document.createElement('div');
        circle.className = `big-circle ${src.r}`;
        if (src.tie && src.tie > 0) circle.classList.add('tie-mark');
        if (src.pairB) circle.classList.add('pair-bp');
        if (src.pairP) circle.classList.add('pair-pp');
        cell.appendChild(circle);
      }
      el.appendChild(cell);
    }
  }
}

function renderDerived(idPrefix, marks) {
  const el = document.getElementById(idPrefix);
  el.innerHTML = '';
  const laid = layoutDerivedMarks(marks);
  const rows = 6;
  const cols = Math.max(20, laid.cols + 2);
  el.style.gridTemplateRows = `repeat(${rows}, var(--cell))`;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.gridColumn = (c + 1);
      cell.style.gridRow = (r + 1);
      const m = laid.grid[r] && laid.grid[r][c];
      if (m) {
        const dot = document.createElement('div');
        dot.className = 'derived-dot' + (m === 'B' ? ' blue' : '');
        cell.appendChild(dot);
      }
      el.appendChild(cell);
    }
  }
}

function renderStats() {
  let cB = 0, cP = 0, cT = 0, cBP = 0, cPP = 0;
  for (const rd of state.rounds) {
    if (rd.r === 'B') cB++;
    else if (rd.r === 'P') cP++;
    else if (rd.r === 'T') cT++;
    if (rd.bp) cBP++;
    if (rd.pp) cPP++;
  }
  document.getElementById('cntB').textContent = cB;
  document.getElementById('cntP').textContent = cP;
  document.getElementById('cntT').textContent = cT;
  document.getElementById('cntBP').textContent = cBP;
  document.getElementById('cntPP').textContent = cPP;
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
      const m = predictNextMark(state.rounds, color, s.offset);
      const dot = document.getElementById(`p${s.key}_${color}`);
      dot.classList.remove('red', 'blue');
      if (m === 'R') dot.classList.add('red');
      else if (m === 'B') dot.classList.add('blue');
      // null 保持灰色
    }
  }
}

function renderAll() {
  const big = buildBigRoad(state.rounds);
  renderBead();
  renderBigRoad(big);
  renderDerived('bigEye', buildDerivedRoad(big.grid, 1, big.cols, big.rows));
  renderDerived('smallRoad', buildDerivedRoad(big.grid, 2, big.cols, big.rows));
  renderDerived('cockroachRoad', buildDerivedRoad(big.grid, 3, big.cols, big.rows));
  renderStats();
  renderPredict();
  saveState();
}

// ---------- 互動 ----------
function addRound(r) {
  const bp = document.getElementById('bpToggle').checked;
  const pp = document.getElementById('ppToggle').checked;
  state.rounds.push({ r, bp, pp });
  // 按完清空對子勾選
  document.getElementById('bpToggle').checked = false;
  document.getElementById('ppToggle').checked = false;
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

// ---------- 初始化 ----------
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => addRound(btn.dataset.action));
  });
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  renderAll();
});
