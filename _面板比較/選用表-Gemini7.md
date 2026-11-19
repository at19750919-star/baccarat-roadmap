# 電視版路單設定面板選用表（Gemini7 比較版）

對應樣式檔：`_面板比較\設定面板-Gemini7.css`（可整份替換 `tv-settings-casino.css`，僅以 `#tvSettings` 前綴覆蓋，不更動 HTML／JS 與其他檔案）。

---

## 一、設計說明

### 1. 整體想法與已定案條件

本版嚴守專案 `AGENTS.md` 所有已定案限制與新版《賭金風格》技能規範：
- **主色鎖定**：對話框外框維持已定案亮紅漸層（`--panel: #a5171a` → `--panel-2: #7a0f12`）與完整 tv 紅 9 變數，確保與主畫面紅金路單一氣呵成。
- **尺寸與零捲軸**：標準尺寸 `720×887`，本機顯示「基本設定」「按鍵設定」「儲存設定」三分頁，三個分頁皆無垂直與水平捲軸。
- **外觀一律自總覽原樣複製**：每一組元件的外觀 CSS（底色、紋理、光影、框層次、邊角裝飾、形狀與 hover／active／focus／disabled 狀態）皆自 `賭場綠金-元件總覽.html` 原樣複製並套上 `#tvSettings` 選擇器前綴，不自創近似樣式、不使用無襯線字體或 Emoji。
- **同功能一款，不同功能各自挑**：把設定面板依互動語意分成 19 個功能組，善用總覽的**材質（`.skin-*`）**、**組裝式 `.kit`（底色＋紋理＋光影＋框層次＋邊角裝飾）**與**形狀（方形／正圓／膠囊／八角切角）**做出鮮明分層——讓使用者在電視遠距操作時，一眼就能辨別「可點的動作鈕」「唯一主送出鍵」「危險刪除」「低干擾取消」「單選切換」「可打字的文字欄」「可填數字與鍵位欄」「系統鎖定唯讀欄」「下拉選單」「開關與滑桿」。

### 2. 各功能組挑選思路（涵蓋材質、框層次、邊角裝飾、形狀）

- **亮紅外框 × 黑曜雙色角飾卡片**：在鎖定亮紅對話框內，將各設定區收攏進純黑菱格（`.fill-black`＋`.tex-diamond`）＋浮起（`.light-raised`）＋雙色金框（`.frame-twotone`）＋四角 L 角飾（`.corner-bracket`）的卡片，搭配兩側漸層金線小標題（`.div-line-wrap`），大幅拉升卡片內控制項對比度，亦與先前 Gemini6 的無外框柔光卡做出明確區隔。
- **形狀與裝飾按功能分工**：
  - **八角切角（`.skin-oct` / `.shape-oct`）**：整組套在 4 顆「畫面風格」單選按鈕上，選中轉金色漸層實心（`.skin-gold`），與一般方形動作鈕一眼不同。
  - **正圓（`.shape-circle`）**：頁首放大與關閉鈕採純黑放射太陽紋＋頂部高光＋雙色金框正圓鈕（36×36 等寬高）；色票、開關與滑桿滑塊亦為正圓。
  - **膠囊（`.shape-pill`）**：開關軌道（`.chip-toggle .rule-control`）與音量滑桿軌道（`.range-track`）。
  - **邊角裝飾與框層次**：卡片用四角 L 飾（`.corner-bracket`）＋雙色框（`.frame-twotone`）；一般動作按鈕全組用青銅拉絲＋立體厚壓＋四角鉚釘（`.corner-rivet`）；選中頁籤用上下金條（`.corner-bars`）；下拉選單用皮革扶手內縮車縫虛線（`.skin-leather`）；數字框用漸層金框（`.frame-gradient`）＋內凹陰影；唯讀欄用暗金虛線外框＋45° 斜紋（`.field-readonly-distinct`）。
