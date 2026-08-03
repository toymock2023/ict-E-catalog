import { clampScale, clampPan } from './lib/zoommath.js';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 30;

export function attachZoom(pagesEl) {
  for (const page of pagesEl.querySelectorAll('.page')) {
    setupPage(pagesEl, page);
  }
}

function setupPage(pagesEl, page) {
  const img = page.querySelector('.page-img');
  if (!img) return;

  const state = { scale: 1, tx: 0, ty: 0, origLoaded: false };
  const pointers = new Map();
  let pinchStart = null;
  let panStart = null;
  let lastTap = null;

  function apply() {
    const rect = page.getBoundingClientRect();
    const clamped = clampPan({
      scale: state.scale,
      tx: state.tx,
      ty: state.ty,
      viewW: rect.width,
      viewH: rect.height,
      contentW: img.clientWidth,
      contentH: img.clientHeight,
    });
    state.tx = clamped.tx;
    state.ty = clamped.ty;

    if (state.scale === 1) {
      img.style.transform = '';
    } else {
      img.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
    }
  }

  function setZoomed(zoomed) {
    // 放大時必須做的三件事：關掉 snap、鎖住橫向捲動、讓手勢改由這張圖消費。
    // 少了任何一件，使用者想拖曳放大的圖就會變成翻頁。
    pagesEl.style.scrollSnapType = zoomed ? 'none' : '';
    pagesEl.style.overflowX = zoomed ? 'hidden' : '';
    img.style.touchAction = zoomed ? 'none' : '';

    if (zoomed && !state.origLoaded && img.dataset.orig) {
      state.origLoaded = true;
      img.src = img.dataset.orig; // 放大才載原圖，看得清規格小字
    }
    if (!zoomed) {
      page.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  }

  function setScale(next, focusX, focusY) {
    const previous = state.scale;
    const scale = clampScale(next, MIN_SCALE, MAX_SCALE);
    if (scale === previous) return;

    // 以焦點為中心縮放：焦點在圖片上的位置維持不變
    const rect = page.getBoundingClientRect();
    const px = focusX - rect.left;
    const py = focusY - rect.top;
    state.tx = px - ((px - state.tx) / previous) * scale;
    state.ty = py - ((py - state.ty) / previous) * scale;
    state.scale = scale;

    if (previous === 1 && scale > 1) setZoomed(true);
    if (scale === 1) {
      state.tx = 0;
      state.ty = 0;
      setZoomed(false);
    }
    apply();
  }

  img.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, event);

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { distance: distance(a, b), scale: state.scale };
      panStart = null;
    } else if (pointers.size === 1 && state.scale > 1) {
      img.setPointerCapture(event.pointerId);
      panStart = { x: event.clientX, y: event.clientY, tx: state.tx, ty: state.ty };
    }
  });

  img.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, event);

    if (pointers.size === 2 && pinchStart) {
      event.preventDefault();
      const [a, b] = [...pointers.values()];
      const ratio = distance(a, b) / pinchStart.distance;
      setScale(pinchStart.scale * ratio, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
    } else if (panStart && state.scale > 1) {
      event.preventDefault();
      state.tx = panStart.tx + (event.clientX - panStart.x);
      state.ty = panStart.ty + (event.clientY - panStart.y);
      apply();
    }
  });

  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) panStart = null;
  }

  img.addEventListener('pointerup', (event) => {
    endPointer(event);
    handleTap(event);
  });
  img.addEventListener('pointercancel', endPointer);

  function handleTap(event) {
    const now = Date.now();
    const isDouble =
      lastTap &&
      now - lastTap.time < DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < DOUBLE_TAP_SLOP;

    if (isDouble) {
      lastTap = null;
      setScale(state.scale > 1 ? 1 : DOUBLE_TAP_SCALE, event.clientX, event.clientY);
    } else {
      lastTap = { time: now, x: event.clientX, y: event.clientY };
    }
  }

  // 桌機：Ctrl + 滾輪縮放
  img.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setScale(state.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15), event.clientX, event.clientY);
    },
    { passive: false },
  );

  // 轉螢幕或視窗改變時重新夾住平移量，避免圖片跑到畫面外
  window.addEventListener('resize', () => {
    if (state.scale > 1) apply();
  });
}

function distance(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
