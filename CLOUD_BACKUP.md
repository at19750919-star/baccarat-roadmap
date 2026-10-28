# 路單私人雲端備份

目前使用 OneDrive。按「儲存」保留原有本機清單及 JSON 下載，另從同一份路單快照產生完整橫向版面 PNG（標題、五路、統計、下局指示與限額），將 JSON＋PNG 送到私人收件後端。無須使用者登入業主帳號或選同步資料夾。

## 電視版儲存與部署設定（2026-10-29）

網路版 TV 新開分頁從零局開始，**同一分頁重新整理保留局數**（2026-10-29 使用者更正，取代 v10 每次重新整理歸零的行為）。進行中資料存於該分頁的 `sessionStorage.baccarat_tv_tab_rounds_v1`，各分頁獨立；網址帶 `preview=beads` 也不填入示範局。v10 已開分頁升級後首次重新整理，會接回舊版保存在 localStorage 的進行中局數；新開分頁不匯入這些舊資料。設定、已命名儲存的路單清單與雲端備份保留，清盤後重新整理仍為空。本機 TV 及一般版 `index.html` 維持原本重開續用局數的方式。`python tests/tv-empty-start.py` 驗證分頁、重新整理、升級接回、舊資料、偏好與已存路單；可加正式 TV 網址驗證線上行為。

`tv.html` 右上方新增可見的「儲存路單」，沿用一般版的命名、本機清單、JSON 下載與私人 OneDrive 收件。TV 版另外自動下載完整 PNG；若瀏覽器擋住連續下載，儲存結果仍提供 JSON／PNG 下載連結。`tv-export.js` 從同一份快照繪製完整六路，保留三星路三列、幸運7／超級幸運7與大小老虎及其統計；長路單橫向加寬，圖片不含儲存按鈕、提示或暫時動畫。

圖片副本保留自訂字級、選色及黑金造型。html2canvas 1.4 不支援選色後的 `color(srgb ...)` 漸層，輸出前將其轉成等值 `rgba`；限額改以靜態文字輸出，避免截圖套件裁切輸入框文字。已以黑金、自訂紅藍與格線、38欄及自訂統計字級驗證真實 PNG 產生；正式畫面仍使用原樣式。

實測發現舊後端只接受每局 `r/bp/pp/l6`，會以 `invalid_schema` 拒收已帶有 `l7/s7/tiger` 的新版 JSON。既有 GAS 收件網址已更新到 v17，新增三個可選欄位的嚴格型別檢查；原四欄格式、統計一致性、PNG 驗證及收件限制保留。`backend/road_entry.gs` 是替換既有 `roadEntry_` 的來源快照，需連同 `roadRound_` 使用，不可保留兩個同名函式。

已從使用者的 `http://127.0.0.1:8082/roadmap/tv.html` 在隔離瀏覽器以20局特殊符號資料實際上傳；POST 與同收件碼查詢均確認 OneDrive 收齊 JSON＋PNG。這次未逐位元讀回雲端檔案；正式 Pages 驗證的本機 JSON／PNG 下載內容與實際送出內容一致。184局完整六路、快照期間繼續輸入、失敗保留下載與原收件碼重試、一般版圖片輸出及原 OneDrive 7組回歸通過。證據保留於本機忽略目錄 `.preview/tv-save`。

使用者指定部署版只顯示「基本設定」「按鍵設定」兩個分頁。`tv.js` 在一般網站網址採用此限制；`file:`、`localhost`、`127.0.0.1`、`[::1]` 保留完整七個分頁。鍵盤切換略過隱藏分頁，部署版不接受直接開啟統計字級的網址參數。這是介面顯示選擇，不是登入權限。2026-10-29 已發布至 GitHub Pages，正式入口為 https://at19750919-star.github.io/baccarat-roadmap/tv.html 。已在正式網址確認只顯示這兩個分頁，並驗證設定儲存重開、輸入／退局、圖片與語音資源、JSON＋PNG下載及 OneDrive 收齊。

驗證：`python tests/tv-save.py`（模擬雲端，實際產生PNG）、`TV_REAL_CLOUD=1 python tests/tv-save.py`（實際建立一筆雲端備份）、`python tests/tv-deployment.py`、`node tests/tv-backup-schema.cjs`。正式驗證需本機8082服務及 `.preview/html2canvas.min.js` 測試快取；不要把私人授權帶入專案。

只有後端確認兩個檔案都寫入，畫面才顯示「OneDrive 已收齊」。拒絕、斷線或逾時不算成功；仍可下載 JSON／PNG，並以同一個收件碼重試，避免重複建立已完成的備份。

## 業主維護

- 收件位置：OneDrive「我的檔案」最外層的 `路單收件`（2026-10-24 從 Apps/rclone 搬移，原資料夾識別碼保留）。資料夾須維持私人；不可建立公開分享連結。
- 業主於 2026-10-24 明確同意擴大為 `Files.ReadWrite` 加離線存取，以支援最外層收件；程式仍只操作指定收件資料夾。此授權可讀寫 OneDrive 檔案，不再是僅應用程式資料夾。授權由後端私人設定維護；網站不含密碼或更新權杖。
- 後端為既有 Google Apps Script「百家樂語音」，現有部署更新至第 16 版；Excel 舊協定沿用 Google Drive，新路單改送 OneDrive。
- 私人授權存於 Script Properties 的 `road_inbox_v1_onedrive_config`；`road_inbox_v1_provider` 設為 `onedrive`；config 的 `scope` 為 `Files.ReadWrite`。舊 config 缺省 scope 仍僅用 AppFolder，不可自行換成 `.All` 權限。不要將設定值放入 Git、前端或公開紀錄。
- 若顯示授權失效，需由業主重新授權；不可把錯誤提示改成成功，也不可改用業主電腦的同步資料夾冒充雲端收件。
- 後端只回傳無法猜中的收件碼及狀態，不回傳檔案識別碼或下載網址。既有查詢／下載介面不能讀取 OneDrive 收件內容。

