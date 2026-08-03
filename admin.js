import { CONFIG } from './config.js';
import { createGitHubClient } from './lib/github.js';
import {
  createIndex,
  createCatalog,
  takeSeq,
  addImages,
  syncIndexEntry,
  imageFileName,
} from './lib/catalog.js';
import { calcTargetSize } from './lib/resize.js';
import { renderShellHtml } from './lib/shell.js';
import { generateId } from './lib/id.js';

const TOKEN_KEY = 'ict-e-catalog.token';

export const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  index: createIndex(),
  client: null,
};

const el = {
  tokenScreen: document.getElementById('token-screen'),
  mainScreen: document.getElementById('main-screen'),
  tokenInput: document.getElementById('token-input'),
  saveToken: document.getElementById('save-token'),
  clearToken: document.getElementById('clear-token'),
  list: document.getElementById('catalog-list'),
  status: document.getElementById('status'),
};

export function getClient() {
  if (!state.client) {
    state.client = createGitHubClient({
      owner: CONFIG.owner,
      repo: CONFIG.repo,
      branch: CONFIG.branch,
      token: state.token,
    });
  }
  return state.client;
}

export function showStatus(text, kind = 'info') {
  el.status.textContent = text;
  el.status.className = `status ${kind}`;
  el.status.hidden = false;
}

export function clearStatus() {
  el.status.hidden = true;
}

export async function loadIndex() {
  const data = await getClient().readJson('data/index.json');
  state.index = data || createIndex();
}

export function catalogUrl(id) {
  return `${CONFIG.siteBaseUrl.replace(/\/+$/, '')}/c/${id}/`;
}

export function renderList() {
  el.list.innerHTML = '';
  if (state.index.catalogs.length === 0) {
    el.list.innerHTML = '<li class="empty">還沒有任何型錄，用上面的表單建立第一本。</li>';
    return;
  }

  for (const entry of state.index.catalogs) {
    const li = document.createElement('li');
    li.className = 'catalog-row';
    // 沒有封面時不能留空的 src —— 空字串會讓瀏覽器重新請求目前這一頁
    const cover = entry.cover
      ? `<img src="${entry.cover}?v=${encodeURIComponent(entry.updatedAt)}" alt="">`
      : '<img alt="" style="visibility:hidden">';
    li.innerHTML = `
      ${cover}
      <div class="meta">
        <div class="title"></div>
        <div class="sub">${entry.imageCount} 張 ・ 更新於 ${formatTime(entry.updatedAt)}</div>
      </div>
      <span class="badge ${entry.active ? '' : 'off'}">${entry.active ? '上架中' : '已下架'}</span>
      <button type="button" class="ghost" data-open="${entry.id}">管理</button>
    `;
    // 型錄名稱由使用者輸入，一律用 textContent 避免把 HTML 塞進頁面
    li.querySelector('.title').textContent = entry.title;
    el.list.appendChild(li);
  }
}

function formatTime(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function connect() {
  showStatus('連線中…', 'info');
  try {
    await loadIndex();
    el.tokenScreen.hidden = true;
    el.mainScreen.hidden = false;
    el.clearToken.hidden = false;
    renderList();
    clearStatus();
  } catch (err) {
    el.tokenScreen.hidden = false;
    el.mainScreen.hidden = true;
    showStatus(err.message, 'error');
  }
}

el.saveToken.addEventListener('click', async () => {
  const value = el.tokenInput.value.trim();
  if (!value) return showStatus('請先貼上 Token', 'error');
  state.token = value;
  state.client = null;
  localStorage.setItem(TOKEN_KEY, value);
  el.tokenInput.value = '';
  await connect();
});

el.clearToken.addEventListener('click', () => {
  localStorage.removeItem(TOKEN_KEY);
  state.token = '';
  state.client = null;
  el.mainScreen.hidden = true;
  el.clearToken.hidden = true;
  el.tokenScreen.hidden = false;
  showStatus('Token 已清除', 'info');
});

if (state.token) {
  connect();
} else {
  el.tokenScreen.hidden = false;
}

/** 在瀏覽器內用 canvas 產生壓縮版。原圖不重新編碼，另外原封不動上傳。 */
async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const { width, height } = calcTargetSize(bitmap.width, bitmap.height, CONFIG.maxEdge);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', CONFIG.jpegQuality));
  if (!blob) throw new Error(`圖片壓縮失敗：${file.name}`);
  return { blob, width, height };
}

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // 分塊處理：一次 apply 太多元素會爆掉呼叫堆疊
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function textToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// file.type 已經過 ACCEPTED_TYPES 白名單過濾，直接對應比從檔名猜測可靠
// （檔名可能沒有副檔名，或副檔名與實際內容不符）。
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function fileExt(file) {
  return EXT_BY_MIME[file.type] || 'jpg';
}

