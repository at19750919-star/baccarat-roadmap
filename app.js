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

// Hosted TV starts a fresh road; local editing and previews retain their records.
const localRoadmap = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const hostedTV = !!document.querySelector('.tv-app') && !localRoadmap;
const beadPreview = !!document.querySelector('.tv-app') && !hostedTV && new URLSearchParams(location.search).get('preview') === 'beads';
const LS_KEY = beadPreview ? 'baccarat_beads_preview_v1' : 'baccarat_road_rounds_v1';
const SAVED_ROADS_KEY = "at_baccarat_saved_roads_v1";

function loadSavedRoadmaps() {
  try {
    const raw = localStorage.getItem(SAVED_ROADS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function nextDefaultRoadmapName(list) {
  let max = 0;
  for (const item of list) {
    const m = String(item?.name || '').match(/^路單-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `路單-${String(max + 1).padStart(3, '0')}`;
}

async function saveRoadmap() {
  const backup = window.RoadBackup;
  if (backup?.busy) return null;
  if (!Array.isArray(state.rounds) || state.rounds.length === 0) {
    alert('請先輸入路單紀錄再儲存！');
    return null;
  }
  const list = loadSavedRoadmaps();
  const defaultName = nextDefaultRoadmapName(list);
  const rawName = prompt('請輸入路單名稱（保留本機清單與 JSON 下載，並送出 JSON＋PNG 雲端備份）：', defaultName);
  if (rawName === null) return null;
  const name = rawName.trim() || defaultName;
  const outcomes = state.rounds.map(rd => rd.r === 'B' ? '莊' : rd.r === 'P' ? '閒' : '和');
  const nonTieOutcomes = outcomes.filter(o => o === '莊' || o === '閒');
  const banker = state.rounds.filter(rd => rd.r === 'B').length;
  const player = state.rounds.filter(rd => rd.r === 'P').length;
  const tie = state.rounds.filter(rd => rd.r === 'T').length;
  const entry = {
    id: `road-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    createdAt: new Date().toISOString(),
    counts: { banker, player, tie, total: state.rounds.length },
    outcomes,
    nonTieOutcomes,
    rounds: state.rounds.map(rd => ({ r: rd.r, bp: !!rd.bp, pp: !!rd.pp, l6: !!rd.l6, l7: rd.l7 || null, s7: rd.s7 || null, tiger: rd.tiger || null }))
  };
  const filtered = list.filter(item => item && item.name !== name);
  filtered.unshift(entry);
  let listSaved = true;
  try {
    localStorage.setItem(SAVED_ROADS_KEY, JSON.stringify(filtered));
  } catch (err) {
    listSaved = false;
    console.warn('無法寫入 localStorage:', err);
  }
  try {
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeFile = name.replace(/[\\/:*?"<>|]/g, '_') || defaultName;
    a.href = url;
    a.download = `${safeFile}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('下載路單 JSON 失敗:', err);
  }
  if (backup) await backup.save(entry, { listSaved });
  else alert('已送出原本的 JSON 下載；備份模組未載入，未產生 PNG 或傳到雲端。');
  return entry;
}

// ---------- 持久化 ----------
function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state.rounds)); } catch (_) {}
}
function loadState() {
  if (hostedTV) { state.rounds = []; return; }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      if (beadPreview) state.rounds = [
        { r: 'B', l6: true }, { r: 'B', l6: true, tiger: 'small' },
        { r: 'B', l6: true, tiger: 'big' }, { r: 'P', l7: 2 },
        { r: 'P', l7: 3 }, { r: 'P', s7: 4 }, { r: 'P', s7: 5 }, { r: 'P', s7: 6 }
      ];
      return;
    }
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
  let curStartCol = -1;
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
      curStartCol = 0;
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
      // 開新欄:從「當前連勝起始欄 + 1」開始,而不是拖尾末端 + 1
      let nextCol = curStartCol + 1;
      // 避開既有格(若新欄第一格被前段拖尾佔用,往右順延)
      while (grid[0][nextCol]) nextCol++;
      curCol = nextCol;
      curRow = 0;
      curColor = color;
      curStartCol = nextCol;
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
function renderBead(rounds = state.rounds, target = null, columns = 20) {
  const el = target || document.getElementById('beadBoard');
  el.innerHTML = '';
  const rows = 6;
  const cols = columns;
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
    if (idx < rounds.length) {
      const rd = rounds[idx];
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
      if (rd.l7 || rd.s7) {
        const mark = document.createElement('span');
        mark.className = `lucky7-mark${rd.s7 ? ' super' : ''}`;
        mark.textContent = rd.s7 ? `S7×${rd.s7}` : `7×${rd.l7}`;
        bead.appendChild(mark);
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
  return { dragonIdxs, dragonSeq, color: buf.length >= minLen ? color : null };
}

// ================== 2026 次世代莊／閒長龍特效引擎 (Canvas 粒子＋雷電／烈焰＋2.8秒自動消散) ==================
function getDragonThreshold() {
  const value = Number(document.querySelector('.tv-app')?.dataset.dragonThreshold);
  return Number.isInteger(value) && value >= 2 && value <= 100 ? value : 6;
}

const DragonFx = (() => {
  const SHOWCASE_MS = 2800;
  const FADEOUT_MS = 550;
  let lastColor = null;
  let lastLen = 0;
  let hideTimer = null;
  let cleanupTimer = null;
  let rafId = null;
  let activeColor = 'B';
  let activeLen = 0;
  let startAt = 0;
  let particles = [];
  let shockwaves = [];
  let bolts = [];
  let bound = false;

  function bindOnce() {
    if (bound) return;
    bound = true;
    const overlay = document.getElementById('dragonOverlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        if (overlay.classList.contains('active')) fadeOut();
      });
    }
    const badge = document.getElementById('dragonCornerBadge');
    if (badge) {
      badge.addEventListener('click', () => {
        if (lastColor && lastLen >= getDragonThreshold()) {
          triggerShowcase(lastColor, lastLen, false);
        }
      });
    }
  }

  function spawnEffects(color, len, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.46;
    const radiusBase = Math.min(w, h) * 0.08;
    shockwaves = [
      { x: cx, y: cy, r: radiusBase, maxR: Math.min(w, h) * 0.62, alpha: 0.95, width: 8, speed: 14 },
      { x: cx, y: cy, r: radiusBase * 0.5, maxR: Math.min(w, h) * 0.48, alpha: 0.75, width: 4, speed: 10.5 },
    ];
    particles = [];
    const count = Math.min(110, 65 + (len - 7) * 8);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * Math.min(w, h) * 0.28;
      const speed = 1.8 + Math.random() * 6.5;
      const isB = color === 'B';
      particles.push({
        x: cx + Math.cos(angle) * dist * 0.55,
        y: cy + Math.sin(angle) * dist * 0.55,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 1.6,
        vy: Math.sin(angle) * speed - (isB ? 1.8 + Math.random() * 2.8 : 0.4 + Math.random() * 1.2),
        size: 2.2 + Math.random() * 5.2,
        alpha: 0.65 + Math.random() * 0.35,
        decay: 0.008 + Math.random() * 0.012,
        hue: isB ? 18 + Math.random() * 34 : 186 + Math.random() * 32,
        light: isB ? 58 + Math.random() * 32 : 65 + Math.random() * 30,
      });
    }
    bolts = [];
    if (color === 'P') {
      for (let b = 0; b < 5; b++) {
        bolts.push(createLightningBolt(cx, cy, Math.min(w, h) * 0.44));
      }
    }
  }

  function createLightningBolt(cx, cy, reach) {
    const angle = Math.random() * Math.PI * 2;
    const segments = 9;
    const pts = [{ x: cx + Math.cos(angle) * (reach * 0.18), y: cy + Math.sin(angle) * (reach * 0.18) }];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const baseR = reach * (0.18 + t * 0.85);
      const jitter = (Math.random() - 0.5) * 42;
      const perp = angle + Math.PI * 0.5;
      pts.push({
        x: cx + Math.cos(angle) * baseR + Math.cos(perp) * jitter,
        y: cy + Math.sin(angle) * baseR + Math.sin(perp) * jitter,
      });
    }
    return { pts, life: 1.0, decay: 0.07 + Math.random() * 0.05 };
  }

  function startCanvasLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    const canvas = document.getElementById('dragonFxCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = window.innerWidth || 1920;
      const h = window.innerHeight || 1080;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    }

    const { w: initW, h: initH } = resize();
    spawnEffects(activeColor, activeLen, initW, initH);

    function frame(now) {
      const overlay = document.getElementById('dragonOverlay');
      if (!overlay || (!overlay.classList.contains('active') && !overlay.classList.contains('fading-out'))) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        rafId = null;
        return;
      }
      const { w, h } = resize();
      const cx = w * 0.5;
      const cy = h * 0.46;
      const elapsed = (now - startAt) / 1000;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      const isB = activeColor === 'B';

      // 1. 中心旋轉神光束 (God Rays)
      const rayCount = isB ? 12 : 10;
      const baseRot = elapsed * (isB ? 0.38 : -0.45);
      const rayLen = Math.min(w, h) * 0.52;
      for (let i = 0; i < rayCount; i++) {
        const a = baseRot + (i * Math.PI * 2) / rayCount;
        const spread = 0.065 + Math.sin(elapsed * 3 + i) * 0.02;
        const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, rayLen);
        if (isB) {
          grad.addColorStop(0, 'rgba(255, 220, 90, 0.24)');
          grad.addColorStop(0.55, 'rgba(255, 95, 15, 0.10)');
          grad.addColorStop(1, 'rgba(255, 40, 0, 0)');
        } else {
          grad.addColorStop(0, 'rgba(130, 240, 255, 0.24)');
          grad.addColorStop(0.55, 'rgba(37, 130, 255, 0.11)');
          grad.addColorStop(1, 'rgba(10, 60, 220, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rayLen, a - spread, a + spread);
        ctx.closePath();
        ctx.fill();
      }

      // 2. 破空震波環 (Shockwaves)
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.r += sw.speed;
        sw.alpha *= 0.94;
        if (sw.alpha <= 0.02 || sw.r >= sw.maxR) {
          shockwaves.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.lineWidth = sw.width * sw.alpha;
        ctx.strokeStyle = isB
          ? `rgba(255, 205, 70, ${sw.alpha.toFixed(3)})`
          : `rgba(100, 235, 255, ${sw.alpha.toFixed(3)})`;
        ctx.stroke();
      }

      // 3. 粒子系統（莊：上升烈焰火星；閒：冰晶雷光粒子）
      if (particles.length < 75 && elapsed < 2.4) {
        const angle = Math.random() * Math.PI * 2;
        const dist = (0.1 + Math.random() * 0.28) * Math.min(w, h);
        particles.push({
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist + (isB ? 40 : 0),
          vx: (Math.random() - 0.5) * 2.2,
          vy: isB ? -(1.8 + Math.random() * 3.4) : (Math.random() - 0.5) * 2.2,
          size: 2 + Math.random() * 4.2,
          alpha: 0.75 + Math.random() * 0.25,
          decay: 0.012 + Math.random() * 0.012,
          hue: isB ? 20 + Math.random() * 32 : 188 + Math.random() * 30,
          light: 62 + Math.random() * 30,
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx + (isB ? Math.sin(elapsed * 5 + i) * 0.5 : 0);
        p.y += p.vy;
        if (isB) p.vy -= 0.035; // 火焰浮力加速上升
        p.alpha -= p.decay;
        if (p.alpha <= 0.02) {
          particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, ${p.light}%, ${p.alpha.toFixed(3)})`;
        ctx.fill();
      }

      // 4. 閒龍專屬：即時演算雷電電弧 (Procedural Lightning Arcs)
      if (!isB) {
        if (Math.random() < 0.38 && bolts.length < 6 && elapsed < 2.5) {
          bolts.push(createLightningBolt(cx, cy, Math.min(w, h) * 0.44));
        }
        for (let i = bolts.length - 1; i >= 0; i--) {
          const b = bolts[i];
          b.life -= b.decay;
          if (b.life <= 0) {
            bolts.splice(i, 1);
            continue;
          }
          ctx.beginPath();
          ctx.moveTo(b.pts[0].x, b.pts[0].y);
          for (let k = 1; k < b.pts.length; k++) {
            ctx.lineTo(b.pts[k].x, b.pts[k].y);
          }
          ctx.strokeStyle = `rgba(56, 189, 248, ${(b.life * 0.65).toFixed(3)})`;
          ctx.lineWidth = 6 * b.life;
          ctx.stroke();

          ctx.strokeStyle = `rgba(224, 249, 255, ${b.life.toFixed(3)})`;
          ctx.lineWidth = 2.2 * b.life;
          ctx.stroke();
        }
      }

      ctx.restore();
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
  }

  function fadeOut() {
    clearTimeout(hideTimer);
    hideTimer = null;
    const overlay = document.getElementById('dragonOverlay');
    if (!overlay || !overlay.classList.contains('active')) return;
    overlay.classList.add('fading-out');
    overlay.classList.remove('active', 'hit');
    clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(() => {
      overlay.classList.remove('fading-out', 'player-dragon-overlay', 'banker-dragon-overlay');
      const video = document.getElementById('dragonVideo');
      if (video) video.pause();
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }, FADEOUT_MS);
  }

  function triggerShowcase(color, len, isComboHit) {
    bindOnce();
    const overlay = document.getElementById('dragonOverlay');
    const comboEl = document.getElementById('dragonCombo');
    const titleEl = document.getElementById('dragonTitle');
    const subEl = document.getElementById('dragonSubtitle');
    if (!overlay) return;

    clearTimeout(hideTimer);
    clearTimeout(cleanupTimer);
    activeColor = color;
    activeLen = len;
    startAt = performance.now();

    overlay.classList.remove('fading-out');
    overlay.classList.toggle('player-dragon-overlay', color === 'P');
    overlay.classList.toggle('banker-dragon-overlay', color !== 'P');
    overlay.classList.add('active');

    if (titleEl) {
      if (color === 'P') {
        titleEl.textContent = len >= 10 ? '閒家・九天蒼雷神龍' : '閒家・蒼藍雷電冰龍';
      } else {
        titleEl.textContent = len >= 10 ? '莊家・九天赤帝金龍' : '莊家・赤金烈焰神龍';
      }
    }
    if (subEl) {
      subEl.textContent = color === 'P'
        ? (len >= 10 ? 'CELESTIAL THUNDER DRAGON' : 'PLAYER DRAGON STREAK')
        : (len >= 10 ? 'IMPERIAL SOVEREIGN DRAGON' : 'BANKER DRAGON STREAK');
    }

    if (comboEl) {
      comboEl.textContent = String(len);
      comboEl.classList.remove('pop');
      void comboEl.offsetWidth;
      comboEl.classList.add('pop');
    }

    overlay.classList.remove('hit');
    if (isComboHit) {
      void overlay.offsetWidth;
      overlay.classList.add('hit');
    }

    // 有長龍影片（電視版）就播影片，播完才淡出；播不了退回原本的 2.8 秒
    const video = document.getElementById('dragonVideo');
    if (video) {
      const src = color === 'P' ? video.dataset.playerSrc : video.dataset.bankerSrc;
      if (src && video.getAttribute('src') !== src) video.setAttribute('src', src);
      video.onended = fadeOut;
      video.currentTime = 0;
      const playing = video.play();
      if (playing) playing.catch(() => { hideTimer = setTimeout(fadeOut, SHOWCASE_MS); });
      return;
    }
    startCanvasLoop();
    hideTimer = setTimeout(fadeOut, SHOWCASE_MS);
  }

  function update(dragonColor, dragonLen) {
    bindOnce();
    const badge = document.getElementById('dragonCornerBadge');
    const badgeLabel = document.getElementById('dragonBadgeLabel');
    const badgeCount = document.getElementById('dragonBadgeCount');

    if (dragonLen >= getDragonThreshold() && dragonColor) {
      if (badge) {
        badge.hidden = false;
        badge.classList.toggle('player-badge', dragonColor === 'P');
        if (badgeLabel) badgeLabel.textContent = dragonColor === 'P' ? '閒長龍' : '莊長龍';
        if (badgeCount) badgeCount.textContent = String(dragonLen);
      }
    } else if (badge) {
      badge.hidden = true;
      badge.classList.remove('player-badge');
    }

    if (dragonLen >= getDragonThreshold() + 1 && dragonColor) {
      const isNewOrIncreased = (dragonColor !== lastColor) || (dragonLen > lastLen);
      if (isNewOrIncreased) {
        const isComboHit = (dragonColor === lastColor && lastLen >= getDragonThreshold() + 1);
        triggerShowcase(dragonColor, dragonLen, isComboHit);
      }
    } else {
      fadeOut();
      const comboEl = document.getElementById('dragonCombo');
      if (comboEl) comboEl.textContent = '';
    }

    lastColor = dragonLen >= getDragonThreshold() ? dragonColor : null;
    lastLen = dragonLen >= getDragonThreshold() ? dragonLen : 0;
  }

  return { update, triggerShowcase, fadeOut };
})();

function renderBigRoad(big, options = {}) {
  const el = options.target || document.getElementById('bigRoad');
  el.innerHTML = '';
  const rows = 6;
  const cols = options.cols || 39;
  const { dragonIdxs, dragonSeq, color: dragonColor } = computeDragonIdxs(options.rounds || state.rounds, getDragonThreshold());
  const dragonLen = dragonIdxs.size;
  const hasDragon = dragonLen >= getDragonThreshold();

  // 1. 更新全螢幕巨龍展演與右上角常駐長龍徽章
  if (!options.target) {
    DragonFx.update(dragonColor, dragonLen);
  }

  // 2. 對齊全域時間軸，讓重繪（如開和局或縮放視窗）時大路波浪永遠無縫延續不跳幀
  const globalPhaseSec = (performance.now() / 1000) % 1.5;

  // 輔助函式：判斷某格是否為現任長龍的一部份
  const isDragonCell = (r, c) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const cell = big.grid[r] && big.grid[r][c];
    return cell && dragonIdxs.has(cell.idx);
  };

  const spineNodes = [];

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.gridColumn = (c + 1);
      cell.style.gridRow = (r + 1);
      
      const src = big.grid[r] && big.grid[r][c];
      const inDragon = hasDragon && src && dragonIdxs.has(src.idx);
      const seq = inDragon ? (dragonSeq.get(src.idx) || 0) : 0;
      const delayStr = inDragon ? `${(seq * 0.11 - globalPhaseSec).toFixed(3)}s` : '0s';

      // 繪製莊赤金／閒冰雷流光外框 (連 6 起即成型，只畫外圍邊框接成完整 L 型龍道)
      if (inDragon) {
        spineNodes.push({ seq, r, c });
        const neon = document.createElement('div');
        neon.className = 'dragon-neon';
        if (src.r === 'P') neon.classList.add('player-dragon');
        if (!isDragonCell(r - 1, c)) neon.classList.add('t');
        if (!isDragonCell(r + 1, c)) neon.classList.add('b');
        if (!isDragonCell(r, c - 1)) neon.classList.add('l');
        if (!isDragonCell(r, c + 1)) neon.classList.add('r');
        neon.style.setProperty('--dragon-delay', delayStr);
        cell.appendChild(neon);
      }

      if (src) {
        const circle = document.createElement('div');
        circle.className = `big-circle ${src.r}`;
        if (src.tie && src.tie > 0) circle.classList.add('tie-mark');
        if (inDragon) {
          circle.classList.add('dragon');
          if (seq === dragonLen - 1) circle.classList.add('dragon-tail');
          circle.style.setProperty('--dragon-delay', delayStr);
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

  // 3. 繪製沿著大路長龍（含第6列轉彎拖尾）流動的 SVG 能量光軌
  if (hasDragon && spineNodes.length >= 2 && !options.target) {
    spineNodes.sort((a, b) => a.seq - b.seq);
    const d = spineNodes
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${(pt.c + 0.5).toFixed(2)} ${(pt.r + 0.5).toFixed(2)}`)
      .join(' ');
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', `dragon-spine-svg ${dragonColor === 'P' ? 'player' : 'banker'}`);
    svg.setAttribute('viewBox', `0 0 ${cols} ${rows}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const basePath = document.createElementNS(svgNS, 'path');
    basePath.setAttribute('class', 'spine-base');
    basePath.setAttribute('d', d);

    const streamPath = document.createElementNS(svgNS, 'path');
    streamPath.setAttribute('class', 'spine-stream');
    streamPath.setAttribute('d', d);

    svg.appendChild(basePath);
    svg.appendChild(streamPath);
    el.appendChild(svg);
  }
}

function renderDerived(idPrefix, marks, shape, options = {}) {
  const el = options.target || document.getElementById(idPrefix);
  el.innerHTML = '';
  const rows = 6;
  const cols = options.cols || 29;
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
  const lucky7 = { 2: 0, 3: 0 };
  const superLucky7 = { 4: 0, 5: 0, 6: 0 };
  for (const rd of state.rounds) {
    if (rd.r === 'B') cB++;
    else if (rd.r === 'P') cP++;
    else if (rd.r === 'T') cT++;
    if (rd.bp) cBP++;
    if (rd.pp) cPP++;
    if (rd.l6) cL6++;
    if (rd.l7 === 2 || rd.l7 === 3) lucky7[rd.l7]++;
    if (rd.s7 === 4 || rd.s7 === 5 || rd.s7 === 6) superLucky7[rd.s7]++;
  }
  document.getElementById('cntB').textContent = cB;
  document.getElementById('cntP').textContent = cP;
  document.getElementById('cntT').textContent = cT;
  document.getElementById('cntBP').textContent = cBP;
  document.getElementById('cntPP').textContent = cPP;
  document.getElementById('cntL6').textContent = cL6;
  for (const cards of [2, 3]) {
    const el = document.getElementById(`cntL7${cards}`);
    if (el) el.textContent = lucky7[cards];
  }
  for (const cards of [4, 5, 6]) {
    const el = document.getElementById(`cntS7${cards}`);
    if (el) el.textContent = superLucky7[cards];
  }
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
    l6: r === 'B' && (!!mods.l6 || ['small', 'big'].includes(mods.tiger)),
    l7: mods.l7 || null,
    s7: mods.s7 || null,
    tiger: r === 'B' && ['small', 'big'].includes(mods.tiger) ? mods.tiger : null,
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
    playSoundFile('volume');
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
  if (!speech.enabled) stopAudio();
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
// ---------- 真人高音質音檔播報 (assets/sounds/) ----------
let currentAudioPlayer = null;

function stopAudio() {
  if (currentAudioPlayer) {
    try {
      currentAudioPlayer.pause();
      currentAudioPlayer.currentTime = 0;
    } catch (_) {}
    currentAudioPlayer = null;
  }
  if ('speechSynthesis' in window) {
    try { speechSynthesis.cancel(); } catch (_) {}
  }
}

function playSoundFile(filename) {
  if (!speech.enabled) return;
  stopAudio();
  try {
    const audio = new Audio(`assets/sounds/${filename}.mp3`);
    audio.volume = typeof speech.volume === 'number' ? speech.volume : 1.0;
    currentAudioPlayer = audio;
    audio.play().catch(() => {});
  } catch (_) {}
}

function speak(text) {
  if (!speech.enabled || !text) return;
  // 特殊獎項音檔對應
  if (text.includes('小老虎')) { playSoundFile('small_tiger'); return; }
  if (text.includes('大老虎')) { playSoundFile('big_tiger'); return; }
  if (text.includes('四張') || text.includes('4張')) { playSoundFile('s7_4'); return; }
  if (text.includes('五張') || text.includes('5張')) { playSoundFile('s7_5'); return; }
  if (text.includes('六張') || text.includes('6張')) { playSoundFile('s7_6'); return; }
  if (text.includes('大lucky') || text.includes('大lucky seven')) { playSoundFile('l7_big'); return; }
  if (text.includes('小lucky') || text.includes('小lucky seven')) { playSoundFile('l7_small'); return; }
  if (text.includes('超級') && (text.includes('seven') || text.includes('七') || text.includes('7'))) { playSoundFile('s7_4'); return; }
  if (text.includes('lucky seven') || text.includes('幸運七') || text.includes('幸運7')) { playSoundFile('l7_small'); return; }
  if (text.includes('幸運六') || text.includes('幸運6')) { playSoundFile('l6'); return; }
  if (text === '莊贏') { playSoundFile('b_win'); return; }
  if (text === '閒贏') { playSoundFile('p_win'); return; }
  if (text === '和' || text === '和贏' || text === '和局') { playSoundFile('tie'); return; }
  if (text === '莊對莊贏' || text === '莊對，莊贏') { playSoundFile('bp_b'); return; }
  if (text === '閒對閒贏' || text === '閒對，閒贏') { playSoundFile('pp_p'); return; }
  if (text.includes('莊對') && (text.includes('和') || text.includes('和局'))) { playSoundFile('bp_t'); return; }
  if (text.includes('閒對') && (text.includes('和') || text.includes('和局'))) { playSoundFile('pp_t'); return; }
  if (text === '音量') { playSoundFile('volume'); return; }

  // 兜底至 Web Speech API
  if ('speechSynthesis' in window) {
    try {
      speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = speech.lang;
      utt.rate = speech.rate;
      utt.pitch = speech.pitch;
      utt.volume = speech.volume;
      if (speech.voice) utt.voice = speech.voice;
      speechSynthesis.speak(utt);
    } catch (_) {}
  }
}

// 依 action (B/P/T) 與 mods ({bp, pp, l6, tiger, l7, s7}) 播放真人播報音效
function speakAction(action, mods) {
  if (!speech.enabled) return;
  // 向後相容:舊呼叫傳 string(如 'bp') → 轉成 mods 物件
  if (typeof mods === 'string') {
    const key = mods;
    mods = {};
    if (key) mods[key] = true;
  }
  mods = mods || {};
  // 特殊彩金獨立播報 (已校正為四聲 zhòng)
  if (mods.tiger === 'small') { playSoundFile('small_tiger'); return; }
  if (mods.tiger === 'big') { playSoundFile('big_tiger'); return; }
  if (mods.l6) { playSoundFile('l6'); return; }
  if (mods.s7) {
    if (mods.s7 === 4) { playSoundFile('s7_4'); return; }
    if (mods.s7 === 5) { playSoundFile('s7_5'); return; }
    if (mods.s7 === 6) { playSoundFile('s7_6'); return; }
    playSoundFile('s7_4');
    return;
  }
  if (mods.l7) {
    if (mods.l7 === 2) { playSoundFile('l7_small'); return; }
    if (mods.l7 === 3) { playSoundFile('l7_big'); return; }
    playSoundFile('l7_small');
    return;
  }

  const bp = !!mods.bp;
  const pp = !!mods.pp;

  // 對子＋局果一氣呵成連讀
  if (bp && pp) {
    if (action === 'B') { playSoundFile('bppp_b'); return; }
    if (action === 'P') { playSoundFile('bppp_p'); return; }
    if (action === 'T') { playSoundFile('bppp_t'); return; }
  } else if (bp) {
    if (action === 'B') { playSoundFile('bp_b'); return; }
    if (action === 'P') { playSoundFile('bp_p'); return; }
    if (action === 'T') { playSoundFile('bp_t'); return; }
  } else if (pp) {
    if (action === 'B') { playSoundFile('pp_b'); return; }
    if (action === 'P') { playSoundFile('pp_p'); return; }
    if (action === 'T') { playSoundFile('pp_t'); return; }
  } else {
    // 單純局果
    if (action === 'B') { playSoundFile('b_win'); return; }
    if (action === 'P') { playSoundFile('p_win'); return; }
    if (action === 'T') { playSoundFile('tie'); return; }
  }
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
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveRoadmap);
  const setAmtBtn = document.getElementById('setAmountBtn');
  if (setAmtBtn) {
    let limitIdx = 0;
    setAmtBtn.addEventListener('click', () => {
      const inputs = document.querySelectorAll('.limit-input');
      if (!inputs.length) return;
      const target = inputs[limitIdx % inputs.length];
      target.focus();
      target.select();
      limitIdx = (limitIdx + 1) % inputs.length;
    });
  }
  const fsBtn = document.getElementById('fullscreenBtn');
  if (fsBtn) fsBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    if (fsBtn) fsBtn.classList.toggle('active', !!document.fullscreenElement);
    fitApp();
  });
  const confirmBtn = document.getElementById('confirmBtn');
  if (confirmBtn) confirmBtn.addEventListener('click', () => {
    // TODO: 確定按鈕功能待使用者指定
  });

  // 鍵盤快捷(模擬專用百家樂鍵盤):
  //   1=莊  2=閒  3=和  4=莊對  5=閒對  6=Lucky6
  //   累積按鍵 → Enter 提交(順序不限,重複按同鍵無效)
  //   範例:1→Enter = 莊;1→4→Enter = 莊對莊贏;2→4→5→Enter = 閒贏兼見莊對+閒對
  //   Backspace = 退局; Numpad7 連按兩下 = 設定金額(聚焦第一個限額輸入框)
  //   Numpad9 連按兩下 = 清(clear)
  //   Numpad8 連按兩下 = 隱藏/顯示頁面(老闆鍵,瀏覽器無法真正最小化視窗)
  const KEY_BINDINGS_STORAGE_KEY = 'baccarat_key_bindings_v1';
  let activeKeyBindings = {
    keyB: '1',
    keyP: '2',
    keyT: '3',
    keyBP: '4',
    keyPP: '5',
    keyL6: '6',
    keyTiger: '6',
    keySeven: '2',
    keyConfirm: 'Enter',
    keyUndo: 'Backspace',
    keyLimit: '7',
    keyBoss: '8',
    keyClear: '9',
    keyFullscreen: 'F',
    autoCommit: true,
    autoCommitDelay: 0.38
  };
  try {
    const savedKB = localStorage.getItem(KEY_BINDINGS_STORAGE_KEY);
    if (savedKB) Object.assign(activeKeyBindings, JSON.parse(savedKB));
  } catch (_) {}

  document.addEventListener('baccarat:keybindings-updated', e => {
    if (e.detail) Object.assign(activeKeyBindings, e.detail);
  });

  const pendingKeys = new Set();
  let autoCommitTimer = null;
  function clearAutoCommit() {
    if (autoCommitTimer) {
      clearTimeout(autoCommitTimer);
      autoCommitTimer = null;
    }
  }
  function commitOrdinary() {
    clearAutoCommit();
    if (pendingKeys.size === 0) return;
    let r = null;
    const kB = activeKeyBindings.keyB;
    const kP = activeKeyBindings.keyP;
    const kT = activeKeyBindings.keyT;
    const kBP = activeKeyBindings.keyBP;
    const kPP = activeKeyBindings.keyPP;
    const kL6 = activeKeyBindings.keyL6;
    const kTiger = activeKeyBindings.keyTiger || kL6;

    if (pendingKeys.has(kB)) r = 'B';
    else if (pendingKeys.has(kP)) r = 'P';
    else if (pendingKeys.has(kT)) r = 'T';
    else if (pendingKeys.has(kL6) || pendingKeys.has(kTiger)) r = 'B'; // 幸運6 / 老虎 必為莊贏
    if (!r) { pendingKeys.clear(); return; }
    const mods = {
      bp: pendingKeys.has(kBP),
      pp: pendingKeys.has(kPP),
      l6: pendingKeys.has(kL6) || pendingKeys.has(kTiger),
    };
    speakAction(r, mods);
    addRound(r, mods);
    pendingKeys.clear();
  }
  function scheduleAutoCommit() {
    clearAutoCommit();
    if (activeKeyBindings.autoCommit === false) return;
    const delayMs = Math.round((activeKeyBindings.autoCommitDelay || 0.38) * 1000);
    autoCommitTimer = setTimeout(() => {
      autoCommitTimer = null;
      const ev = new CustomEvent('baccarat:auto-commit', { cancelable: true });
      document.dispatchEvent(ev);
      if (!ev.defaultPrevented) {
        commitOrdinary();
      }
    }, delayMs);
  }
  document.addEventListener('baccarat:cancel-pending', event => {
    // Transfer only the pending pair modifiers before discarding all ordinary keys.
    if (event.detail && typeof event.detail === 'object') {
      event.detail.pairs = {
        bp: pendingKeys.has(activeKeyBindings.keyBP),
        pp: pendingKeys.has(activeKeyBindings.keyPP)
      };
    }
    pendingKeys.clear();
    clearAutoCommit();
  });
  const DOUBLE_PRESS_MS = 250;
  const lastPressAt = new Map();
  function focusFirstLimit() {
    const input = document.querySelector('.limit-input');
    if (input) { input.focus(); input.select(); }
  }
  // 老闆鍵:把整個 .app 隱藏並蓋上仿 Windows 桌面圖層,再按一次恢復
  // 維持全螢幕狀態,網址列才不會露餡
  let pageHidden = false;
  function updateBossClock() {
    const t = document.getElementById('bossClockTime');
    const d = document.getElementById('bossClockDate');
    if (!t || !d) return;
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    t.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    d.textContent = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
  }
  function togglePageHidden() {
    const app = document.querySelector('.app');
    const boss = document.getElementById('bossScreen');
    if (!app) return;
    pageHidden = !pageHidden;
    app.style.display = pageHidden ? 'none' : '';
    if (boss) boss.classList.toggle('active', pageHidden);
    if (pageHidden) {
      updateBossClock();
    } else if (!document.fullscreenElement) {
      const root = document.documentElement;
      const req = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
      if (req) req.call(root).catch(err => console.warn('無法進入全螢幕:', err));
    }
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
  function codeToKey(code) {
    if (!code) return null;
    if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toUpperCase();
    return null;
  }
  function isMatchKey(targetKey, e) {
    if (!targetKey) return false;
    let t = String(targetKey).trim().toUpperCase();
    if (t.length === 2 && t[0] === t[1]) t = t[0];
    if (t === 'ENTER') return e.code === 'Enter' || e.code === 'NumpadEnter';
    if (t === 'BACKSPACE') return e.code === 'Backspace';
    if (t === 'SPACE') return e.code === 'Space';
    const c = codeToKey(e.code);
    return (c && c.toUpperCase() === t) || (e.key && e.key.toUpperCase() === t);
  }
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if ((isMatchKey(activeKeyBindings.keyFullscreen || 'F', e) || e.code === 'NumpadDivide') && !e.ctrlKey && !e.altKey && !e.metaKey) {
      toggleFullscreen();
      e.preventDefault();
      return;
    }
    // 退局 (Undo)
    if (isMatchKey(activeKeyBindings.keyUndo || 'Backspace', e)) {
      clearAutoCommit();
      undo();
      e.preventDefault();
      return;
    }
    // 設定金額 (連按兩次 focus 第一個限額輸入框)
    if (isMatchKey(activeKeyBindings.keyLimit || '7', e)) {
      const now = performance.now();
      const prev = lastPressAt.get('limit') || 0;
      if (now - prev <= DOUBLE_PRESS_MS) {
        lastPressAt.delete('limit');
        focusFirstLimit();
      } else {
        lastPressAt.set('limit', now);
      }
      e.preventDefault();
      return;
    }
    // 隱藏頁面 (老闆鍵，連按兩次)
    if (isMatchKey(activeKeyBindings.keyBoss || '8', e)) {
      const now = performance.now();
      const prev = lastPressAt.get('boss') || 0;
      if (now - prev <= DOUBLE_PRESS_MS) {
        lastPressAt.delete('boss');
        togglePageHidden();
      } else {
        lastPressAt.set('boss', now);
      }
      e.preventDefault();
      return;
    }
    // 清空路單 (連按兩次)
    if (isMatchKey(activeKeyBindings.keyClear || '9', e)) {
      const now = performance.now();
      const prev = lastPressAt.get('clear') || 0;
      if (now - prev <= DOUBLE_PRESS_MS) {
        lastPressAt.delete('clear');
        clearAll();
      } else {
        lastPressAt.set('clear', now);
      }
      e.preventDefault();
      return;
    }
    const keyChar = codeToKey(e.code);
    const validKeyList = [
      activeKeyBindings.keyB,
      activeKeyBindings.keyP,
      activeKeyBindings.keyT,
      activeKeyBindings.keyBP,
      activeKeyBindings.keyPP,
      activeKeyBindings.keyL6,
      activeKeyBindings.keyTiger || '6',
      activeKeyBindings.keySeven || '2'
    ];
    if (keyChar && validKeyList.some(k => String(k).toUpperCase() === keyChar.toUpperCase())) {
      const match = validKeyList.find(k => String(k).toUpperCase() === keyChar.toUpperCase());
      pendingKeys.add(match || keyChar);
      scheduleAutoCommit();
      e.preventDefault();
      return;
    }
    if (isMatchKey(activeKeyBindings.keyConfirm || 'Enter', e)) {
      commitOrdinary();
      e.preventDefault();
    }
  });

  renderAll();
});
