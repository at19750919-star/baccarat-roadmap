# 重做「電視版」tv.html（上一版不合格，整個重來）

上一版問題：另創了陽春風格、一堆空框和「—」、沒有任何功能。這次照下面做。

## 規則
- 不可修改任何原有檔案（index.html、app.js、style.css、themes.css、themes.js、road_backup.js 等）。不要 commit。
- tv.html / tv.css / tv.js 可以整個覆蓋或刪掉重寫；tv-at-logo.png 沿用。
- 1920×1080 固定畫布、等比縮放、無捲軸、不能有任何空框或「—」。

## A. 直接沿用原本程式
tv.html 要直接載入原本的 style.css、themes.css、themes.js、road_backup.js、app.js（順序與 index.html 相同），並保留 index.html 裡 app.js 用到的全部元素與 id/class：所有 data-action 按鈕、#confirmBtn #undoBtn #clearBtn、#bigRoad #bigEye #smallRoad #cockroachRoad #beadBoard、#cntB #cntP #cntT #cntBP #cntPP #cntL6 #totalCount、.limit-input（data-k）、#soundToggleBtn #volumeUpBtn #volumeDownBtn #fullscreenBtn #screenshotBtn #setAmountBtn #saveBtn、#themeSelect、#dragonOverlay、#bossScreen、#backupNotice 等（請逐一對照 index.html 與 app.js 裡所有 getElementById / querySelector，一個都不能少）。這樣所有功能（1~6+Enter 輸入、7 退／雙擊金額、雙擊 8 隱藏、雙擊 9 清、F 全螢幕、音效、截圖、存檔雲端備份、長龍特效、造型切換）自動跟原本一樣。
不要改 app.js；新頁面只新增 tv.css 做「位置重排」，盡量不重寫元件外觀。tv.js 若不需要可以不要，或只放極少量輔助（例如桌號/靴號預設值），不可重複實作 app.js 的功能。

## B. 外觀沿用原本
鮮紅底、金框白格、大字灰色浮水印標題（大路、大眼仔、蟑螂路/甲由路、小路、珠子路）、立體按鈕、紅藍綠紫黃分明的統計格、彩色限額列、原本的下局指示圖例。不另創風格。

## C. 位置排法
- 最上列：
  - 左上＝快捷鍵說明（同 index.html 的 .key-legend 內容：1莊 2閒 3和 4莊對 5閒對 6幸運6 ⏎確定 7退 雙擊7金額 雙擊8隱藏 雙擊9清 F全螢幕），字要大到電視看得清楚。
  - 中＝限紅列：用原本的 .limit-input 莊/閒、和、對子、幸運6 四組，橫向排成「項目／最高／最低」表格，有預設值、可直接改。
  - 右＝AT 黑桃 Logo（tv-at-logo.png）。
  - 原本標題列的輸入按鈕（莊閒和…確定退清）、7 個功能圖示、造型選單要保留在畫面上（可縮小放在 Logo 旁或最上列），不能拿掉。
- 大路全寬。
- 第二列：大眼仔｜蟑螂路(甲由路)。
- 第三列：小路｜三星路（規則未定：放一個同樣格線的框加浮水印「三星路」，不要空白無標題）。
- 底部：左＝原本的統計區（莊閒和莊對閒對幸運6，加上桌號、靴號、局數；用原本 title-bar 的 stats-inline 數值，桌號/靴號預設值 1）｜中＝珠子路（加寬）｜右＝原本的下局指示圖例。

## 自我檢查
完成後用 Playwright（Python 版可用）1920×1080 開 tv.html，往 localStorage baccarat_road_rounds_v1 塞約 40 局含和、對子、幸運6 的資料（格式照 app.js）再重整，確認各路有點、統計正確、console 無錯誤、按 1+Enter 會多一顆莊。
