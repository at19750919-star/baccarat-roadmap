# 電視版路單設定面板選用表（Gemini8 比較版）

對應樣式檔：`_面板比較\設定面板-Gemini8.css`（可整份替換 `tv-settings-casino.css`，僅以 `#tvSettings` 前綴覆蓋，不更動 HTML／JS 與其他專案檔案）。

---

## 一、設計說明

### 1. 整體想法與已定案條件

本版嚴格遵守專案 `AGENTS.md` 全部已定案決定與《賭金風格》技能／《賭場綠金：通用元件選用規範》：
- **主色紅不變**：對話框外框維持已定案亮紅漸層（`--panel: #a5171a` → `--panel-2: #7a0f12`）與完整 tv 紅 9 變數，呼應電視主畫面紅金路單。
- **最新標準尺寸與零捲軸**：配合 2026-11-20 最新定案之 `800×900` 標準面板尺寸與間距，本機顯示「基本設定」「按鍵設定」「儲存設定」三個分頁，三分頁皆零垂直與水平捲軸。
- **外觀一律自總覽原樣複製**：每一組元件的外觀 CSS（底色、紋理、光影、框層次、邊角裝飾、形狀與 hover／active／focus／disabled 狀態）皆自 `C:\Users\at197\OneDrive\Desktop\專案-進行中\ui組件\賭場綠金-元件總覽.html` 原樣複製並套上 `#tvSettings` 選擇器前綴，絕不重寫近似樣式、不使用無襯線字體或 Emoji。
- **同功能一款，不同功能各自挑**：將設定面板拆為 19 個互動功能組，全面動用總覽的**外觀材質（`.skin-*`）**、**組裝式 `.kit`（底色＋紋理＋光影＋框層次＋邊角裝飾）**與**四種合法外形（直角方形 `0`、正圓 `50%`、膠囊 `999px`、緞帶綁帶切角 `.shape-ribbon`）**，做到電視遠距一眼分辨「頁籤導覽」「分區看板」「單選風格」「一般動作鈕」「唯一送出鍵」「危險刪除」「低干擾操作」「文字輸入」「數字／鍵位輸入」「唯讀鎖定鍵」「下拉選單」「開關／滑桿」。

### 2. 各組外觀挑選思路（避開前幾版重複，立體層次鮮明）

- **亮紅彈窗 × 金牌鉚釘看板卡（`.skin-plate`）**：各設定分區收攏進原樣 `.skin-plate` 卡片——頂部 4px 漸層立體金條、內部隨主色由深紅漸層至近黑（`var(--panel-2) → var(--ink)`）、底部左右兩顆立體圓形金鉚釘，與 9 處**雙線分隔線（`.div-double`）**小標題形成貴賓廳牌局看板氣勢。
- **四種外形按功能清楚分工**：
  - **膠囊形（`999px`）**：頂部三分頁改用第 8 節**膠囊頁籤（`.ex-pill-tabs`）**深暗膠囊槽＋亮金選中膠囊，並與開關軌道、音量滑桿軌道、音量讀數膠囊標籤（`.badge.pill`）形成一致的「切換／調整」圓潤語意。
  - **緞帶綁帶切角（`.shape-ribbon`）**：整組套在 4 顆「畫面風格」互斥單選鈕上，六角收尖金框＋正圓色票，選中翻為**金色漸層實心（`.skin-gold`）**。
  - **正圓形（`50%`）**：頁首放大／關閉兩顆圓鈕採**雕刻金線（`.skin-engraved`）**正圓同心雙金環（36×36 等寬高），加上色票、開關與滑桿滑塊。
  - **直角方形（`0`）**：對話框、分區看板、所有輸入框、動作鈕、下拉選單、資料表與狀態橫幅。