- **四類輸入與選單一眼區分**：
  1. **文字輸入框**（版本名稱／儲存路徑／清盤提示）：高反差**淺色香檳（`.skin-light`）**亮底深褐字、左對齊，像紙張一般清楚表示可鍵入文字。
  2. **數字／可編輯鍵位欄**（桌號／靴號／尺寸／限紅 16 格／可編輯按鍵 10 格／延遲）：深暗紅內凹槽（`.light-inset`）＋漸層金框（`.frame-gradient`）＋亮金 `--disp` 空心 `0` 數字。
  3. **唯讀固定按鍵欄**（`7`、`77`、`8`、`ENTER×3`）：純黑 45° 暗金斜紋＋暗金虛線框、無內凹陰影（`.field-readonly-distinct`），一眼識別系統鎖定。
  4. **自訂下拉選單**（限紅版本）：紅調**皮革扶手（`.skin-leather`）**車縫虛線觸發鈕＋紅底金框展開清單（`.picker-list`）。
- **按鈕四層級明確不撞色**：
  - 唯一送出「儲存」：**金錠浮雕（`.skin-ingot`）**立體亮金切面。
  - 一般動作鈕（限紅新增／儲存、語音試聽 7 顆、選擇資料夾）：全頁同款**青銅拉絲立體四角鉚釘（`.kit.fill-bronze.tex-brushed.light-thick.frame-single.corner-rivet`）**。
  - 危險操作「刪除」：**紅色危險按鈕（`.tool-btn.danger` → 二次確認 `.tool-btn.danger-solid`）**。
  - 低干擾操作（恢復預設／取消）：**純文字連結按鈕（`.btn-link`）**，無框無底完全退後。

---

## 二、功能組選用表

> 下表列出之總覽 class 皆已以程式驗證存在於 `C:\Users\at197\OneDrive\Desktop\專案-進行中\ui組件\賭場綠金-元件總覽.html`，CSS 均由總覽原樣複製並對應至 `#tvSettings` 選擇器。

