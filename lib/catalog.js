export const SCHEMA_VERSION = 1;

export function createIndex() {
  return { version: SCHEMA_VERSION, catalogs: [] };
}

export function createCatalog({ id, title }) {
  return {
    version: SCHEMA_VERSION,
    id,
    title,
    active: true,
    bg: 'dark',
    // 檔名序號計數器。刪除圖片不會讓它倒退，避免新圖撞到舊圖的瀏覽器／CDN 快取。
    nextSeq: 1,
    images: [],
  };
}

export function imageFileName(seq, kind, ext) {
  const padded = String(seq).padStart(2, '0');
  return kind === 'orig' ? `${padded}.orig.${ext}` : `${padded}.${ext}`;
}

export function takeSeq(catalog, count) {
  const seqs = [];
  for (let i = 0; i < count; i += 1) seqs.push(catalog.nextSeq + i);
  return { catalog: { ...catalog, nextSeq: catalog.nextSeq + count }, seqs };
}

export function addImages(catalog, images) {
  return { ...catalog, images: [...catalog.images, ...images] };
}

export function removeImageAt(catalog, position) {
  assertIndex(position, catalog.images.length);
  const images = catalog.images.filter((_, i) => i !== position);
  return { ...catalog, images };
}

export function reorderImages(catalog, from, to) {
  assertIndex(from, catalog.images.length);
  assertIndex(to, catalog.images.length);
  const images = [...catalog.images];
  const [moved] = images.splice(from, 1);
  images.splice(to, 0, moved);
  return { ...catalog, images };
}

export function renameCatalog(catalog, title) {
  return { ...catalog, title };
}

export function setActive(catalog, active) {
  return { ...catalog, active };
}

export function setBackground(catalog, bg) {
  if (bg !== 'light' && bg !== 'dark') throw new Error(`不支援的背景顏色：${bg}`);
  return { ...catalog, bg };
}

/**
 * 由型錄物件推導出索引列並寫回 index。
 *
 * cover 與 imageCount 一律從 catalog.images 重算，不接受呼叫端傳入 ——
 * 這是「cover 恆等於 images[0].src」這條規則唯一的執行點。
 */
export function syncIndexEntry(index, catalog, now) {
  const position = index.catalogs.findIndex((c) => c.id === catalog.id);
  const existing = position >= 0 ? index.catalogs[position] : null;

  const entry = {
    id: catalog.id,
    title: catalog.title,
    active: catalog.active,
    imageCount: catalog.images.length,
    cover: catalog.images.length > 0 ? catalog.images[0].src : null,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };

  const catalogs = [...index.catalogs];
  if (position >= 0) {
    catalogs[position] = entry;
  } else {
    catalogs.unshift(entry);
  }
  return { ...index, catalogs };
}

export function removeFromIndex(index, id) {
  return { ...index, catalogs: index.catalogs.filter((c) => c.id !== id) };
}

/** 該型錄擁有的所有檔案路徑，用於整本刪除。 */
export function catalogFilePaths(catalog) {
  const paths = [`data/c/${catalog.id}.json`, `c/${catalog.id}/index.html`];
  for (const image of catalog.images) {
    paths.push(image.src, image.orig);
  }
  return paths;
}

function assertIndex(value, length) {
  if (!Number.isInteger(value) || value < 0 || value >= length) {
    throw new Error(`索引超出範圍：${value}（共 ${length} 張）`);
  }
}
