import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createIndex,
  createCatalog,
  takeSeq,
  addImages,
  removeImageAt,
  reorderImages,
  renameCatalog,
  setActive,
  syncIndexEntry,
  removeFromIndex,
  catalogFilePaths,
  imageFileName,
} from '../lib/catalog.js';

const NOW = '2026-08-03T10:22:31Z';
const LATER = '2026-08-04T09:00:00Z';

function catalogWithImages(count) {
  let cat = createCatalog({ id: 'a7f3k2', title: '2026 秋冬新品' });
  const { catalog: taken, seqs } = takeSeq(cat, count);
  const images = seqs.map((seq) => ({
    src: `img/a7f3k2/${imageFileName(seq, 'display', 'jpg')}`,
    orig: `img/a7f3k2/${imageFileName(seq, 'orig', 'jpg')}`,
    w: 1040,
    h: 1387,
  }));
  return addImages(taken, images);
}

test('imageFileName 補零到兩位並區分顯示版與原圖', () => {
  assert.equal(imageFileName(1, 'display', 'jpg'), '01.jpg');
  assert.equal(imageFileName(1, 'orig', 'png'), '01.orig.png');
  assert.equal(imageFileName(12, 'display', 'jpg'), '12.jpg');
  assert.equal(imageFileName(103, 'display', 'jpg'), '103.jpg');
});

test('createCatalog 產生的型錄預設上架、無圖、序號從 1 起算', () => {
  const cat = createCatalog({ id: 'a7f3k2', title: '2026 秋冬新品' });
  assert.equal(cat.id, 'a7f3k2');
  assert.equal(cat.title, '2026 秋冬新品');
  assert.equal(cat.active, true);
  assert.equal(cat.nextSeq, 1);
  assert.deepEqual(cat.images, []);
});

test('takeSeq 取號後計數器前進，且不修改原物件', () => {
  const cat = createCatalog({ id: 'a7f3k2', title: 'x' });
  const { catalog, seqs } = takeSeq(cat, 3);
  assert.deepEqual(seqs, [1, 2, 3]);
  assert.equal(catalog.nextSeq, 4);
  assert.equal(cat.nextSeq, 1, '原物件不可被修改');
});

test('刪除圖片後再新增不會重用序號', () => {
  let cat = catalogWithImages(3); // 用掉 1,2,3；nextSeq = 4
  cat = removeImageAt(cat, 2); // 刪掉第 3 張
  assert.equal(cat.images.length, 2);
  assert.equal(cat.nextSeq, 4, '刪除不得讓序號倒退');
  const { seqs } = takeSeq(cat, 1);
  assert.deepEqual(seqs, [4], '新圖必須拿到全新序號，否則會撞到舊快取');
});

test('reorderImages 把圖片搬到指定位置', () => {
  const cat = catalogWithImages(4);
  const moved = reorderImages(cat, 0, 2);
  assert.deepEqual(
    moved.images.map((img) => img.src),
    ['img/a7f3k2/02.jpg', 'img/a7f3k2/03.jpg', 'img/a7f3k2/01.jpg', 'img/a7f3k2/04.jpg'],
  );
  assert.equal(cat.images[0].src, 'img/a7f3k2/01.jpg', '原物件不可被修改');
});

test('reorderImages 索引超出範圍時丟出錯誤', () => {
  const cat = catalogWithImages(2);
  assert.throws(() => reorderImages(cat, 0, 5), /索引超出範圍/);
  assert.throws(() => reorderImages(cat, -1, 1), /索引超出範圍/);
});

test('removeImageAt 索引超出範圍時丟出錯誤', () => {
  const cat = catalogWithImages(2);
  assert.throws(() => removeImageAt(cat, 9), /索引超出範圍/);
});

test('renameCatalog 與 setActive 只改對應欄位', () => {
  const cat = catalogWithImages(1);
  const renamed = renameCatalog(cat, '2027 春夏新品');
  assert.equal(renamed.title, '2027 春夏新品');
  assert.equal(renamed.images.length, 1);
  const off = setActive(renamed, false);
  assert.equal(off.active, false);
  assert.equal(off.title, '2027 春夏新品');
});

test('syncIndexEntry 新型錄插在最前面', () => {
  let index = createIndex();
  index = syncIndexEntry(index, createCatalog({ id: 'aaaaaa', title: '舊' }), NOW);
  index = syncIndexEntry(index, createCatalog({ id: 'bbbbbb', title: '新' }), LATER);
  assert.deepEqual(index.catalogs.map((c) => c.id), ['bbbbbb', 'aaaaaa']);
});

test('syncIndexEntry 由型錄推導 cover 與 imageCount', () => {
  const cat = catalogWithImages(3);
  const index = syncIndexEntry(createIndex(), cat, NOW);
  assert.equal(index.catalogs[0].imageCount, 3);
  assert.equal(index.catalogs[0].cover, 'img/a7f3k2/01.jpg');
});

test('調整順序後 cover 跟著第一張改變', () => {
  const cat = catalogWithImages(3);
  let index = syncIndexEntry(createIndex(), cat, NOW);
  const moved = reorderImages(cat, 2, 0); // 第 3 張移到最前
  index = syncIndexEntry(index, moved, LATER);
  assert.equal(index.catalogs[0].cover, 'img/a7f3k2/03.jpg');
});

test('syncIndexEntry 更新既有型錄時保留 createdAt、更新 updatedAt 且不改變位置', () => {
  let index = createIndex();
  index = syncIndexEntry(index, createCatalog({ id: 'aaaaaa', title: '第一本' }), NOW);
  index = syncIndexEntry(index, createCatalog({ id: 'bbbbbb', title: '第二本' }), NOW);
  const renamed = renameCatalog(createCatalog({ id: 'aaaaaa', title: '第一本' }), '改名後');
  index = syncIndexEntry(index, renamed, LATER);

  const entry = index.catalogs.find((c) => c.id === 'aaaaaa');
  assert.equal(entry.title, '改名後');
  assert.equal(entry.createdAt, NOW);
  assert.equal(entry.updatedAt, LATER);
  assert.deepEqual(index.catalogs.map((c) => c.id), ['bbbbbb', 'aaaaaa'], '更新不應改變排序');
});

test('沒有圖片的型錄 cover 為 null', () => {
  const index = syncIndexEntry(createIndex(), createCatalog({ id: 'a7f3k2', title: 'x' }), NOW);
  assert.equal(index.catalogs[0].cover, null);
  assert.equal(index.catalogs[0].imageCount, 0);
});

test('removeFromIndex 移除指定型錄，其餘不動', () => {
  let index = createIndex();
  index = syncIndexEntry(index, createCatalog({ id: 'aaaaaa', title: 'a' }), NOW);
  index = syncIndexEntry(index, createCatalog({ id: 'bbbbbb', title: 'b' }), NOW);
  const after = removeFromIndex(index, 'aaaaaa');
  assert.deepEqual(after.catalogs.map((c) => c.id), ['bbbbbb']);
  assert.equal(index.catalogs.length, 2, '原物件不可被修改');
});

test('catalogFilePaths 列出該型錄的所有檔案', () => {
  const cat = catalogWithImages(2);
  const paths = catalogFilePaths(cat);
  assert.deepEqual(paths.sort(), [
    'c/a7f3k2/index.html',
    'data/c/a7f3k2.json',
    'img/a7f3k2/01.jpg',
    'img/a7f3k2/01.orig.jpg',
    'img/a7f3k2/02.jpg',
    'img/a7f3k2/02.orig.jpg',
  ].sort());
});
