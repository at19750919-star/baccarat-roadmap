# Claude Code 視窗顏色 mod

依專案資料夾，替每個 Claude Code 視窗上不同顏色：
- 桌面版：整個視窗背後鋪上專案色（面板半透明，顏色會透出來）
- 輸入框上方：一條專案色帶，寫著專案名稱
- 狀態列：● 專案名稱

目前設定：呆球 = 藍色、百家樂 = 紅色，其他專案自動配固定顏色。
要改顏色或加專案：編輯 plugins/window-color/hooks/register.tsx 最上面的 RULES。

## 安裝（在任一個 Claude Code 視窗的輸入框打）
/plugin marketplace add C:\Users\at197\OneDrive\Desktop\專案-進行中\百家樂路單\_工具\claude-視窗顏色
/plugin install window-color@at-local

裝完把各視窗重新開一次（或開新對話）就會生效。
不想要了：/plugin uninstall window-color@at-local
