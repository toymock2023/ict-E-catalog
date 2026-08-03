import { buildTreeEntries } from './gittree.js';

/**
 * GitHub Git Data API 用戶端。
 *
 * 為什麼不用 Contents API：那支 API 一次只能寫一個檔案，一本 8 張圖的型錄
 * 要打 19 次，中途失敗會讓 repo 停在「有圖沒清單」的破損狀態。
 * Git Data API 把所有變更收斂成單一 commit，只有最後一步 PATCH ref 才生效。
 */
export function createGitHubClient({ owner, repo, branch = 'main', token, fetchImpl = fetch }) {
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  async function request(path, { method = 'GET', body } = {}) {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const detail = await safeMessage(res);
      throw Object.assign(new Error(translateError(res.status, detail)), { status: res.status });
    }
    return res.json();
  }

  async function getHead() {
    const ref = await request(`/git/ref/heads/${branch}`);
    const commit = await request(`/git/commits/${ref.object.sha}`);
    return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
  }

  async function createBlob(base64Content) {
    const blob = await request('/git/blobs', {
      method: 'POST',
      body: { content: base64Content, encoding: 'base64' },
    });
    return blob.sha;
  }

  /** 讀取 repo 中的 JSON 檔。檔案不存在時回傳 null。 */
  async function readJson(path) {
    try {
      const file = await request(`/contents/${path}?ref=${branch}`);
      const text = decodeBase64Utf8(file.content.replace(/\n/g, ''));
      return JSON.parse(text);
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async function commitOnce({ message, entries, head }) {
    const tree = await request('/git/trees', {
      method: 'POST',
      body: { base_tree: head.treeSha, tree: entries },
    });
    const commit = await request('/git/commits', {
      method: 'POST',
      body: { message, tree: tree.sha, parents: [head.commitSha] },
    });
    await request(`/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: { sha: commit.sha, force: false },
    });
    return commit.sha;
  }

  async function commitFiles({ message, upserts = [], deletes = [], onProgress }) {
    const head = await getHead();

    // blob 先傳完。這一步不改變 repo 狀態，中途失敗只會留下未被引用的 blob，
    // GitHub 會自行回收。
    const withSha = [];
    for (const [i, item] of upserts.entries()) {
      const sha = await createBlob(item.base64);
      withSha.push({ path: item.path, sha });
      if (onProgress) onProgress(i + 1, upserts.length);
    }

    const entries = buildTreeEntries({ upserts: withSha, deletes });

    try {
      return await commitOnce({ message, entries, head });
    } catch (err) {
      if (err.status !== 422) throw err;
      // HEAD 被別人推進了。重讀後以新的 base_tree 重組，blob 沿用不重傳。
      const freshHead = await getHead();
      try {
        return await commitOnce({ message, entries, head: freshHead });
      } catch (retryErr) {
        if (retryErr.status === 422) {
          throw new Error('有其他變更同時推上，請重試');
        }
        throw retryErr;
      }
    }
  }

  return { getHead, createBlob, readJson, commitFiles };
}

function translateError(status, detail) {
  if (status === 401) return 'Token 已失效，請重新設定';
  if (status === 403) return '權限不足，請確認 Token 已勾選 Contents: Read and write';
  if (status === 404) return `找不到資源（404）：${detail}`;
  if (status === 422) return `GitHub 拒絕這次變更（422）：${detail}`;
  return `GitHub 回應錯誤（${status}）：${detail}`;
}

async function safeMessage(res) {
  try {
    const body = await res.json();
    return body.message || '未提供詳細訊息';
  } catch {
    return '未提供詳細訊息';
  }
}

function decodeBase64Utf8(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