// 白名單而非「startsWith('image/')」：iPhone 預設拍照格式是 HEIC，
// 多數瀏覽器的 createImageBitmap 無法解碼，會讓壓縮這一步失敗且錯誤訊息不知所云。
// 與其讓使用者看到看不懂的失敗訊息，不如上傳前就明確擋下並說明原因。
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validateFiles(files) {
  const accepted = [];
  const rejected = [];
  for (const file of files) {
    if (!ACCEPTED_TYPES.has(file.type)) {
      rejected.push(`${file.name}（格式不支援，請先轉成 JPG / PNG / WebP 再上傳）`);
    } else if (file.size > CONFIG.maxFileBytes) {
      rejected.push(`${file.name}（超過 ${Math.round(CONFIG.maxFileBytes / 1024 / 1024)}MB）`);
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}

/** 產生該型錄的 JSON 與薄殼 HTML。任何會改到標題或封面的操作都要重跑這支。 */
function buildCatalogFiles(catalog) {
  const html = renderShellHtml({
    id: catalog.id,
    title: catalog.title,
    coverPath: catalog.images.length > 0 ? catalog.images[0].src : null,
    siteBaseUrl: CONFIG.siteBaseUrl,
    brand: CONFIG.brand,
  });
  return [
    { path: `data/c/${catalog.id}.json`, base64: textToBase64(JSON.stringify(catalog, null, 2)) },
    { path: `c/${catalog.id}/index.html`, base64: textToBase64(html) },
  ];
}

function indexFile(index) {
  return { path: 'data/index.json', base64: textToBase64(JSON.stringify(index, null, 2)) };
}

export async function commit(message, { upserts = [], deletes = [] }) {
  const sha = await getClient().commitFiles({
    message,
    upserts,
    deletes,
    onProgress: (done, total) => showStatus(`上傳中… ${done} / ${total}`, 'info'),
  });
  return sha;
}

const newForm = document.getElementById('new-catalog-form');
const newTitle = document.getElementById('new-title');
const newFiles = document.getElementById('new-files');

newForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitBtn = newForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    const title = newTitle.value.trim();
    if (!title) throw new Error('請輸入型錄名稱');

    const { accepted, rejected } = validateFiles([...newFiles.files]);
    const rejectedNote = rejected.length > 0 ? `已略過：${rejected.join('、')}｜` : '';
    if (accepted.length === 0) throw new Error('沒有可用的圖片');

    showStatus(`${rejectedNote}壓縮圖片中…`, 'info');
    const id = generateId(state.index.catalogs.map((c) => c.id));

    let catalog = createCatalog({ id, title });
    const taken = takeSeq(catalog, accepted.length);
    catalog = taken.catalog;

    const upserts = [];
    const images = [];
    for (const [i, file] of accepted.entries()) {
      const seq = taken.seqs[i];
      const ext = fileExt(file);
      const { blob, width, height } = await compressImage(file);

      const srcPath = `img/${id}/${imageFileName(seq, 'display', 'jpg')}`;
      const origPath = `img/${id}/${imageFileName(seq, 'orig', ext)}`;

      upserts.push({ path: srcPath, base64: await blobToBase64(blob) });
      upserts.push({ path: origPath, base64: await blobToBase64(file) });
      images.push({ src: srcPath, orig: origPath, w: width, h: height });

      showStatus(`${rejectedNote}壓縮圖片中… ${i + 1} / ${accepted.length}`, 'info');
    }

    catalog = addImages(catalog, images);
    const index = syncIndexEntry(state.index, catalog, new Date().toISOString());

    upserts.push(...buildCatalogFiles(catalog), indexFile(index));
    await commit(`feat: 新增型錄「${title}」`, { upserts });

    state.index = index;
    renderList();
    newForm.reset();
    showStatus(
      `${rejectedNote}已送出。GitHub Pages 部署中，約 30～60 秒後生效：${catalogUrl(id)}`,
      'success',
    );
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