| 功能組 | 元素 | 元件結構（規範 4.1 名稱） | 總覽外觀（材質或 `.kit` 各項＋形狀） | 總覽 class | 理由 |
| --- | --- | --- | --- | --- | --- |
| 設定對話框外框 | `#tvSettings` | 對話彈窗與抽屜 | 鎖定亮紅面板漸層（`--panel → --panel-2`）＋對角 17px 亮金角飾 ＋ 方形 | `.dialog`、`.dialog::before`、`.dialog::after`、`.shape-square` | 嚴守已定案紅底主色與 `720×887` 尺寸，原樣複製總覽對話框金框、深影與對角角飾；直角 `0`。 |
| 頁首標題與拖曳提示 | `#tvSettingsTitle`、`.tv-drag-hint` | 頂部列與側欄（品牌標題） | 四段金色直向漸層字（`--disp` 900）＋ `.brand-rule` 豎線 | `h1`（品牌標題）、`.brand-rule` | 建立面板最高識別標題，右側以金暗豎線隔開 `--serif` 淡字提示。 |
| 頁首圖示鈕 | `#tvSettingsSizeToggle`、`#tvSettingsClose` | 圓形圖示按鈕 | 組裝式 `.kit`：純黑底（`.fill-black`）＋放射太陽紋（`.tex-sun`）＋頂部高光（`.light-gloss`）＋雙色框（`.frame-twotone`）＋ 正圓形 | `.btn-circle`、`.kit`、`.fill-black`、`.tex-sun`、`.light-gloss`、`.frame-twotone`、`.shape-circle` | 兩顆同組一致，36×36 等寬高正圓（`50%`），放射紋與同心雙金環在亮紅頁首極具辨識度；內嵌 SVG 與襯線 `×`，無 Emoji。 |
| 三分頁切換列 | `.tv-settings-tabs`、`#tvTabBasic`、`#tvTabKeys`、`#tvTabSave` | 資料夾式頁籤 | 未選：`.kit` 深色底（`.fill-dark`）＋細直條（`.tex-pin`）＋凹陷（`.light-inset`）；選中：`.kit` 純黑底（`.fill-black`）＋頂部高光（`.light-gloss`）＋上下金條（`.corner-bars`）＋ 方形 | `.tabs-folder`、`.kit`、`.fill-dark`、`.tex-pin`、`.light-inset`、`.fill-black`、`.light-gloss`、`.corner-bars`、`.shape-square` | 選中頁籤與下方黑曜卡片呼應，上下亮金條與頂部高光拉開現用頁與未選凹陷細直條頁籤；依 3.3 轉換表已改直角 `0`。 |
| 分組卡片容器 | `.tv-settings-skin`、`.tv-settings-group`、`#tvProposalLimitSettings`、`.tv-keys-subgroup`、`.tv-save-subgroup` | 金框小卡 | 組裝式 `.kit`：純黑底（`.fill-black`）＋菱格（`.tex-diamond`）＋浮起（`.light-raised`）＋雙色框（`.frame-twotone`）＋L 角飾（`.corner-bracket`）＋ 方形 | `.mini-card`、`.kit`、`.fill-black`、`.tex-diamond`、`.light-raised`、`.frame-twotone`、`.corner-bracket`、`.shape-square` | 全頁 8 張分區卡片完全同款，以黑曜菱格雙金框與 L 角飾在亮紅底上建立沉穩操作區；直角 `0`。 |
| 區段小標題 | `#tvStyleLabel`、`.tv-settings-subhead`、`.tv-keys-subhead`、`.tv-save-subhead` | 中間裝飾分隔線 | 結構自帶：兩側 `--gold-line` 漸層金線夾金色襯線標題 | `.div-line-wrap` | 全頁 9 處區段標題（含基本設定「限紅」與按鍵設定「固定快捷鍵」）統一置中並以漸層金線收攏。 |
| 單選切換組（畫面風格） | `.tv-style-options button`（4 顆） | 按鈕式單選 | 未選：八角金邊（`.skin-oct`）；選中：八角金邊內填金色漸層實心（`.skin-gold`）＋ 八角形 | `.rbtn-group`、`.rbtn-item`、`.skin-oct`、`.skin-gold`、`.shape-oct` | 4 項互斥風格整組採八角切角造型，色票 12×12 正圓，選中轉亮金實心，與下方方形動作鈕一眼分明。 |
| 一般動作按鈕 | `#tvLimitPresetAdd`、`#tvLimitPresetSave`、`.tv-mini-audio-btn`（7 顆）、`#tvPickFolderBtn` | 基本按鈕 | 組裝式 `.kit`：青銅底（`.fill-bronze`）＋拉絲（`.tex-brushed`）＋立體厚度（`.light-thick`）＋單線框（`.frame-single`）＋四角鉚釘（`.corner-rivet`）＋ 方形 | `.tool-btn`、`.kit`、`.fill-bronze`、`.tex-brushed`、`.light-thick`、`.frame-single`、`.corner-rivet`、`.shape-square` | 全頁所有常規動作按鈕 100% 同款，暖古銅拉絲、四角鉚釘與 4px 立體厚度按下下沉，清楚表達「可點擊」且絕不與刪除紅鈕或送出金錠撞色；已改直角 `0`。 |
| 主要送出鍵 | `.tv-settings-actions button[type=submit]`（「儲存」） | 基本按鈕 | 金錠浮雕（`.skin-ingot`）＋ 方形 | `.tool-btn.active`、`.skin-ingot`、`.shape-square` | 全頁唯一主要送出行動，採金屬中線切面漸層與 4px 實體厚度金錠，確立最高視覺錨點；已改直角 `0`。 |
| 低干擾按鈕 | `#tvSettingsReset`、`#tvSettingsCancel`、`#tvColorsReset`、`#tvColorReset` | 純文字連結按鈕 | 結構自帶：無底透明、金字配金色底線，Hover 發柔光 | `.btn-link` | 恢復預設與取消視覺完全退後，不與右下角金錠「儲存」爭奪焦點。 |
| 危險按鈕（兩段確認） | `#tvLimitPresetDelete`、`.is-confirm` | 紅色危險按鈕 | 輕：深底紅框紅字（`.tool-btn.danger`）；重：紅色漸層實心（`.tool-btn.danger-solid`）＋ 方形 | `.tool-btn.danger`、`.tool-btn.danger-solid`、`.shape-square` | 刪除限紅版本採兩段危險警示語意，與相鄰青銅鉚釘鈕對比強烈；已改直角 `0`。 |
| 文字輸入框 | `#tvLimitPresetName`、`#tvCustomSavePath`、`#tvClearPromptText`、`#tvCaptionText` | 基本輸入框 | 淺色香檳（`.skin-light`）＋ 方形 | `.field`、`.skin-light`、`.shape-square` | 亮米金紙質底配深褐 `--serif` 字左對齊，在黑曜卡片上高反差辨識「可自由輸入文字」；依 3.3 轉換表已改直角 `0`。 |
| 數字與可編輯鍵位輸入框 | 桌號、靴號、路單尺寸 6 格、限紅雙表 16 格、可編輯按鍵 10 格、`#tvAutoCommitDelay` | 數字框 | 組裝式 `.kit`：深色底（`.fill-dark`）＋凹陷（`.light-inset`）＋漸層金框（`.frame-gradient`）＋ 方形 | `.numbox`、`.unit`、`.kit`、`.fill-dark`、`.light-inset`、`.frame-gradient`、`.shape-square` | 深紅內凹槽配亮金 `--disp` 空心 `0` 大數字，漸層金框不佔左右寬度（完整容納 `1,500,000`），單位為暗金字；依 3.3 轉換表已改直角 `0`。 |
| 唯讀固定按鍵欄 | `#tvKeyBack7`、`#tvKeyLimit`、`#tvKeyBoss`、`#tvKeyFullscreenEnter` | 唯讀專用明顯樣式 | 結構自帶：純黑底＋45° 暗金斜紋＋暗金虛線框、無內凹陰影 ＋ 方形 | `.field-readonly-distinct`、`.shape-square` | 系統鎖定快捷鍵與可編輯深紅實框鍵位一眼區隔，依規範絕不複製 🔒 Emoji；依 3.3 轉換表已改直角 `0`。 |
| 自訂下拉選單 | 限紅版本 `.tv-select-button`＋`.tv-select-menu`、`#tvColorTarget`、`#tvSkinToggle` | 自訂下拉選單 | 觸發鈕：皮革扶手（`.skin-leather`，紅皮光澤＋內縮 4px 金線車縫虛線）；清單：紅底金框（`.picker-list`）＋ 方形 | `.picker`、`.picker-btn`、`.picker-list`、`.picker-item`、`.skin-leather`、`.shape-square` | 取代原生 `<select>`，在限紅版本列中與淺色香檳文字框、青銅鉚釘鈕、紅色危險鈕四分天下；依 3.3 轉換表已改直角 `0`。 |
| 開關 | 顯示靴號、`#tvAutoCommit`、`#tvSoundEnabled`、`#tvAutoSaveOnClear` | 勾選、單選與金色開關 | 結構自帶：立體雙環軌道（`.chip-toggle .rule-control`，開轉金漸層軌）＋正圓立體金球 ＋ 膠囊 | `.chip-toggle`、`.rule-control`、`.shape-pill`、`.shape-circle` | 4 個布林開關全頁同款，立體雙環框影讓開關在黑曜卡片上更醒目；依 3.3 轉換表軌道已改膠囊 `999px`、滑塊維持 `50%` 正圓。 |
| 單軸滑桿與音量標籤 | `#tvSoundVolume`、`#tvSoundVolumeText` | 單軸滑桿 ＋ 金色標籤 | 軌道：`.range-track`（膠囊 `999px`）；滑塊：20×20 正圓立體金球；讀數：柔和金框標籤（`.badge.soft`） | `input[type=range]`、`.range-track`、`.range-wrap`、`.badge.soft`、`.shape-pill`、`.shape-circle` | 單值音量微調，右側 `100%` 讀數以柔和金框標籤承接 `--disp` 亮金字；軌道已改膠囊 `999px`。 |
| 限紅雙表 | `.tv-limit-table`（左右兩表） | 金頭資料表 | 結構自帶：金色表頭字、暗金列底線、列懸停淡金底 ＋ 方形 | `.table` | 每表僅 4 列（少於五列依規範不用隔行換色），維持清朗數值閱讀節奏。 |
| 儲存設定列分隔 | `.tv-save-row + .tv-save-row` | 虛線分隔線 | 結構自帶：`1.5px dashed var(--gold-3)` | `.div-dashed` | 在儲存設定卡片內以總覽金色虛線輕分隔三列設定。 |
| 底部狀態訊息 | `#tvSettingsStatus` | 帶圖示與左邊色條通知 | 結構自帶：紅底＋暗金框＋左 4px 亮金條 ＋ 方形 | `.toast-bar-item` | 依規範不用裸文字顯示狀態訊息，原樣套用左金條橫幅；直角 `0`。 |

