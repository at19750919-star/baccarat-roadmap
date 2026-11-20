# 電視版路單設定面板選用表（Gemini9 比較版・HTML 元件結構升級版）

對應檔案（本次僅修改以下三個檔案，未更動 `tv.html` 或其他專案檔，未 git commit）：
- 頁面複本：`tv-比較-Gemini9.html`（僅調整 `#tvSettings` 設定面板 HTML 結構，並附加一小段同步強化腳本 `#g9SettingsEnhance`，完整保留所有原有元素 `id`、`name`、`data-*`、ARIA 角色與讀寫存檔功能）
- 樣式檔：`_面板比較\設定面板-Gemini9.css`（取代 `tv-settings-casino.css`）
- 選用表：`_面板比較\選用表-Gemini9.md`

---

## 一、設計說明

### 1. 整體想法與已定案守則

本版嚴格遵守專案 `AGENTS.md` 全部已定案決定與《賭金風格》技能／《賭場綠金：通用元件選用規範》：
- **主色紅不變**：對話框外框與整體色票鎖定已定案亮紅（`--panel: #a5171a` → `--panel-2: #7a0f12`）與完整 tv 紅 9 變數，呼應電視主畫面紅金路單。
- **標準尺寸與零捲軸**：嚴守 `800×900` 標準面板尺寸，本機只顯示「基本設定」「按鍵設定」「儲存設定」三個分頁，三分頁於 `1920×1080`、`1401×803`、`1280×720` 皆零垂直與水平捲軸。
- **真正導入總覽的 HTML 元件結構**：相較純 CSS 版僅能套外觀，本次在 `tv-比較-Gemini9.html` 真正落地了總覽多項需要 HTML 結構與小段 JS 支援的元件，包含：
  1. **圖示頁籤（`.ex-icon-tabs`）**：三個主分頁內嵌線條 SVG 圖示＋頂部亮金指示條。
  2. **經典金線角飾框（`.gframe`＋`.frame-title`）**：全頁 9 個設定區塊皆用嵌在金線框上的標題牌與對角 14px 角飾。
  3. **卡片式單選（`.rcard-group`／`.rcard-box`）**：四種畫面風格升級為附簡述與右上角 14×14 正圓金點指示器的單選卡。
  4. **加減步進數字框（`.ex-stepper`＋`.ex-addon.suf`）**：大路欄數、長龍起算、四項筆畫與連按停頓等待時間皆改為 `[−][數值][＋][單位]` 直角併接步進器，支援小數精準加減、即時預覽並於上下限自動停用。
  5. **雙層八角切角金框主送出鍵（`.shape-wrap.shape-oct`＞`.sk-btn.in-wrap.skin-gold`）**：真正以總覽雙層 HTML 結構包出八角切角金框，搭配第 28 節金線掃光（`.motion-line`）。
  6. **開關連動狀態圓點（`.status-dot`）與 10 格音量分格錶（`.bar-cells`）**：每個開關旁即時亮起綠燈／暗灰燈；語音音量滑桿下方同步點亮 10 格金色能量條。
  7. **儲存設定虛線路徑區（`.upload-zone`）與清盤確認即時預覽卡（`.toast-bar-item`＋`.div-vert-row`）**：補齊原本儲存分頁下方的大片留白，即時同步提示字數、清盤確認橫幅與存檔摘要。
- **外觀一律自總覽原樣複製**：所有底色、紋理、光影、框層次、邊角裝飾與狀態均自 `C:\Users\at197\OneDrive\Desktop\專案-進行中\ui組件\賭場綠金-元件總覽.html` 原樣複製；全頁僅用襯線字（`--serif`／`--disp`，無 `--sans`、無斜線 `0`）、不使用 Emoji，外形嚴格限制於直角 `0`、正圓 `50%`、膠囊 `999px` 與八角切角 `clip-path`。

