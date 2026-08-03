import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderShellHtml, escapeHtml } from '../lib/shell.js';

const base = {
  id: 'a7f3k2',
  title: '2026 秋冬新品',
  coverPath: 'img/a7f3k2/01.jpg',
  siteBaseUrl: 'https://toymock2023.github.io/ict-E-catalog',
  brand: '毓秀堂',
};

test('escapeHtml 跳脫所有危險字元', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('薄殼頁帶入型錄 id 供 viewer 讀取', () => {
  const html = renderShellHtml(base);
  assert.match(html, /data-catalog-id="a7f3k2"/);
});

test('標題與 og:title 都含品牌名', () => {
  const html = renderShellHtml(base);
  assert.match(html, /<title>2026 秋冬新品 \| 毓秀堂<\/title>/);
  assert.match(html, /property="og:title" content="2026 秋冬新品 \| 毓秀堂"/);
});

test('og:image 是完整絕對網址', () => {
  const html = renderShellHtml(base);
  assert.match(
    html,
    /property="og:image" content="https:\/\/toymock2023\.github\.io\/ict-E-catalog\/img\/a7f3k2\/01\.jpg"/,
  );
});

test('siteBaseUrl 結尾有斜線時不產生雙斜線', () => {
  const html = renderShellHtml({ ...base, siteBaseUrl: 'https://toymock2023.github.io/ict-E-catalog/' });
  assert.equal(html.includes('ict-E-catalog//img'), false);
});

test('型錄標題含 HTML 特殊字元時被跳脫', () => {
  const html = renderShellHtml({ ...base, title: '秋冬 <新品> & "特惠"' });
  assert.equal(html.includes('<新品>'), false);
  assert.match(html, /秋冬 &lt;新品&gt; &amp; &quot;特惠&quot;/);
});

test('沒有封面時不輸出 og:image', () => {
  const html = renderShellHtml({ ...base, coverPath: null });
  assert.equal(html.includes('og:image'), false);
});

test('資源路徑相對於 /c/<id>/ 往上兩層', () => {
  const html = renderShellHtml(base);
  assert.match(html, /href="\.\.\/\.\.\/viewer\.css"/);
  assert.match(html, /src="\.\.\/\.\.\/viewer\.js"/);
});
