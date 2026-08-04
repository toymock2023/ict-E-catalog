# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

毓秀堂的純圖片電子型錄工具。後台可建立多本子型錄、產生連結與 QR Code；子型錄頁在手機上左右滑動翻頁、可縮放。無後端、無資料庫、無建置步驟 —— 靜態檔案直接部署到 GitHub Pages，寫入靠瀏覽器直接呼叫 GitHub API。

設計文件在上層目錄：`../docs/superpowers/specs/2026-08-03-image-catalog-design.md`。

## Commands

```bash
# 跑純邏輯測試（明確展開檔案清單 —— node --test tests/ 在本機環境無法正確 glob 該目錄）
node --test tests/*.test.js

# 單檔語法檢查（不執行）
node --check admin.js

# 本機預覽（從上層 ict商品行銷規劃/ 目錄，.claude/launch.json 已定義 ict-E-catalog 這個 target）
python -m http.server 8789 --directory ict-E-catalog
```

無 npm、無 lint 設定、無 CI。

## Architecture

### 寫入路徑：瀏覽器 → GitHub Git Data API → Pages

後台 (`admin.js`) 把一次操作的**所有**變更收斂成**單一 git commit**：先把每個檔案傳成 blob，再組 tree、建 commit，最後 `PATCH ref`。只有最後一步會改變 repo 狀態，所以中途失敗不會留下「有圖沒清單」的破損狀態。

**不要改用 Contents API** —— 那支一次只能寫一個檔，一本 8 張圖的型錄要打 19 次，任一次失敗就會讓資料半套。

### 資料存在 repo 裡，不是資料庫

- `data/index.json` — 型錄索引，**只有後台讀**
- `data/c/<id>.json` — 單本型錄，**只有客戶端讀**（所以子型錄頁的載入成本不隨型錄總數增加）
- `img/<id>/NN.jpg` 顯示版、`img/<id>/NN.orig.<ext>` 原圖

`index.json` 的 `cover` 與 `imageCount` **一律由 `syncIndexEntry()` 從型錄物件重算**，不接受呼叫端傳入 —— 這是「cover 恆等於 images[0].src」唯一的執行點。改動型錄時走這支，`og:image` 才不會停在舊封面。

檔名序號來自型錄 JSON 的 `nextSeq` 計數器，**刪除圖片不會讓它倒退**。改成「現有最大序號 + 1」會讓刪掉最後一張再新增時拿到同一個檔名，客戶會因為瀏覽器／CDN 快取看到已刪除的舊圖。

### 子型錄頁是「薄殼」

`c/<id>/index.html` 只有標題、OG meta 和一行載入 `viewer.js`。翻閱邏輯全在共用的 `viewer.js`，**改版只要改一個檔，已發佈的舊型錄自動跟著更新**。

OG meta 必須寫死在 HTML 裡 —— LINE 與 Facebook 的預覽爬蟲不執行 JavaScript。這是選擇「每本一個實體 HTML 檔」而非「單一頁面 + 網址參數」的原因。

瀏覽頁背景（黑／白，`body[data-bg]`）也是同樣道理寫死在薄殼 HTML 裡，而不是讓 `viewer.js` 抓到型錄 JSON 後才動態套用 —— 否則淺色型錄會先閃一下預設的黑底再變白。

### 翻頁與縮放

翻頁用 CSS `scroll-snap-type: x mandatory` + `scroll-snap-align: center`，吸附由瀏覽器排版引擎負責。**不要換成 JS 手寫的翻頁**，慣性手感會明顯變差。

`zoom.js` 在放大時必須做三件事：關掉 snap、鎖住橫向捲動、把 `touch-action` 設為 `none`。少任何一件，使用者想拖曳放大的圖就會變成翻頁。純數學部分在 `lib/zoommath.js`，有測試覆蓋。

`.page-img` 的 `background`（`--placeholder-bg`，圖片載入前／`object-fit: contain` 沒完全填滿框時的底色）**顏色必須貼近同色系的 `--bg`**，不能選一個「看起來協調但有落差」的顏色。深色模式的 `#2a2a2a` 跟 `#1a1a1a` 幾乎沒差所以不明顯；淺色模式一開始選的 `#eee` 在部分瀏覽器上會因為圖片沒貼滿框而露出縫隙，對比純白背景 `#fff` 就變成一塊明顯的灰塊，後來改成 `#fdfdfd` 才解決。

### 後台的 `<dialog>`

管理型錄用的 `<dialog>` 內容常比視窗高，捲動由 `<dialog>` 元素自己負責（不是外層 `body`）。狀態列 `#dialog-status` 必須用 `position: sticky` 貼在這個捲動區頂端——不然使用者捲到下面點「上傳新圖片」時，進度訊息會跟著內容捲出畫面看不到。同理，`showStatus()`/`clearStatus()` 除了更新最外層的全域 `#status`，也要同步寫進 `#dialog-status`：dialog 開啟時屬於瀏覽器 top layer，會蓋住頁面其餘內容，只更新全域 `#status` 使用者根本看不到。

### `lib/` 的規矩

`lib/` 內的模組不碰 DOM、不直接呼叫 `fetch`（`github.js` 以注入方式接收 `fetch`），所以能在 Node 中直接測試。新的商業邏輯盡量放這裡。

## Constraints

- repo 必須是 **public**（免費 Pages 的條件），網址 `ict-E-catalog` 的 **E 是大寫**，路徑區分大小寫
- 不引入 npm 套件、打包工具或框架；外部函式庫放 `vendor/`，不用 CDN
- 客戶可見文案逐字固定：`找不到這本型錄`、`本型錄已結束`、`本型錄尚未上架內容`、`型錄載入失敗，請稍後再試`
- 後台檔案的實際檔名不寫進任何已提交的文件（本檔案、`DEPLOY.md` 皆同），只以實體檔案存在、直接告知需要使用的人
