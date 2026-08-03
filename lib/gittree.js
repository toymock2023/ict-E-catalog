export const FILE_MODE = '100644';

/**
 * 組出 GitHub Git Data API 的 tree entry 陣列。
 * 刪除檔案的方式是把該路徑的 sha 設為 null。
 */
export function buildTreeEntries({ upserts = [], deletes = [] } = {}) {
  if (upserts.length === 0 && deletes.length === 0) {
    throw new Error('沒有任何變更，不需要提交');
  }

  const seen = new Set();
  const entries = [];

  for (const item of upserts) {
    assertPath(item.path);
    if (!item.sha) throw new Error(`缺少 blob sha：${item.path}`);
    claim(seen, item.path);
    entries.push({ path: item.path, mode: FILE_MODE, type: 'blob', sha: item.sha });
  }

  for (const path of deletes) {
    assertPath(path);
    claim(seen, path);
    entries.push({ path, mode: FILE_MODE, type: 'blob', sha: null });
  }

  return entries;
}

function claim(seen, path) {
  if (seen.has(path)) throw new Error(`路徑重複：${path}`);
  seen.add(path);
}

function assertPath(path) {
  if (typeof path !== 'string' || path.length === 0 || path.startsWith('/')) {
    throw new Error(`路徑不合法：${path}`);
  }
}
