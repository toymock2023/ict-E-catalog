# 部署與使用說明

## 一次性部署步驟

1. 在 GitHub 建立 **public** repo：`toymock2023/ict-E-catalog`
   （必須是 public —— private repo 開 GitHub Pages 需要付費升級）

2. 把本資料夾推上去：

   ```bash
   git remote add origin https://github.com/toymock2023/ict-E-catalog.git
   git push -u origin main
   ```

3. GitHub repo → **Settings → Pages**
   - Source：`Deploy from a branch`
   - Branch：`main` / `/ (root)`
   - 存檔後等 1～2 分鐘

4. 申請 Token：GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   - Repository access：`Only select repositories` → 選 `ict-E-catalog`
   - Permissions → Repository permissions → **Contents: Read and write**（其他全部不用勾）
   - Expiration 建議設 1 年，到期後重新申請並在後台重新貼上

5. 開啟後台網址（見交付時提供的書籤），貼上 Token 即可開始使用。

## 日常使用

- **新增型錄**：填名稱 → 選圖片（順序即翻頁順序）→ 建立型錄 → 等 30～60 秒 → 複製連結或下載 QR
- **管理型錄**：在清單上按「管理」，可改名、上下架、增刪圖片、調整順序、刪除整本
- **下架 vs 刪除**：下架後舊連結仍可開啟但顯示「本型錄已結束」；刪除則連結完全失效且無法復原

## 注意事項

- 網址 `ict-E-catalog` 中的 **E 是大寫**，GitHub Pages 路徑區分大小寫
- 每次操作都要等 GitHub Pages 部署完成（約 30～60 秒）才看得到變更
- repo 是 public，任何人都能看到型錄圖片與後台檔名；真正的防線是 Token，沒有它改不了任何東西
- 圖片建議控制在每張 2MB 內、單本 8～12 張，避免 repo 過度膨脹

## 開發者備註

跑測試時請用 `node --test tests/*.test.js`（明確展開檔案清單）—— `node --test tests/` 在本機環境無法正確 glob 該目錄，會誤判為 0 個測試。
