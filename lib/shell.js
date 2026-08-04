const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

/**
 * 產生單本型錄的「薄殼」HTML。
 *
 * 這個檔案刻意只承載該本型錄專屬的資訊（標題、OG 預覽圖、型錄 id），
 * 翻閱邏輯全在共用的 viewer.js —— 改版時不需要重新產生已發佈的舊型錄。
 *
 * OG meta 必須寫死在 HTML 裡：LINE 與 Facebook 的預覽爬蟲不執行 JavaScript。
 */
export function renderShellHtml({ id, title, coverPath, siteBaseUrl, brand, bg = 'dark' }) {
  const fullTitle = escapeHtml(`${title} | ${brand}`);
  const origin = String(siteBaseUrl).replace(/\/+$/, '');
  const ogImage = coverPath
    ? `\n  <meta property="og:image" content="${escapeHtml(`${origin}/${coverPath}`)}">`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="index">
  <title>${fullTitle}</title>
  <meta property="og:type" content="website">
  <meta property="og:title" content="${fullTitle}">${ogImage}
  <link rel="stylesheet" href="../../viewer.css">
</head>
<body data-catalog-id="${escapeHtml(id)}" data-bg="${escapeHtml(bg)}">
  <script type="module" src="../../viewer.js"></script>
</body>
</html>
`;
}
