import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcTargetSize } from '../lib/resize.js';

test('長邊已小於上限時不放大', () => {
  // 需求方目前的原圖尺寸，長邊 1387 < 1400
  assert.deepEqual(calcTargetSize(1040, 1387, 1400), { width: 1040, height: 1387 });
});

test('直式圖片依長邊等比縮小', () => {
  assert.deepEqual(calcTargetSize(1500, 3000, 1400), { width: 700, height: 1400 });
});

test('橫式圖片依長邊等比縮小', () => {
  assert.deepEqual(calcTargetSize(3000, 1500, 1400), { width: 1400, height: 700 });
});

test('正方形圖片縮到上限', () => {
  assert.deepEqual(calcTargetSize(3000, 3000, 1400), { width: 1400, height: 1400 });
});

test('長邊等於上限時維持原尺寸', () => {
  assert.deepEqual(calcTargetSize(1400, 700, 1400), { width: 1400, height: 700 });
});

test('極端比例不會產生 0 邊長', () => {
  const size = calcTargetSize(10000, 3, 1400);
  assert.equal(size.width, 1400);
  assert.ok(size.height >= 1, '高度至少為 1px');
});

test('尺寸不合法時丟出錯誤', () => {
  assert.throws(() => calcTargetSize(0, 100, 1400), /圖片尺寸不合法/);
  assert.throws(() => calcTargetSize(-5, 100, 1400), /圖片尺寸不合法/);
  assert.throws(() => calcTargetSize(NaN, 100, 1400), /圖片尺寸不合法/);
});