### 2. 各組外觀挑選思路（同功能一款、不同功能一眼區隔）

- **框層次、邊角裝飾、形狀全面動用**：
  - **框層次**：`.gframe` 漸層金線框、`.frame-double` 內縮雙金環（頁首圓鈕）、`.frame-twotone` 雙色內框（限紅金額欄）、`.frame-gradient` 漸層金框（下拉選單）、`.kbd` 底部 3px 厚金鍵帽框（可編輯按鍵）、虛線外框（唯讀固定鍵與儲存路徑區）。
  - **邊角裝飾**：`.dialog` 對角 17px 亮金角飾、`.gframe` 對角 14px 角飾、`.corner-bracket` 四角 L 折角（一般動作鈕）。
  - **四種合法外形**：直角方形（`0`）、正圓形（`50%`，頁首雙圓鈕、色票、單選圓點、開關與滑桿球、狀態點、預覽圖示圓）、膠囊形（`999px`，頁首即時桌況膠囊、開關軌道、滑桿軌道、音量讀數徽章）、八角切角（`.shape-wrap.shape-oct`，唯一底部「儲存」送出鍵）。
- **五類輸入／選取元件徹底區分**：
  1. **文字輸入欄**（桌號／靴號／限紅版本名／儲存路徑／清盤提示）：**淺色香檳（`.skin-light`）**亮底深褐字，高反差一眼看出可自由輸入文字。
  2. **步進數字微調欄**（路單尺寸 6 項＋連按停頓時間）：**加減步進數字框（`.ex-stepper`＋`.ex-addon.suf`）**，`[−][值][＋][單位]` 直角併接。
  3. **限紅金額數字欄**（雙表 16 格）：**深暗內凹雙色金框（`.fill-dark`＋`.light-inset`＋`.frame-twotone`）**，右對齊亮金 `--disp` 空心 `0`。
  4. **可編輯快捷鍵欄**（開獎 8 鍵＋確定送出＋清空路單）：**黑曜直紋立體鍵帽（`.kbd`＋`.fill-black`＋`.tex-pin`＋`.light-thick`＋`.frame-single`）**，下緣 3px 實體厚底像實體鍵盤帽。
  5. **唯讀固定按鍵欄**（倒退 `7`／開啟設定 `77`／儲存 `8`／全螢幕 `Enter×3`）：**唯讀專用明顯樣式（`.field-readonly-distinct`）**——純黑 45° 斜紋＋暗金虛線平面，旁附「鎖定」小標（無 Emoji）。

---

## 二、功能組選用表

> 下表所列總覽 class 皆經程式核對 100% 存在於 `C:\Users\at197\OneDrive\Desktop\專案-進行中\ui組件\賭場綠金-元件總覽.html`（`missing_catalog_classes: []`）。

