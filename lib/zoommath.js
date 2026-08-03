export function clampScale(scale, min, max) {
  return Math.min(max, Math.max(min, scale));
}

/**
 * 夾住平移量，讓圖片不會被拖出視窗。
 * 假設 transform-origin 為 0 0，變換順序為 translate 後 scale。
 */
export function clampPan({ scale, tx, ty, viewW, viewH, contentW, contentH }) {
  return {
    tx: clampAxis(tx, viewW, contentW * scale),
    ty: clampAxis(ty, viewH, contentH * scale),
  };
}

function clampAxis(value, viewSize, scaledSize) {
  // 內容比視窗小 → 置中，不允許自由拖動
  if (scaledSize <= viewSize) return (viewSize - scaledSize) / 2;
  return Math.min(0, Math.max(viewSize - scaledSize, value));
}