### 為何沒採用其他結構樣式

- **分頁不用「分段切換（`.tab.pill`）」或「直排側邊頁籤（`.tabs-vert`）」**：規範第 8 節明訂分段切換不適合頁面級分頁，且 720px 寬度放直排側欄會擠壓限紅雙表與按鍵雙欄；採用**資料夾式頁籤（`.tabs-folder`）**既與下方黑曜分區卡片自然銜接，又和原版／Gemini6 的底線頁籤做出視覺變化。
- **畫面風格不用「卡片式單選（`.rcard-group`）」**：規範第 5 節指出卡片式單選適合要附說明的互斥選項，此處 4 項僅為單行名稱與色票，採用**按鈕式單選（`.rbtn-item`）搭配八角金邊（`.skin-oct`）**兼顧單列高度與搶眼形狀區隔。
- **限紅雙表不用「隔行換色表格（`.table.zebra`）」**：每張限紅表僅 4 列，規範第 15 節明訂不適合少於五列之表格，故用標準**金頭資料表（`.table`）**。
- **數字欄不用「數碼管（`.dx-seg`）」、按鈕不用「籌碼鈕（`.dx-chip`）」或「燈泡跑馬燈（`.skin-bulb`）」**：數碼管不適合可編輯輸入；籌碼鈕僅限下注面額語意；燈泡跑馬燈每邊需 12px 留白，套在 38px 高的操作按鈕或 7 連排窄試聽鈕會壓迫文字。