| 功能組 | 元素 | 元件結構（規範 4.1 名稱） | 總覽外觀（材質或 `.kit` 各項＋形狀） | 總覽 class | 理由 |
| --- | --- | --- | --- | --- | --- |
| 設定對話框外框 | `#tvSettings` | 對話彈窗與抽屜 ＋ 彈窗角飾展開 | 鎖定 tv 紅面板漸層（`--panel → --panel-2`）＋金框＋對角 17px 亮金角飾 ＋ 方形 | `.dialog`、`.motion-corners`、`.shape-square` | 嚴守已定案紅底主色與 `800×900` 標準尺寸，開啟時播放對角角飾展開動態（尊重減少動態）；直角 `0`。 |
| 頁首標題與即時摘要 | `#tvSettingsTitle`、`.brand-rule`、`#g9HeaderSummary` | 頂部列與側欄 ＋ 單顆圓點狀態 ＋ 金色標籤 | 四段直向金色漸層字（`--disp` 900）＋豎線＋綠光圓點＋柔和金框膠囊標籤 | `h1`（品牌標題）、`.brand-rule`、`.status-dot`、`.badge.soft.pill` | 頂列即時反映目前選用風格與桌號（如 `紅金風格・001 桌`），改桌號或換風格時同步更新。 |
| 頁首圖示鈕 | `#tvSettingsSizeToggle`、`#tvSettingsClose` | 圓形圖示按鈕 | 組裝式 `.kit`：純黑底（`.fill-black`）＋拉絲（`.tex-brushed`）＋浮起（`.light-raised`）＋雙線框（`.frame-double`）＋ 正圓形 | `.btn-circle`、`.kit`、`.fill-black`、`.tex-brushed`、`.light-raised`、`.frame-double`、`.shape-circle` | 36×36 等寬高正圓（`50%`），黑曜拉絲內縮雙金環，搭配內嵌 SVG 放大圖示與襯線 `×`，無 Emoji。 |
| 三分頁切換列 | `.tv-settings-tabs`、`#tvTabBasic`、`#tvTabKeys`、`#tvTabSave` | 圖示頁籤 | 結構自帶：內嵌線條 SVG 圖示＋頂部 2px 金線條，選中亮金頂條與暖金底暈 ＋ 方形 | `.ex-icon-tabs`、`.shape-square` | 利用 HTML 改動補入三組 SVG 圖示，清楚區分頂部導覽與下方操作元件；直角 `0`。 |
| 分組卡片容器 | 畫面風格、桌號與路單尺寸、限紅設定、開獎按鍵、系統與輔助按鍵、操作模式、語音播報、路單存檔設定、清盤確認即時預覽（共 9 區） | 設定面板框體（`.gframe`） | 總覽 `.gframe`：漸層金線框（`--gold-line`）＋對角 14px 亮金角飾＋深暗紅黑底（`--control-1 → --pit`）＋嵌框標題牌 `.frame-title` ＋ 方形 | `.gframe`、`.frame-title`、`.shape-square` | 依規範 3.1 第 5 條採用總覽經典 `.gframe`，全頁 9 區 100% 同款，嵌框標題節省高度並托顯深底高對比；直角 `0`。 |
| 區內次級分隔標題 | 「固定快捷鍵」「快速試聽語音」 | 中間裝飾分隔線 | 結構自帶：兩側漸層金線＋中間亮金字標題 | `.div-line-wrap` | 區隔同卡片內的次級區塊，不與卡片層級 `.frame-title` 混淆。 |
| 畫面風格單選組 | `.tv-style-options` 4 張風格卡 | 卡片式單選 | 結構自帶：深紅底金暗框＋右上 14×14 正圓金點，選中亮金框＋暖金底暈＋實心亮金點 ＋ 方形 | `.rcard-group`、`.rcard-box`、`.shape-square` | HTML 補入風格簡述，4 項互斥風格成 4 欄卡片式單選，正圓色票與正圓單選點皆等寬高；依 3.3 已改直角 `0`。 |
| 步進數字微調欄 | 大路欄數、長龍起算、4 項路單筆畫、`#tvAutoCommitDelay`（共 7 處） | 加減步進數字框 ＋ 帶單位併接 | 結構自帶：`[−][--disp 金字凹槽][＋][單位格]` 四段直角併接 ＋ 方形 | `.ex-stepper`、`.ex-addon`、`.shape-square` | 針對有明確上下限的數值改用真實步進器，點按即時增減並連動主畫面預覽，到限自動停用；直角 `0`。 |
| 文字輸入欄 | `#tvTableNo`、`#tvShoeNo`、`#tvLimitPresetName`、`#tvCustomSavePath`、`#tvClearPromptText` | 基本輸入框 | 淺色香檳（`.skin-light`：亮香檳漸層底＋深褐字）＋ 方形 | `.field`、`.skin-light`、`.shape-square` | 高反差亮底在深暗卡片上極易辨識為「文字編輯欄」，與深凹數字欄及黑曜鍵帽欄一眼區分；依 3.3 已改直角 `0`。 |
| 限紅金額數字欄 | 限紅雙表 16 格 `input[data-limit-key]` | 數字框 | 組裝式 `.kit`：深色底（`.fill-dark`）＋凹陷（`.light-inset`）＋雙色框（`.frame-twotone`）＋ 方形 | `.numbox`、`.kit`、`.fill-dark`、`.light-inset`、`.frame-twotone`、`.shape-square` | 深紅內凹槽配外亮金內暗棕雙色框與右對齊 `--disp` 空心 `0` 千分位數字；依 3.3 已改直角 `0`。 |
| 可編輯快捷鍵欄 | `#tvKeyB`～`#tvKeySeven`、`#tvKeyConfirm`、`#tvKeyClear`（共 10 格） | 金色鍵帽 | 組裝式 `.kit`：純黑底（`.fill-black`）＋細直條（`.tex-pin`）＋立體厚度（`.light-thick`）＋單線框（`.frame-single`）＋ 3px 厚底鍵帽 ＋ 方形 | `.kbd`、`.kit`、`.fill-black`、`.tex-pin`、`.light-thick`、`.frame-single`、`.shape-square` | 呈現實體鍵盤按鍵帽質感，與唯讀固定鍵一眼拉開差距；直角 `0`。 |
| 唯讀固定按鍵欄 | `#tvKeyBack7`、`#tvKeyLimit`、`#tvKeyBoss`、`#tvKeyFullscreenEnter`（共 4 格） | 唯讀專用明顯樣式 ＋ 金色標籤 | 結構自帶：純黑底 45° 暗金斜紋＋暗金虛線框、無陰影＋「鎖定」小標 ＋ 方形 | `.field-readonly-distinct`、`.badge`、`.shape-square` | 明確區隔不可編輯的系統快捷鍵，絕不複製 🔒 Emoji；依 3.3 已改直角 `0`。 |
| 自訂下拉選單 | 限紅版本 `.tv-select-button`＋`.tv-select-menu`、`#tvColorTarget`、`#tvSkinToggle` | 自訂下拉選單 | 觸發鈕：組裝式 `.kit` 青銅底（`.fill-bronze`）＋拉絲（`.tex-brushed`）＋浮起（`.light-raised`）＋漸層金框（`.frame-gradient`）；清單：紅底金框（`.picker-list`）＋ 方形 | `.picker`、`.picker-btn`、`.picker-list`、`.picker-item`、`.kit`、`.fill-bronze`、`.tex-brushed`、`.light-raised`、`.frame-gradient`、`.shape-square` | 取代原生 `<select>`，在限紅工具列中與香檳文字框、紅菱格動作鈕、紅框刪除鈕四者各異；依 3.3 已改直角 `0`。 |
| 一般動作按鈕 | `#tvLimitPresetAdd`、`#tvLimitPresetSave`、`.tv-mini-audio-btn`（7 顆）、`#tvPickFolderBtn` | 基本按鈕 | 組裝式 `.kit`：主色底（`.fill-tone`）＋菱格（`.tex-diamond`）＋頂部高光（`.light-gloss`）＋單線框（`.frame-single`）＋四角 L 角飾（`.corner-bracket`）＋ 方形 | `.tool-btn`、`.kit`、`.fill-tone`、`.tex-diamond`、`.light-gloss`、`.frame-single`、`.corner-bracket`、`.shape-square` | 全頁常規動作鈕 100% 同款，主色紅菱格與四角金折角立體醒目，且 7 顆試聽鈕一列不擠字；直角 `0`。 |
| 唯一主要送出鍵 | 底部 `.tv-settings-actions button[type=submit]`（「儲存」） | 基本按鈕 ＋ 金線掃光 | 雙層八角切角金框（`.shape-wrap.shape-oct`）＋金色漸層實心（`.skin-gold`）＋懸停金線掃光（`.motion-line`） | `.shape-wrap`、`.shape-oct`、`.sk-btn`、`.skin-gold`、`.motion-line` | 全視窗唯一主行動鍵，真正採用總覽雙層 `.shape-wrap.shape-oct` 八角切角結構，視覺焦點無可取代。 |
| 低干擾操作鈕 | `#tvSettingsReset`、`#tvSettingsCancel`、`#tvColorsReset`、`#tvColorReset` | 基本按鈕 | 幽靈透明底（`.tool-btn.ghost`），Hover 浮現金線框與微光 ＋ 方形 | `.tool-btn.ghost`、`.shape-square` | 視覺退後，不與右下角八角金實心主送出鍵搶焦點；直角 `0`。 |
| 危險按鈕（兩段確認） | `#tvLimitPresetDelete`、`.is-confirm` | 紅色危險按鈕 | 輕：深底紅框紅字（`.tool-btn.danger`）；重：紅色漸層實心亮紅邊（`.tool-btn.danger-solid`）＋ 方形 | `.tool-btn.danger`、`.tool-btn.danger-solid`、`.shape-square` | 刪除限紅版本採兩段危險警示，與相鄰新增／儲存鈕明確分層；直角 `0`。 |
| 開關與即時狀態點 | `#tvShoeEnabled`、`#tvAutoCommit`、`#tvSoundEnabled`、`#tvAutoSaveOnClear` | 勾選、單選與金色開關 ＋ 單顆圓點狀態 | 深暗→金色漸層軌道（`.rule-control`）＋正圓立體金球 ＋ 連動綠光／暗灰 `.status-dot` ＋ 膠囊／正圓 | `.rule-control`、`.status-dot` | 4 處開關全頁同款，旁附即時「開啟／關閉」燈號文字；依 3.3 軌道已改膠囊 `999px`、滑塊與燈點維持正圓 `50%`。 |
| 音量滑桿與分格錶 | `#tvSoundVolume`、`#tvSoundVolumeText`、`#g9VolCells` | 單軸滑桿 ＋ 金色標籤 ＋ 分格進度條 | 膠囊軌道（`999px`）＋正圓金球（`50%`）＋金色實心膠囊讀數（`.badge.fill.pill`）＋ 10 格金色分格條（`.bar-cells` 直角 `0`） | `input[type=range]`、`.range-track`、`.badge.fill.pill`、`.bar-cells` | 拖曳音量時同步更新百分比膠囊與 10 格分格燈條，直覺好讀。 |
| 限紅雙表 | `.tv-limit-table`（左右兩表）＋ `#g9LimitCountBadge` | 金頭資料表 ＋ 金色標籤 | 金色表頭、暗金列線、列懸停淡金底 ＋ 柔和金框版本計數標（`.badge.soft`）＋ 方形 | `.table`、`.badge.soft` | 每表 4 列（少於五列依規範不用斑馬紋），上方計數標隨新增／刪除版本自動同步。 |
| 儲存路徑虛線區與分隔線 | `.g9-path-zone`、`.div-dashed`、`#g9PromptCount` | 自訂檔案上傳與虛線拖放區 ＋ 虛線分隔線 ＋ 金色標籤 | 金色虛線外框（`.upload-zone`）＋ 1.5px 金虛線分隔（`.div-dashed`）＋ 字數標籤（`.badge.soft`）＋ 方形 | `.upload-zone`、`.div-dashed`、`.badge.soft` | 框出本機資料夾與 JSON 格式標示，並即時統計清盤提示字數；依 3.3 已改直角 `0`。 |
| 清盤即時預覽與底部狀態條 | `#g9SavePreviewBar`、`.g9-save-meta`、`#tvSettingsStatus` | 帶圖示與左邊色條通知 ＋ 直立分隔線 | 左側 4px 金／綠條＋正圓 `!` 符號（`.toast-ic`）＋金線直立分隔摘要列（`.div-vert-row`／`.div-vert`）＋ 方形 | `.toast-bar-item`、`.toast-ic`、`.div-vert-row`、`.div-vert` | 依規範不用裸文字呈現狀態；預覽卡即時反映清盤提示字、自動存檔與路徑，徹底消除儲存分頁空曠感；直角 `0`。 |