## 最外層收件（2026-10-24）

業主要求免逐層進入 Apps/rclone，並明確同意擴大授權。原資料夾以同 drive 搬移到「我的檔案」最外層，未複製或刪除原檔，識別碼不變。搬移前後 24 個項目保留，其中 14 個檔案的 id/name/size/hash 全部一致；資料夾仍私人。

搬移後已從正式 Pages 重新實測 20／184 局 JSON＋完整 PNG 收件，四檔從新位置下載逐位元一致，同收件碼重送不重複。OneDrive「我的檔案」頁面實際可直接看到「路單收件」。新授權和 token 僅存 GAS 私人 Script Properties，不放入這個 repo。

來源及本機證據：`Documents/Codex/2026-10-24/onedrive-root-inbox`；`move-result.json`、`e2e-result.json`、`twenty-result.json`。前端網址和行為不需因此更改。

## PNG 版面

2026-10-24 改為沿用網站完整橫向版面，不再把五路直式堆疊；一般路單輸出 2880×1620，長路單會加寬以保留所有欄位。圖片不含儲存提示，雲端檔案與 PNG 下載使用同一份圖片。`node tests/export-layout.cjs` 可驗證 20／184 局的完整版面、快照一致及完整欄位；需安裝 Playwright 和 Chrome。離線測試可用 `HTML2CANVAS_TEST_FILE` 指定 html2canvas，`EXPORT_TEST_OUTPUT` 指定輸出目錄。

## 本次收件修正（2026-10-24）

後端私人診斷確認兩筆失敗都為 Microsoft Graph 建立子資料夾回 `404 itemNotFound`。原收件資料夾讀取和私人權限檢查成功，之後同一資料夾仍能建立檔案；不能由此推定容量不足，也尚無證據指出 Microsoft 內部為何間歇回 404。

舊程式遇一次 404 即結束。v15 只在此錯誤時，先確認原收件資料夾仍存在，再查剛才同名子資料夾是否已建立；只可接續同 parent、同名且空白的資料夾。仍未建立時最多嘗試 3 次（400／1200ms 間隔），固定同名且不自動改名，避免重複建立。其他錯誤或持續失敗仍回報未收齊，絕不當作成功。

正式網站已重新以匿名瀏覽器驗證 20 局（2880×1620）與 184 局（11998×1234）：各一份 JSON＋完整 PNG 真實寫入 OneDrive，下載逐位元與送出一致；原儲存/JSON下載、儲存期間快照、重複點擊和同收件碼重送均通過，四檔無公開分享。gpt-6-sol 唯讀獨立驗收亦直接讀回四檔並比對通過。

新增 404 回歸測試可證明原版失敗、修正版恢復；13 組含舊協定的測試通過。這兩組實際成功未觀測到 404，不代表已證實 Microsoft 內部原因或根治所有服務故障。

`backend/road_onedrive.gs` 是已部署 v16 的來源快照，`node tests/onedrive-receiver.cjs` 執行 7 組可攜回歸測試。GitHub Pages 不執行此後端；更新時須保留 GAS 原有程式碼和私人設定，另發布 GAS 版本。完整來源、原版備份與實檔證據在 `Documents/Codex/2026-10-24/onedrive-inbox-fix`；不得將私人授權放入 Git。

## 驗證及限制

2026-10-23 已以全新匿名瀏覽器測試 184 局快照，同時保留本機清單與 JSON 下載、阻止重複儲存；OneDrive 收到 JSON＋11871×2021 PNG，兩檔下載回來與送出內容逐位元一致，無公開權限。失敗／逾時／重試另有模擬測試。

正式 GitHub Pages 也已實測成功（後端 v14）。其中較早一次正式請求曾失敗，v13 未保存足夠細節，原因未證實；v14 新增私人收件紀錄的服務錯誤碼／階段，匿名介面仍只回狀態，不公開診斷或憑證。v14 並未改變上傳邏輯，不能把之後成功說成已查明或根治該次失敗。

Google Drive 原先寫檔失敗已取得原始 `403 userRateLimitExceeded`；容量充足，空檔可建立，但內容上傳被拒。尚無證據能指定限制種類或恢復時間，因此改用 OneDrive。原 Excel 列表與下載實測正常，Excel 上傳程式未更動且模擬測試通過；Google 真實上傳限制未因此解除。

本機後端來源、診斷及測試證據保留在業主電腦的 `Documents/Codex/2026-10-23/road-cloud-takeover`。其中 `.private` 為私人授權，不可公開。Google 授權／Apps Script 及 Microsoft OneDrive 必須持續有效；業主電腦無須開機。

## TV 正式發布驗證（2026-10-29）

發布來源版本 `8748bdd`（`main`／根目錄，沿用既有 Pages 設定）。正式網址回200；線上設定僅兩分頁、儲存重開與輸入退局通過。9張頁面圖片成功解碼，14項程式／樣式／圖片／語音資源與本機檔案雜湊一致，兩段長龍影片可讀取。隔離瀏覽器以20局測試資料實際取得 JSON＋PNG 下載並送往 OneDrive，後端確認收齊，無頁面程式錯誤。驗證憑據保留在本機忽略目錄 `.preview/deploy-tv/result.json`；未公開收件碼或私人授權。未提交的亂路修改與未使用的素材保留在本機。
