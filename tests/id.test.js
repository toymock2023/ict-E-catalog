import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateId, isValidId, ID_ALPHABET, ID_LENGTH } from '../lib/id.js';

// 產生固定 bytes 的假亂數來源，讓測試可預測
function fixedBytes(...sequences) {
  let call = 0;
  return () => Uint8Array.from(sequences[Math.min(call++, sequences.length - 1)]);
}

test('字元集排除易混淆字元', () => {
  for (const ch of ['0', 'o', '1', 'l', 'i']) {
    assert.equal(ID_ALPHABET.includes(ch), false, `字元集不應包含 ${ch}`);
  }
});

test('generateId 產生符合長度與字元集的 id', () => {
  const id = generateId([]);
  assert.equal(id.length, ID_LENGTH);
  assert.equal(isValidId(id), true);
});

test('generateId 碰撞時重抽', () => {
  // 第一輪產生的 id 已存在，第二輪才過關
  const first = 'aaaaaa';
  const second = 'bbbbbb';
  const bytes = fixedBytes(
    [0, 0, 0, 0, 0, 0], // → aaaaaa（ALPHABET[0] === 'a'）
    [1, 1, 1, 1, 1, 1], // → bbbbbb
  );
  const id = generateId([first], bytes);
  assert.equal(id, second);
});

test('generateId 連續碰撞超過上限則丟出錯誤', () => {
  const bytes = () => Uint8Array.from([0, 0, 0, 0, 0, 0]); // 永遠是 aaaaaa
  assert.throws(() => generateId(['aaaaaa'], bytes), /無法產生不重複的型錄 id/);
});

test('isValidId 拒絕長度錯誤與非法字元', () => {
  assert.equal(isValidId('abc'), false);
  assert.equal(isValidId('abcdefg'), false);
  assert.equal(isValidId('abcde0'), false); // 0 不在字元集
  assert.equal(isValidId('ABCDEF'), false); // 大寫不在字元集
  assert.equal(isValidId(123456), false);
  assert.equal(isValidId(null), false);
});