- **框層次與邊角裝飾全面區隔互動按鈕與輸入欄**：
  - **一般動作按鈕**（限紅新增／儲存、語音試聽 7 顆、選擇資料夾）：全頁同款組裝式 `.kit`——**青銅底（`.fill-bronze`）＋點陣紋（`.tex-dots`）＋頂部高光（`.light-gloss`）＋錯位雙框（`.frame-offset`）＋上下金條（`.corner-bars`）**，立體錯位金框按下內縮，極具實體按鍵感。
  - **底部唯一送出鍵（「儲存」）**：全頁唯一主按鈕——**金色實心（`.fill-gold`）＋太陽紋（`.tex-sun`）＋立體厚壓（`.light-thick`）＋霓虹雙管（`.frame-neon`）＋四角鑽石（`.corner-gem`）**，成為全視窗最高視覺錨點。
  - **危險「刪除」與低干擾「恢復預設／取消」**：分別用總覽 `.tool-btn.danger`／`.danger-solid`（紅框→紅實心）與 `.tool-btn.ghost`（透明幽靈鈕）。
  - **四類資料輸入／選取元件絕不混淆**：
    1. **文字輸入框**（版本名稱／儲存路徑／清盤提示）：**半透明毛玻璃（`.skin-glass`）**微霧亮邊＋左對齊象牙白 `--serif`。
    2. **數字／可編輯按鍵框**（桌號／靴號／尺寸／限紅 16 格／可編輯按鍵 10 格／延遲）：**深紅內凹（`.fill-dark`＋`.light-inset`）＋雙線金框（`.frame-double`）**＋亮金 `--disp` 空心 `0` 大數字。
    3. **唯讀固定按鍵欄**（`7`、`77`、`8`、`Enter×3`）：**唯讀專用明顯樣式（`.field-readonly-distinct`）**——純黑 45° 暗金斜紋＋暗金虛線框、無內凹陰影。
    4. **自訂下拉選單**（限紅版本）：**純黑斜紋浮起漸層金框（`.fill-black`＋`.tex-stripe`＋`.light-raised`＋`.frame-gradient`）**觸發鈕＋紅底金框展開清單（`.picker-list`）。

---

## 二、功能組選用表

> 下表所列總覽 class 皆經程式驗證存在於 `C:\Users\at197\OneDrive\Desktop\專案-進行中\ui組件\賭場綠金-元件總覽.html`，外觀 CSS 皆由總覽原樣複製並對應至 `#tvSettings` 選擇器。