### 為何沒採用其他結構樣式

- **文字輸入框不用「只有底線的輸入框（`.field-underline`）」**：規範第 2 節明訂其不適合需明確邊界的表單，本面板的桌號、版本名、路徑與提示語均需清楚邊界，故採 `.field` 配 `.skin-light`。
- **限紅雙表不用「隔行換色表格（`.table.zebra`）」**：每張表僅 4 列，規範第 15 節指出不適合少於五列的資料表，故採用標準金頭資料表（`.table`）。
- **限紅 16 格不用「加減步進數字框（`.ex-stepper`）」或「數碼管（`.dx-seg`）」**：限紅為大額千分位金額（如 `1,500,000`），依規範第 3 節步進器只適合小範圍整數（已用於欄數、長龍、筆畫、等待秒數），數碼管不適合可編輯輸入，故限紅格採雙色金框數字框（`.numbox`）。
- **三分頁不用「直排側邊頁籤（`.tabs-vert-wrap`）」**：面板寬度為固定 `800px`，基本設定有 3 欄步進器與雙表限紅，若左側佔掉 108px 會擠壓表格欄寬，故採橫向頂部圖示頁籤（`.ex-icon-tabs`）。

---

## 三、第 5 節驗收紀錄

### 1. 功能分組檢查（規範 5.7）

