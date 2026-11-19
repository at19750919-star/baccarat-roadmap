# TASK-編輯模式

先讀 D 的 AGENTS.md / 交接紀錄.md / 進度.md（若有）。專案 D=C:\Users\at197\OneDrive\Desktop\專案-進行中\百家樂路單（tv.html、tv.css、tv.js、tv-*.js）；共用元件 S=C:\Users\at197\OneDrive\Desktop\專案-進行中\共用元件（css-controls、color-picker 含透明度、font-picker 含字色、settings-io、version-snapshot；參考 S\bet-panel\demo.html 如何用 ../ 路徑引用）。

## 目標
在 tv.html 加「編輯」按鈕。開啟後點畫面上任何一塊，在畫面上直接叫出浮動編輯面板（可拖、不蓋住被編輯物）。
- 先做左上 .tv-table-board 卡片及其內部元素：外框、VIP BACCARAT、尊榮百家樂、標籤、數字、各小格。
- 預留上方限紅表、左下統計區等可點。
- 可調：背景色/漸層、框線顏色粗細圓角、陰影、文字尺寸、字色、字型、字距、可編輯文字內容（如桌號 001、靴號 01、標題文字；局數是程式自動算，不可改）。
- 面板工具必須用 ../共用元件/... 直接引用原檔，不複製。

## 硬規則
- 編輯在 tv.html 原畫面原尺寸上進行，不搬到別的畫布、不重排、不縮放。
- 未開編輯模式時外觀與現在完全一樣（像素比對）。
- 設定存 localStorage，重新整理保留；可用 settings-io 匯出匯入、version-snapshot 存版本；每項可重設回原值。
- 不影響既有路單、快捷鍵、設定視窗、儲存路單、匯出 PNG 功能（匯出 PNG 時不含編輯框）。
- 禁用系統字體（Segoe UI、PingFang TC、Microsoft JhengHei、微軟正黑體、Arial、system-ui）；禁原生 select。
- 面板風格照 C:\Users\at197\OneDrive\Desktop\專案-進行中\ATLL-穿越排牌\賭場綠金風格.md；不加裝飾英文標語。
- 改前備份 tv.html、tv.css、tv.js 為 *.bak-editmode。
- 不要 commit、不要部署、不要改共用元件原檔（若必須改，寫在回報裡）。

## 自檢 tv.html?check=1
- 未編輯時外觀不變（與備份版對照截圖像素比對）
- 真實點擊選到左上卡片與內部元素
- 改背景色/字色/字級/框線後 computed style 真的變
- 重新載入保留、重設還原、匯出含設定
- 既有功能仍正常、無頁面錯誤
- 截圖存 D\verify-editmode\
- 操作說明寫進 README 或交接紀錄。