| 功能組 | 元素 | 元件結構（規範 4.1 名稱） | 總覽外觀（材質或 `.kit` 各項＋形狀） | 總覽 class | 理由 |
| --- | --- | --- | --- | --- | --- |
| 設定對話框外框 | `#tvSettings` | 對話彈窗與抽屜 | 鎖定亮紅面板漸層（`--panel → --panel-2`）＋1px 金框＋對角 17px 亮金角飾 ＋ 方形 | `.dialog`、`.dialog::before`、`.dialog::after`、`.shape-square` | 嚴守已定案紅底主色與 `800×900` 標準尺寸，原樣複製總覽對話框金框、深影與對角角飾；直角 `0`。 |
| 頁首標題與拖曳提示 | `#tvSettingsTitle`、`.tv-drag-hint` | 頂部列與側欄（品牌標題） | 四段金色直向漸層字（`--disp` 900）＋ `.brand-rule` 豎線 | `h1`（品牌標題）、`.brand-rule` | 建立最高識別標題，右側以金暗豎線隔開 `--serif` 淡字拖曳提示。 |
| 頁首圖示鈕 | `#tvSettingsSizeToggle`、`#tvSettingsClose` | 圓形圖示按鈕 | 雕刻金線（`.skin-engraved`）＋ 正圓形 | `.btn-circle`、`.skin-engraved`、`.shape-circle` | 兩顆同組一致，36×36 等寬高正圓（`50%`），內縮雙金環精緻俐落；內嵌 SVG 與襯線 `×`，無 Emoji。 |
| 三分頁切換列 | `.tv-settings-tabs`、`#tvTabBasic`、`#tvTabKeys`、`#tvTabSave` | 膠囊頁籤 | 結構自帶：深暗凹槽外框（`--pit`）＋未選透明／選中金色漸層實心 ＋ 膠囊 | `.ex-pill-tabs`、`.shape-pill` | 頁面級三分頁採膠囊頁籤，以圓潤膠囊造型與下方直角操作區一眼區隔，選中金色實心清楚標示目前頁。 |
| 分組卡片容器 | `.tv-settings-skin`、`.tv-settings-group`、`#tvProposalLimitSettings`、`.tv-keys-subgroup`、`.tv-save-subgroup` | 金框小卡 | 金牌鉚釘（`.skin-plate`：頂部 4px 金條＋深紅黑漸層底＋底角雙金鉚釘）＋ 方形 | `.mini-card`、`.skin-plate`、`.shape-square` | 全頁 8 張分區看板完全同款，隨主色呈深紅至純黑高對比底板，托顯所有控制項且融入紅金主題；直角 `0`。 |
| 區段小標題 | `#tvStyleLabel`、`.tv-settings-subhead`、`.tv-keys-subhead`、`.tv-save-subhead` | 雙線分隔線 | 亮金襯線標題＋下方 5px 上下雙金線（`.div-double`）＋ 方形 | `.div-double` | 全頁 9 處區段標題完全同款，且與限紅同行版本列排版相容不擠壓。 |
| 畫面風格單選組 | `.tv-style-options button`（4 顆） | 按鈕式單選 | 緞帶綁帶切角（`.shape-ribbon`）：未選深暗底金框；選中內填金色漸層實心（`.skin-gold`） | `.rbtn-group`、`.rbtn-item`、`.shape-demo`、`.shape-ribbon`、`.skin-gold` | 4 項互斥風格整組採對稱六角緞帶勳章切角＋12×12 正圓色票，與一般方形動作鈕一眼分明。 |
| 一般動作按鈕 | `#tvLimitPresetAdd`、`#tvLimitPresetSave`、`.tv-mini-audio-btn`（7 顆）、`#tvPickFolderBtn` | 基本按鈕 | 組裝式 `.kit`：青銅底（`.fill-bronze`）＋點陣（`.tex-dots`）＋頂部高光（`.light-gloss`）＋錯位雙框（`.frame-offset`）＋上下金條（`.corner-bars`）＋ 方形 | `.tool-btn`、`.kit`、`.fill-bronze`、`.tex-dots`、`.light-gloss`、`.frame-offset`、`.corner-bars`、`.shape-square` | 全頁常規動作鈕 100% 同款，暖古銅點陣＋立體錯位雙金框不吃內距，7 顆試聽鈕完整納字且絕不與刪除或送出撞色；已改直角 `0`。 |
| 唯一主要送出鍵 | `.tv-settings-actions button[type=submit]`（「儲存」） | 基本按鈕 | 組裝式 `.kit`：金色底（`.fill-gold`）＋太陽紋（`.tex-sun`）＋立體厚度（`.light-thick`）＋霓虹雙管（`.frame-neon`）＋四角鑽石（`.corner-gem`）＋ 方形 | `.tool-btn.active`、`.kit`、`.fill-gold`、`.tex-sun`、`.light-thick`、`.frame-neon`、`.corner-gem`、`.shape-square` | 全頁唯一主送出行動，金色實心＋雙管金光＋四角鑽石＋4px 按壓厚度，成為全視窗最高焦點；已改直角 `0`。 |
| 低干擾按鈕 | `#tvSettingsReset`、`#tvSettingsCancel`、`#tvColorsReset`、`#tvColorReset` | 基本按鈕 | 幽靈透明底（`.tool-btn.ghost`），Hover 浮現金線框與微光 ＋ 方形 | `.tool-btn.ghost`、`.shape-square` | 恢復預設與取消視覺完全退後，不與右下角主送出鍵爭奪視線；已改直角 `0`。 |
| 危險按鈕（兩段確認） | `#tvLimitPresetDelete`、`.is-confirm` | 紅色危險按鈕 | 輕：深底紅框紅字（`.tool-btn.danger`）；重：紅色漸層實心（`.tool-btn.danger-solid`）＋ 方形 | `.tool-btn.danger`、`.tool-btn.danger-solid`、`.shape-square` | 刪除限紅版本採兩段危險警示，與相鄰青銅錯位雙框鈕強對比；已改直角 `0`。 |
| 文字輸入框 | `#tvLimitPresetName`、`#tvCustomSavePath`、`#tvClearPromptText`、`#tvCaptionText` | 基本輸入框 | 半透明毛玻璃（`.skin-glass`）＋ 方形 | `.field`、`.skin-glass`、`.shape-square` | 微霧亮邊玻璃框配左對齊象牙白 `--serif` 字，在深紅黑看板上清晰辨識「可自由輸入文字」；依 3.3 轉換表已改直角 `0`。 |
| 數字與可編輯鍵位框 | 桌號、靴號、路單尺寸 6 格、限紅雙表 16 格、可編輯按鍵 10 格、`#tvAutoCommitDelay` | 數字框 | 組裝式 `.kit`：深色底（`.fill-dark`）＋凹陷（`.light-inset`）＋雙線框（`.frame-double`）＋ 方形 | `.numbox`、`.unit`、`.kit`、`.fill-dark`、`.light-inset`、`.frame-double`、`.shape-square` | 深紅內凹槽＋內縮雙金框配亮金 `--disp` 空心 `0` 數字，與毛玻璃文字欄及虛線唯讀欄截然不同；依 3.3 轉換表已改直角 `0`。 |
| 唯讀固定按鍵欄 | `#tvKeyBack7`、`#tvKeyLimit`、`#tvKeyBoss`、`#tvKeyFullscreenEnter` | 唯讀專用明顯樣式 | 結構自帶：純黑底＋45° 暗金斜紋＋暗金虛線框、無內凹陰影 ＋ 方形 | `.field-readonly-distinct`、`.shape-square` | 系統鎖定快捷鍵一眼區隔於可編輯雙線實框鍵位，絕不複製 🔒 Emoji；依 3.3 轉換表已改直角 `0`。 |
| 自訂下拉選單 | 限紅版本 `.tv-select-button`＋`.tv-select-menu`、`#tvColorTarget`、`#tvSkinToggle` | 自訂下拉選單 | 觸發鈕：組裝式 `.kit` 純黑底（`.fill-black`）＋斜紋（`.tex-stripe`）＋浮起（`.light-raised`）＋漸層金框（`.frame-gradient`）；清單：紅底金框（`.picker-list`）＋ 方形 | `.picker`、`.picker-btn`、`.picker-list`、`.picker-item`、`.kit`、`.fill-black`、`.tex-stripe`、`.light-raised`、`.frame-gradient`、`.shape-square` | 取代原生 `<select>`，在限紅版本列中與毛玻璃文字框、青銅錯位雙框鈕、紅框刪除鈕四者各異；依 3.3 轉換表已改直角 `0`。 |
| 開關 | 顯示靴號、`#tvAutoCommit`、`#tvSoundEnabled`、`#tvAutoSaveOnClear` | 勾選、單選與金色開關 | 結構自帶：深暗→金色漸層軌道（`.rule-control`）＋正圓立體金球 ＋ 膠囊 | `.rule-control`、`.shape-pill`、`.shape-circle` | 4 個布林開關全頁同款；依 3.3 轉換表軌道已改膠囊 `999px`、滑塊維持 `50%` 正圓。 |
| 單軸滑桿與音量標籤 | `#tvSoundVolume`、`#tvSoundVolumeText` | 單軸滑桿 ＋ 金色標籤 | 軌道：`.range-track`（膠囊 `999px`）；滑塊：20×20 正圓金球；讀數：膠囊金色標籤（`.badge.pill`） | `input[type=range]`、`.range-track`、`.range-wrap`、`.badge.pill`、`.shape-pill`、`.shape-circle` | 單值音量微調，右側 `100%` 採膠囊金框標籤配 `--disp` 亮金字；軌道已改膠囊 `999px`。 |
| 限紅雙表 | `.tv-limit-table`（左右兩表） | 金頭資料表 | 結構自帶：金色表頭字、暗金列底線、列懸停淡金底 ＋ 方形 | `.table` | 每表 4 列（少於五列依規範不用隔行換色），維持清朗數值閱讀節奏。 |
| 儲存設定列分隔 | `.tv-save-row + .tv-save-row` | 虛線分隔線 | 結構自帶：`1.5px dashed var(--gold-3)` | `.div-dashed` | 在儲存設定看板內以總覽金色虛線輕分隔三列設定。 |
| 底部狀態訊息 | `#tvSettingsStatus` | 帶圖示與左邊色條通知 | 結構自帶：紅底＋暗金框＋左 4px 亮金條 ＋ 方形 | `.toast-bar-item` | 依規範不用裸文字呈現狀態，原樣套用左金條橫幅；直角 `0`。 |