| 檢查項目 | 檢查結果 |
| --- | --- |
| 同功能全頁同一款 | 頁首 2 顆黑曜拉絲雙環正圓鈕、3 顆 SVG 圖示頁籤、9 張 `.gframe` 嵌框標題卡片、4 張風格單選卡、7 組 `[−][值][＋][單位]` 步進數字框、5 個淺色香檳文字輸入框、16 格深凹雙色金框金額欄、10 格黑曜直紋立體鍵帽、4 格斜紋虛線唯讀固定鍵、全頁一般動作鈕（新增／限紅儲存／試聽 7 顆／選擇資料夾）、2 顆幽靈低干擾鈕、4 組開關＋狀態點皆全頁同組同款，無同排混搭。 |
| 不同功能外觀區隔 | 圖示頁籤、`.gframe` 卡片、卡片式風格單選、步進數字框、香檳亮底文字欄、深凹雙色金框金額欄、黑曜立體鍵帽、斜紋虛線唯讀欄、青銅拉絲下拉選單、主色紅菱格四角飾一般鈕、雙層八角金實心主送出鍵、紅框→紅實心危險鈕、透明幽靈鈕彼此一眼分明。 |
| 框層次／邊角裝飾／形狀涵蓋 | 框層次涵蓋 `.gframe` 漸層金框、`.frame-double`、`.frame-twotone`、`.frame-gradient`、`.kbd` 3px 厚底框、虛線框；邊角裝飾涵蓋 `.dialog` 17px 對角角飾、`.gframe` 14px 對角角飾、`.corner-bracket` 四角 L 折角；形狀涵蓋直角方形 `0`、正圓 `50%`、膠囊 `999px`、八角切角 `.shape-wrap.shape-oct`。 |
| 總覽 class 真實性與並排比對 | 選用表所列 58 個總覽 class 經程式核對 100% 存在於 `賭場綠金-元件總覽.html`（`missing_catalog_classes: []`），並於真實 Chrome 開啟總覽與本版對應元件並排截圖比對確認外觀一致。 |

