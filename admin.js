import { CONFIG } from './config.js';
import { createGitHubClient } from './lib/github.js';
import { createIndex } from './lib/catalog.js';

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