### 為何沒採用其他結構樣式

- **文字輸入框不用「只有底線的輸入框（`.field-underline`）」**：規範第 2 節明訂其不適合需明確邊界的表單，本面板版本名稱與儲存路徑皆須清楚框出輸入範圍，故選用 `.field` 配 `.skin-glass`。
- **畫面風格不用「卡片式單選（`.rcard-group`）」**：規範第 5 節指出其適合附說明的互斥選項，此處 4 項皆為單行名稱與色票，改用按鈕式單選配緞帶綁帶切角（`.shape-ribbon`）兼顧空間與辨識度。
- **限紅雙表不用「隔行換色表格（`.table.zebra`）」**：每張表僅 4 列，規範第 15 節明訂不適合少於五列之表格，故用標準金頭資料表（`.table`）。
- **按鈕不用「黃銅銘牌（`.skin-brass`）」或「燈泡跑馬燈（`.skin-bulb`）」、數字框不用「數碼管（`.dx-seg`）」**：黃銅銘牌左右螺絲需各 24px 內距、燈泡跑馬燈需四邊 12px 留白，放進 7 連排語音試聽鈕會壓迫文字；數碼管不適合可編輯輸入，故均不採用。

---

## 三、第 5 節驗收紀錄

### 1. 功能分組檢查（規範 5.7）

