import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampScale, clampPan } from '../lib/zoommath.js';

test('clampScale 夾在上下限之間', () => {
  assert.equal(clampScale(0.3, 1, 4), 1);
  assert.equal(clampScale(2.5, 1, 4), 2.5);
  assert.equal(clampScale(9, 1, 4), 4);
});

test('內容小於視窗時自動置中', () => {
  const pan = clampPan({ scale: 1, tx: -50, ty: -50, viewW: 400, viewH: 800, contentW: 300, contentH: 600 });
  assert.deepEqual(pan, { tx: 50, ty: 100 });
});

test('內容大於視窗時平移被夾在邊界內', () => {
  // 放大兩倍後內容 800x1200，視窗 400x800 → tx 允許範圍 [-400, 0]
  const inside = clampPan({ scale: 2, tx: -100, ty: -100, viewW: 400, viewH: 800, contentW: 400, contentH: 600 });
  assert.deepEqual(inside, { tx: -100, ty: -100 });
});

test('平移超出左上角時被拉回 0', () => {
  const pan = clampPan({ scale: 2, tx: 80, ty: 80, viewW: 400, viewH: 800, contentW: 400, contentH: 600 });
  assert.deepEqual(pan, { tx: 0, ty: 0 });
});

test('平移超出右下角時被拉回最小值', () => {
  // 內容 800x1200，視窗 400x800 → 最小 tx = -400、最小 ty = -400
  const pan = clampPan({ scale: 2, tx: -900, ty: -900, viewW: 400, viewH: 800, contentW: 400, contentH: 600 });
  assert.deepEqual(pan, { tx: -400, ty: -400 });
});

test('單一軸小於視窗時該軸置中、另一軸照常夾住', () => {
  // 內容 200x1600，視窗 400x800 → x 軸置中、y 軸可平移
  const pan = clampPan({ scale: 2, tx: -50, ty: -300, viewW: 400, viewH: 800, contentW: 100, contentH: 800 });
  assert.equal(pan.tx, 100, 'x 軸應置中');
  assert.equal(pan.ty, -300, 'y 軸應維持');
});