---

## 三、第 5 節驗收紀錄

### 1. 功能分組檢查（規範 5.7）

| 檢查項目 | 檢查結果 |
| --- | --- |
| 同功能全頁同一款 | 頁首 2 顆圓鈕、4 顆風格八角單選鈕、全部常規動作鈕（新增／限紅儲存／試聽 7 顆／選擇資料夾）、2 顆低干擾連結鈕、3 個香檳文字框、所有數字與可編輯鍵位框、4 個唯讀固定鍵、4 個開關、8 張分區卡片、9 個區段小標題皆全頁同組同款，無同排混搭。 |
| 不同功能外觀區隔 | 可按動作鈕（青銅拉絲立體鉚釘）、唯一送出鍵（金錠浮雕）、危險鈕（紅框／紅實心）、低干擾鈕（純文字底線）、單選組（八角金邊／亮金八角）、文字欄（淺色香檳亮底暗字）、數字欄（深紅內凹漸層金框亮金字）、唯讀欄（純黑 45° 斜紋暗金虛線平面）、下拉選單（皮革扶手車縫虛線）一眼分明。 |
| 框層次／邊角裝飾／形狀涵蓋 | 框層次含 `.frame-twotone`、`.frame-gradient`、`.frame-single`、皮革內縮車縫虛線、唯讀虛線外框；邊角裝飾含 `.corner-bracket`、`.corner-rivet`、`.corner-bars`、彈窗對角 17px 角飾；形狀含方形 `0`、正圓 `50%`、膠囊 `999px`、八角切角 `.skin-oct`。 |
| 總覽 class 真實性與並排比對 | 選用表所列 56 個總覽 class 經程式核對 100% 存在於 `賭場綠金-元件總覽.html`（`missing_classes: []`），並於真實 Chrome 實開總覽並排截圖比對確認外觀一致。 |