| 檢查項目 | 檢查結果 |
| --- | --- |
| 同功能全頁同一款 | 頁首 2 顆圓鈕、3 顆膠囊分頁籤、8 張金牌鉚釘看板卡、9 處雙金線小標題、4 顆緞帶切角風格單選鈕、全頁一般動作鈕（新增／限紅儲存／試聽 7 顆／選擇資料夾）、2 顆幽靈低干擾鈕、3 個毛玻璃文字欄、所有數字與可編輯鍵位框、4 個斜紋虛線唯讀固定鍵、4 個金色開關皆全頁同組同款，無同排混搭。 |
| 不同功能外觀區隔 | 膠囊頁籤（深槽＋亮金膠囊）、風格單選（緞帶綁帶切角）、一般動作鈕（青銅點陣高光錯位雙框＋上下金條）、唯一主送出鍵（金色太陽紋立體厚壓霓虹雙管鑽石角）、危險鈕（紅框→紅實心）、低干擾鈕（透明幽靈鈕）、文字輸入（半透明毛玻璃左對齊象牙白字）、數字／鍵位輸入（深紅內凹雙線金框亮金字）、唯讀固定鍵（純黑 45° 斜紋暗金虛線平面）、下拉選單（純黑斜紋浮起漸層金框）彼此一眼分明。 |
| 框層次／邊角裝飾／形狀涵蓋 | 框層次涵蓋 `.frame-offset`、`.frame-neon`、`.frame-double`、`.frame-gradient`、`.skin-engraved` 內縮雙環、唯讀虛線外框；邊角裝飾涵蓋 `.dialog` 對角 17px 角飾、`.skin-plate` 頂部金條＋底角雙鉚釘、`.corner-bars`、`.corner-gem`；形狀涵蓋直角方形 `0`、正圓 `50%`、膠囊 `999px`、緞帶綁帶切角 `.shape-ribbon`。 |
| 總覽 class 真實性與並排比對 | 選用表所列 56 個總覽 class 經程式逐一核對 100% 存在於 `賭場綠金-元件總覽.html`（`missing: []`），並於真實 Chrome 開啟總覽與本版元件並排截圖比對確認外觀一致。 |