### 2. 真實 Chrome（Playwright）量測、互動與讀寫持久化驗收

已執行 `python _面板比較\看面板.py _面板比較\設定面板-Gemini9.css 設定面板-Gemini9 tv-比較-Gemini9.html` 與完整三視窗＋互動驗收腳本：
- **標準視窗（1920×1080）**：基本／按鍵／儲存三分頁對話框均為 `800×900`，可見分頁數 `3`，內容區 `vScroll = [678, 678]`、`hScroll = [758, 758]`，**零垂直與水平捲軸**；`clipped: []`、`overflow: []`、`errors: []`。
- **窄視窗與減少動態（1401×803、1280×720 ＋ `prefers-reduced-motion: reduce`）**：
  - `1401×803` 等比縮放後 `584×657`（`fits: true`），三分頁 `vScroll = [678, 678]`、`hScroll = [758, 758]`，主按鈕 `transitionDuration: "0s"`。
  - `1280×720` 等比縮放後 `533×600`（`fits: true`），三分頁 `vScroll = [678, 678]`、`hScroll = [758, 758]`，主按鈕 `transitionDuration: "0s"`。
- **字型與空心 `0`**：`document.fonts.ready` 後全對話框可見元素 computed `font-family` 僅出現 `"Noto Serif TC", Cinzel, serif` 與 `Cinzel, "Noto Serif TC", serif`（`badFonts: []`），零無襯線字體；`font-feature-settings: "zero" 0`，截圖確認 `001`、`01`、`1,500,000`、`30,000`、`0.38`、`100%` 的 `0` 均為空心。
- **外形與正圓檢查**：可見元素圓角僅出現 `0px`、`50%`、`999px`（`badRadius: []`）；所有 `50%` 正圓元件寬高相等（`badCircles: []`）。
- **互動、HTML 強化元件與設定讀寫持久化檢查**：
  - 步進數字框：`#tvBigColumns` 點 `＋`／`−` 依序切換 `46 → 47 → 46`；`#tvAutoCommitDelay` 點 `＋` 精準進位 `0.38 → 0.39`。
  - 開關與狀態點：點 `#tvShoeEnabled` 後 `#tvShoeNo` 由停用轉可編輯，狀態標即時切為綠燈「開啟」。
  - 卡片式風格單選：點「綠金風格」轉 `aria-checked="true"` 且頁首摘要即時更新為「綠金風格・001 桌」，切回「紅金風格」正常無衝突。
  - 下拉與危險二次確認：限紅下拉選單展開與 Esc 關閉正常；點「刪除」轉 `.is-confirm` 紅實心。
  - 鍵帽與唯讀區隔：`#tvKeyB` 為 `solid`＋`3px` 厚底鍵帽，`#tvKeyBack7` 為 `dashed` 虛線＋45° 斜紋平面。
  - 音量分格錶：`100%` 時 `#g9VolCells` 10 格全亮。
  - 儲存即時預覽：改填 `#tvClearPromptText` 為 `測試清盤訊息123`，預覽橫幅即時同步且字數更新為 `9 / 40 字`。
  - 設定存檔與重開讀取：改桌號為 `888` 並點八角金實心「儲存」按鈕，對話框關閉；重新開啟設定對話框確認 `#tvTableNo` 讀回 `888`、頁首摘要顯示「紅金風格・888 桌」；按 Esc 正常關閉。
- **已檢視截圖**：`_面板比較\設定面板-Gemini9-Basic.png`、`_面板比較\設定面板-Gemini9-Keys.png`、`_面板比較\設定面板-Gemini9-Save.png`，以及與總覽對應元件之並排比對截圖。
- **未驗證／限制說明**：本次僅更動 `tv-比較-Gemini9.html`、`_面板比較\設定面板-Gemini9.css`、`_面板比較\選用表-Gemini9.md`，未更動正式 `tv.html` 或其他專案檔，亦未 git commit；暫時隱藏之 5 個分頁（畫面顏色、路單顏色、統計字級、統計顏色、符號調整）僅保留原結構與直角外形兜底，未逐頁展開檢查。