### 2. 真實 Chrome（Playwright）量測與互動驗收

已執行 `_面板比較\看面板.py` 與完整 Playwright 驗收腳本實測 `tv.html` 載入 `_面板比較\設定面板-Gemini7.css`：
- **桌面視窗（1920×1080）尺寸與零捲軸**：基本／按鍵／儲存三分頁對話框皆為 `720×887`，內容區 `vScroll = [691, 691]`、`hScroll = [668, 668]`，**零垂直與水平捲軸**；`clippedControls: []`、`overflowEls: []`、`wrappedLabels: []`（無文字裁切、無溢出、無標籤異常換行）。
- **字型與空心 `0`**：`document.fonts.ready` 後全對話框可見元素 computed font-family 僅為 `"Noto Serif TC", Cinzel, serif` 與 `Cinzel, "Noto Serif TC", serif`（`badFonts: []`），零無襯線字體；`font-feature-settings: "zero" 0`，截圖確認 `001`、`1,500,000`、`0.38`、`100%` 的 `0` 皆為空心。
- **外形與正圓檢查**：可見元素圓角僅出現 `0px`、`50%`、`999px`（`badRadius: []`）；所有 `50%` 正圓元件（頁首圓鈕、色票、滑塊）寬高相等（`badCircles: []`）。
- **狀態與互動檢查**：
  - 自訂下拉選單展開與 Esc 關閉正常（`dropdown_open: true`）。
  - 限紅「刪除」首次點擊轉 `.is-confirm` 紅色漸層實心白字（`hasConfirm: true`）。
  - 一般動作鈕 Hover 上浮 `-1px`（`matrix(1, 0, 0, 1, 0, -0.983601)`）、數字輸入框 Focus 亮金框（`rgb(244, 223, 164)`）、停用輸入框 `#tvShoeNo` 降透明度（`opacity: 0.38`）。
  - 按鍵設定頁可編輯鍵位（`solid` 實線漸層金框＋內凹陰影）與唯讀固定鍵（`dashed` 虛線＋45° 斜紋＋無陰影）明確區分。
  - Esc 關閉設定對話框正常（`closed_on_esc: true`）；主控台零頁面錯誤（`errors: []`）。
- **窄視窗與減少動態**：`1580×884` 搭配 `prefers-reduced-motion: reduce` 實測對話框為 `589×726` 完整落於視窗內（`fits: true`），過渡歸零（`transitionDuration: "0s"`）且內容完全可見。
- **已檢視截圖**：`_面板比較\設定面板-Gemini7-Basic.png`、`_面板比較\設定面板-Gemini7-Keys.png`、`_面板比較\設定面板-Gemini7-Save.png`，以及互動狀態與總覽並排比對截圖。
- **未驗證／限制說明**：本檔僅替換 `tv-settings-casino.css`，不更動 HTML／JS 與其他專案檔案；已暫時隱藏之 5 個分頁（畫面顏色、路單顏色、統計字級、統計顏色、符號調整）僅做直角外形兜底，未逐頁展開檢查。