### 2. 真實 Chrome（Playwright）量測與互動驗收

已執行 `_面板比較\看面板.py 設定面板-Gemini8.css` 與完整 Playwright 驗收腳本實測 `tv.html`：
- **標準桌面視窗（1920×1080）尺寸與零捲軸**：基本／按鍵／儲存三分頁對話框均為 `800×900`，內容區 `vScroll = [692, 692]`、`hScroll = [748, 748]`，**零垂直與水平捲軸**；`clipped: []`、`overflow: []`、`wrappedLabels: []`（無文字裁切、無溢出、無標籤異常換行）。
- **窄視窗與減少動態（1401×803、1280×720 ＋ `prefers-reduced-motion: reduce`）**：
  - `1401×803` 縮放後為 `584×657`（`fits: true`），三分頁 `vScroll = [692, 692]`、`hScroll = [748, 748]`，按鈕過渡時間 `transitionDuration: "0s"`。
  - `1280×720` 縮放後為 `533×600`（`fits: true`），三分頁 `vScroll = [692, 692]`、`hScroll = [748, 748]`，按鈕過渡時間 `transitionDuration: "0s"`。
- **字型與空心 `0`**：`document.fonts.ready` 後全對話框可見元素 computed `font-family` 僅出現 `"Noto Serif TC", Cinzel, serif` 與 `Cinzel, "Noto Serif TC", serif`（`badFonts: []`），零無襯線字體；`font-feature-settings: "zero" 0`，截圖確認 `001`、`1,500,000`、`30,000`、`0.38`、`100%` 的 `0` 皆為空心。
- **外形與正圓檢查**：可見元素圓角僅出現 `0px`、`50%`、`999px`（`badRadius: []`）；所有 `50%` 正圓元件（頁首雙圓鈕、色票、開關與滑桿滑塊）寬高完全相等（`badCircles: []`）。
- **互動狀態與主色切換檢查**：
  - 自訂下拉選單展開與 Esc 關閉正常（`dd_open: true`、`dd_closed: true`）。
  - 限紅「刪除」首次點擊轉 `.is-confirm` 紅色漸層實心白字（`cls: true`）。
  - 一般動作鈕 Hover 上浮 `-1px`（`matrix(1, 0, 0, 1, 0, -1)`）、數字輸入框 Focus 亮金框、停用輸入框 `#tvShoeNo` 降透明度（`opacity: 0.38`）。
  - 切換主畫面風格至「綠金風格」再切回「紅金風格」無錯誤且狀態正確（`green_checked: "true"`）。
  - 按鍵設定頁可編輯鍵位（`solid` 雙線金框＋內凹陰影）與唯讀固定鍵（`dashed` 虛線＋45° 斜紋＋無陰影）明確區隔。
  - Esc 關閉設定對話框正常（`closed_esc: true`）；主控台零頁面錯誤（`errors: []`）。
- **已檢視截圖**：`_面板比較\設定面板-Gemini8-Basic.png`、`_面板比較\設定面板-Gemini8-Keys.png`、`_面板比較\設定面板-Gemini8-Save.png`，以及與總覽並排比對截圖。
- **未驗證／限制說明**：本檔僅另存替換樣式，未改動 HTML／JS 與其他專案檔案；已暫時隱藏之 5 個分頁（畫面顏色、路單顏色、統計字級、統計顏色、符號調整）僅做直角外形兜底，未逐頁展開檢查。
