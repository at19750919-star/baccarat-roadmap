# 第二輪修改（優先於下方第一輪說明）

第一輪產出的 banker-stats.png / player-stats.png / tie-stats.png 顏色、字型正確，但太平、沒有幸運7的質感。這輪直接覆蓋這三張圖（只限這三張），沿用並修改 codex-tasks/generate-bead-bpt-stats.py。

1. **光影效果要跟 assets/beads/blue-seven.png 的藍底一樣**：藍底不是平塗，有左上方的亮反光（中心約 #2775f1）、主體約 #0042b2、往右下與邊緣漸暗（約 #002a78）、靠金框內側有一圈內陰影。建議做法：從 blue-seven.png 的藍底算出每個像素相對主體藍的明暗比例圖（「7」字所在區域用周圍藍底推補掉），再把這張明暗圖套到莊 #d62121、閒 #1e5ec9、和 #2ea94a 上。套完後底色主體量起來仍要是上述統計區顏色（明暗只是在它上下浮動，跟 7 的藍底浮動幅度相同）。
2. **字的效果要跟「7」一樣有立體感**：參考 blue-seven.png 裡金色「7」的浮雕、斜面高光與右下投影（投影方向、距離、柔和度照 7 量）。字色仍以白 #ffffff 為主，只加跟 7 相同手法的斜面明暗與投影，不要改成金色。
3. **字放大**：字高從約 50% 改成約圓直徑的 58%，仍視覺置中，不能碰到金框。
4. 金框維持跟 blue-seven.png 像素完全相同。
5. 完成後輸出一張三顆＋blue-seven.png 並排的對照圖到 codex-tasks/bead-bpt-stats-compare.png。

回報：三張圖底色主體實測 hex、左上反光與右下暗部實測 hex（並列出 blue-seven 對應位置的值供比較）、字高比例。

---

# 任務：重做珠子路「莊／閒／和」三顆珠子圖

工作資料夾：C:\Users\at197\OneDrive\Desktop\專案-進行中\百家樂路單

## 要產出的檔案（不要覆蓋舊檔）
- assets/beads/banker-stats.png（莊）
- assets/beads/player-stats.png（閒）
- assets/beads/tie-stats.png（和）

## 外觀要求
1. **外框跟幸運7珠子一模一樣**：參考 assets/beads/blue-seven.png（1254×1254、透明背景、金色圓框）。外圈金框的粗細、亮度、內側那圈深棕細線、圓的大小與位置都要與 blue-seven.png 相同。最穩的做法：直接從 blue-seven.png 取出金框那一圈（alpha 與金色像素）沿用，只換掉框內的底色與文字。
2. **底色跟電視版統計區一樣（純色、平塗）**：
   - 莊 #d62121
   - 和 #2ea94a
   - 閒 #1e5ec9
   可以保留跟 blue-seven.png 同程度的細微左上反光／邊緣微暗，但整體量起來要以上述顏色為主，不能明顯變暗。
3. **字型跟統計區一樣**：Noto Serif TC 最粗字重（Black／900），字色純白 #ffffff。字型檔在 C:\Windows\Fonts\NotoSerifTC-VF.ttf（可變字型，請把字重軸設到 900）。字要用程式以這個字型實際排字，不要用 AI 生圖畫字。
4. 字放在圓心、視覺置中，字高約為圓直徑的 50%（跟 blue-seven.png 裡「7」佔的比例差不多）。可加極輕的深色陰影讓白字在底色上清楚，但不要描金、不要漸層。
5. 輸出 1254×1254、透明背景 PNG。

## 不要做的事
- 不要改任何 .js / .css / .html，不要動其他圖片，不要 git commit。
- 不要覆蓋 banker.png / player.png / tie.png / blue-seven.png。
- 產圖腳本放在 codex-tasks/ 底下。

## 完成時回報
三個檔案的路徑；每張圖框內底色的實測主色（hex）；字型與字重實際設定值；跟 blue-seven.png 金框的對齊方式。
