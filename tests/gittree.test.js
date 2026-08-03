import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTreeEntries, FILE_MODE } from '../lib/gittree.js';

test('新增檔案帶入 blob sha', () => {
  const entries = buildTreeEntries({ upserts: [{ path: 'data/index.json', sha: 'abc123' }] });
  assert.deepEqual(entries, [
    { path: 'data/index.json', mode: FILE_MODE, type: 'blob', sha: 'abc123' },
  ]);
});

test('刪除檔案的 sha 為 null', () => {
  const entries = buildTreeEntries({ deletes: ['img/a7f3k2/01.jpg'] });
  assert.deepEqual(entries, [
    { path: 'img/a7f3k2/01.jpg', mode: FILE_MODE, type: 'blob', sha: null },
  ]);
});

test('新增與刪除可混在同一次提交', () => {
  const entries = buildTreeEntries({
    upserts: [{ path: 'data/index.json', sha: 'abc123' }],
    deletes: ['img/a7f3k2/01.jpg'],
  });
  assert.equal(entries.length, 2);
});

test('同一路徑重複出現時丟出錯誤', () => {
  assert.throws(
    () => buildTreeEntries({
      upserts: [
        { path: 'data/index.json', sha: 'a' },
        { path: 'data/index.json', sha: 'b' },
      ],
    }),
    /路徑重複/,
  );
});

test('同一路徑同時被新增與刪除時丟出錯誤', () => {
  assert.throws(
    () => buildTreeEntries({
      upserts: [{ path: 'data/index.json', sha: 'a' }],
      deletes: ['data/index.json'],
    }),
    /路徑重複/,
  );
});

test('沒有任何變更時丟出錯誤', () => {
  assert.throws(() => buildTreeEntries({}), /沒有任何變更/);
  assert.throws(() => buildTreeEntries({ upserts: [], deletes: [] }), /沒有任何變更/);
});

test('缺少 sha 的新增項目丟出錯誤', () => {
  assert.throws(
    () => buildTreeEntries({ upserts: [{ path: 'data/index.json' }] }),
    /缺少 blob sha/,
  );
});

test('路徑不得以斜線開頭', () => {
  assert.throws(
    () => buildTreeEntries({ upserts: [{ path: '/data/index.json', sha: 'a' }] }),
    /路徑不合法/,
  );
});
