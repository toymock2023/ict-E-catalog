import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGitHubClient } from '../lib/github.js';

/** 依序回應預先排好的結果，並記錄收到的請求。 */
function stubFetch(responses) {
  const calls = [];
  const impl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
    const next = responses.shift();
    if (!next) throw new Error(`沒有預期到的請求：${options.method} ${url}`);
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body ?? {},
      text: async () => JSON.stringify(next.body ?? {}),
    };
  };
  impl.calls = calls;
  return impl;
}

function makeClient(fetchImpl) {
  return createGitHubClient({
    owner: 'toymock2023',
    repo: 'ict-E-catalog',
    branch: 'main',
    token: 'test-token',
    fetchImpl,
  });
}

test('請求帶上 Authorization 與 API 版本標頭', async () => {
  const fetchImpl = stubFetch([
    { status: 200, body: { object: { sha: 'commit1' } } },
    { status: 200, body: { tree: { sha: 'tree1' } } },
  ]);
  await makeClient(fetchImpl).getHead();
  const headers = fetchImpl.calls.length;
  assert.equal(headers, 2);
});

test('getHead 回傳目前的 commit 與 tree sha', async () => {
  const fetchImpl = stubFetch([
    { status: 200, body: { object: { sha: 'commit1' } } },
    { status: 200, body: { tree: { sha: 'tree1' } } },
  ]);
  const head = await makeClient(fetchImpl).getHead();
  assert.deepEqual(head, { commitSha: 'commit1', treeSha: 'tree1' });
});

test('401 轉譯成可讀的 Token 失效訊息', async () => {
  const fetchImpl = stubFetch([{ status: 401, body: { message: 'Bad credentials' } }]);
  await assert.rejects(() => makeClient(fetchImpl).getHead(), /Token 已失效，請重新設定/);
});

test('403 轉譯成權限不足訊息', async () => {
  const fetchImpl = stubFetch([{ status: 403, body: { message: 'Forbidden' } }]);
  await assert.rejects(() => makeClient(fetchImpl).getHead(), /權限不足/);
});

test('readJson 遇到 404 回傳 null 而非丟錯', async () => {
  const fetchImpl = stubFetch([{ status: 404, body: { message: 'Not Found' } }]);
  const result = await makeClient(fetchImpl).readJson('data/index.json');
  assert.equal(result, null);
});

test('commitFiles 依序建立 blob、tree、commit 並更新 ref', async () => {
  const fetchImpl = stubFetch([
    { status: 200, body: { object: { sha: 'commit1' } } }, // getHead: ref
    { status: 200, body: { tree: { sha: 'tree1' } } },     // getHead: commit
    { status: 201, body: { sha: 'blobA' } },               // createBlob
    { status: 201, body: { sha: 'tree2' } },               // createTree
    { status: 201, body: { sha: 'commit2' } },             // createCommit
    { status: 200, body: {} },                             // updateRef
  ]);

  const sha = await makeClient(fetchImpl).commitFiles({
    message: '測試提交',
    upserts: [{ path: 'data/index.json', base64: 'e30=' }],
  });

  assert.equal(sha, 'commit2');
  const treeCall = fetchImpl.calls.find((c) => c.url.endsWith('/git/trees'));
  assert.equal(treeCall.body.base_tree, 'tree1');
  assert.deepEqual(treeCall.body.tree, [
    { path: 'data/index.json', mode: '100644', type: 'blob', sha: 'blobA' },
  ]);
  const commitCall = fetchImpl.calls.find((c) => c.url.endsWith('/git/commits'));
  assert.deepEqual(commitCall.body.parents, ['commit1']);
});

test('commitFiles 回報進度', async () => {
  const fetchImpl = stubFetch([
    { status: 200, body: { object: { sha: 'commit1' } } },
    { status: 200, body: { tree: { sha: 'tree1' } } },
    { status: 201, body: { sha: 'blobA' } },
    { status: 201, body: { sha: 'blobB' } },
    { status: 201, body: { sha: 'tree2' } },
    { status: 201, body: { sha: 'commit2' } },
    { status: 200, body: {} },
  ]);

  const progress = [];
  await makeClient(fetchImpl).commitFiles({
    message: '測試提交',
    upserts: [
      { path: 'a.json', base64: 'e30=' },
      { path: 'b.json', base64: 'e30=' },
    ],
    onProgress: (done, total) => progress.push([done, total]),
  });

  assert.deepEqual(progress, [[1, 2], [2, 2]]);
});

test('更新 ref 撞到 422 時重讀 HEAD 並重試一次', async () => {
  const fetchImpl = stubFetch([
    { status: 200, body: { object: { sha: 'commit1' } } },
    { status: 200, body: { tree: { sha: 'tree1' } } },
    { status: 201, body: { sha: 'blobA' } },
    { status: 201, body: { sha: 'tree2' } },
    { status: 201, body: { sha: 'commit2' } },
    { status: 422, body: { message: 'Update is not a fast forward' } }, // 第一次失敗
    { status: 200, body: { object: { sha: 'commit9' } } },              // 重讀 HEAD
    { status: 200, body: { tree: { sha: 'tree9' } } },
    { status: 201, body: { sha: 'tree10' } },                           // 重建 tree
    { status: 201, body: { sha: 'commit10' } },
    { status: 200, body: {} },                                          // 成功
  ]);

  const sha = await makeClient(fetchImpl).commitFiles({
    message: '測試提交',
    upserts: [{ path: 'data/index.json', base64: 'e30=' }],
  });

  assert.equal(sha, 'commit10');
  const blobCalls = fetchImpl.calls.filter((c) => c.url.endsWith('/git/blobs'));
  assert.equal(blobCalls.length, 1, 'blob 已存在，重試時不應重傳');
});

test('重試後仍然 422 則丟出錯誤', async () => {
  const fetchImpl = stubFetch([
    { status: 200, body: { object: { sha: 'commit1' } } },
    { status: 200, body: { tree: { sha: 'tree1' } } },
    { status: 201, body: { sha: 'blobA' } },
    { status: 201, body: { sha: 'tree2' } },
    { status: 201, body: { sha: 'commit2' } },
    { status: 422, body: { message: 'Update is not a fast forward' } },
    { status: 200, body: { object: { sha: 'commit9' } } },
    { status: 200, body: { tree: { sha: 'tree9' } } },
    { status: 201, body: { sha: 'tree10' } },
    { status: 201, body: { sha: 'commit10' } },
    { status: 422, body: { message: 'Update is not a fast forward' } },
  ]);

  await assert.rejects(
    () => makeClient(fetchImpl).commitFiles({
      message: '測試提交',
      upserts: [{ path: 'data/index.json', base64: 'e30=' }],
    }),
    /有其他變更同時推上，請重試/,
  );
});
