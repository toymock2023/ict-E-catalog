import { attachZoom } from './zoom.js';

const MESSAGES = {
  notFound: '找不到這本型錄',
  inactive: '本型錄已結束',
  empty: '本型錄尚未上架內容',
  failed: '型錄載入失敗，請稍後再試',
};

const catalogId = document.body.dataset.catalogId;
let pagesEl = null;
let currentIndex = 0;

function renderMessage(text) {
  document.body.innerHTML = `<div class="message">${text}</div>`;
}

export function goToPage(index) {
  if (!pagesEl) return;
  const clamped = Math.max(0, Math.min(index, pagesEl.children.length - 1));
  pagesEl.scrollTo({ left: clamped * pagesEl.clientWidth, behavior: 'smooth' });
}

function renderPages(catalog) {
  document.body.innerHTML = `
    <img class="brand" src="../../assets/ict-logo.png" alt="" aria-hidden="true">
    <div class="pages" id="pages"></div>
    <button class="nav prev" id="prev" type="button" aria-label="上一頁">‹</button>
    <button class="nav next" id="next" type="button" aria-label="下一頁">›</button>
    <div class="counter" id="counter"></div>
  `;

  pagesEl = document.getElementById('pages');
  const counterEl = document.getElementById('counter');
  const total = catalog.images.length;

  catalog.images.forEach((image, index) => {
    const figure = document.createElement('figure');
    figure.className = 'page';
    figure.dataset.index = String(index);

    const img = document.createElement('img');
    img.className = 'page-img';
    img.alt = `${catalog.title} 第 ${index + 1} 頁`;
    img.width = image.w;
    img.height = image.h;
    // 配合 width/height 屬性，讓瀏覽器在圖片載入前就保留正確版位，避免版面跳動
    img.style.aspectRatio = `${image.w} / ${image.h}`;
    img.dataset.src = `../../${image.src}`;
    img.dataset.orig = `../../${image.orig}`;
    img.src = img.dataset.src;
    // 只讓相鄰的圖立即載入，其餘交給瀏覽器延後
    img.loading = index <= 1 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.draggable = false;
    img.addEventListener('error', () => showRetry(figure, img), { once: true });

    figure.appendChild(img);
    pagesEl.appendChild(figure);
  });

  const updateCounter = () => {
    counterEl.textContent = `${currentIndex + 1} / ${total}`;
    document.getElementById('prev').hidden = currentIndex === 0;
    document.getElementById('next').hidden = currentIndex === total - 1;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          currentIndex = Number(entry.target.dataset.index);
          updateCounter();
        }
      }
    },
    { root: pagesEl, threshold: 0.6 },
  );
  for (const page of pagesEl.children) observer.observe(page);

  document.getElementById('prev').addEventListener('click', () => goToPage(currentIndex - 1));
  document.getElementById('next').addEventListener('click', () => goToPage(currentIndex + 1));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') goToPage(currentIndex - 1);
    if (event.key === 'ArrowRight') goToPage(currentIndex + 1);
  });

  updateCounter();
  attachZoom(pagesEl);
  document.dispatchEvent(new CustomEvent('viewer:ready', { detail: { pagesEl } }));
}

function showRetry(figure, img) {
  const box = document.createElement('div');
  box.className = 'retry';
  box.innerHTML = '<div>這張圖片載入失敗</div><button type="button">重新載入</button>';
  box.querySelector('button').addEventListener('click', () => {
    box.remove();
    figure.appendChild(img);
    img.addEventListener('error', () => showRetry(figure, img), { once: true });
    img.src = `${img.dataset.src}?retry=${Date.now()}`;
  });
  img.remove();
  figure.appendChild(box);
}

async function main() {
  if (!catalogId) return renderMessage(MESSAGES.notFound);
  try {
    const res = await fetch(`../../data/c/${catalogId}.json`, { cache: 'no-cache' });
    if (res.status === 404) return renderMessage(MESSAGES.notFound);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const catalog = await res.json();
    if (!catalog.active) return renderMessage(MESSAGES.inactive);
    if (!Array.isArray(catalog.images) || catalog.images.length === 0) {
      return renderMessage(MESSAGES.empty);
    }
    document.title = catalog.title;
    renderPages(catalog);
  } catch {
    renderMessage(MESSAGES.failed);
  }
}

main();
