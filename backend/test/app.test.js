const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const storageDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-api-test-'));
process.env.STORAGE_DIR = storageDirectory;
process.env.DMS_USER_TOKENS = JSON.stringify({
  alice: 'alice-token-for-integration-tests-0001',
  bob: 'bob-token-for-integration-tests-00002',
  charlie: 'charlie-token-for-integration-tests-0003',
});
process.env.MAX_FILE_SIZE_BYTES = '1024';
process.env.MAX_DOCUMENTS_PER_USER = '1';
process.env.MAX_DOCUMENTS_TOTAL = '10';
process.env.MAX_STORAGE_BYTES_PER_USER = '1024';
process.env.MAX_STORAGE_BYTES_TOTAL = '20';
process.env.MAX_UPLOADS_PER_MINUTE = '2';

const app = require('../src/app');
const localFileRepository = require('../src/repositories/localFileRepository');
let server;
let baseUrl;

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  fs.rmSync(storageDirectory, { recursive: true, force: true });
});

function headers(userId, token) {
  return {
    'X-User-Id': userId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function upload(userId, token, filename, content) {
  const form = new FormData();
  form.append('file', new Blob([content]), filename);
  return fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: headers(userId, token),
    body: form,
  });
}

test('protege documentos, aplica cotas e impede traversal via ID e nome', async (t) => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const unauthenticated = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'alice' },
  });
  assert.equal(unauthenticated.status, 401);

  const invalidToken = await fetch(`${baseUrl}/documents`, {
    headers: headers('alice', 'wrong-token'),
  });
  assert.equal(invalidToken.status, 401);

  const mismatchedIdentity = await fetch(`${baseUrl}/documents`, {
    headers: headers('bob', 'alice-token-for-integration-tests-0001'),
  });
  assert.equal(mismatchedIdentity.status, 401);

  await t.test('GET /documents retorna lista vazia e paginação padrão', async () => {
    const response = await fetch(`${baseUrl}/documents`, {
      headers: headers('alice', 'alice-token-for-integration-tests-0001'),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      documents: [],
      pagination: { limit: 50, offset: 0, total: 0 },
    });
  });

  let document;
  await t.test('POST /upload grava o arquivo localmente e retorna metadados públicos', async () => {
    const response = await upload(
      'alice',
      'alice-token-for-integration-tests-0001',
      '../../secret.txt',
      'conteudo protegido'
    );
    assert.equal(response.status, 201);
    ({ document } = await response.json());
    assert.deepEqual(Object.keys(document).sort(), [
      'id', 'originalName', 'owner', 'size', 'uploadedAt',
    ]);
    assert.match(document.id, /^[0-9a-f-]{36}$/i);
    assert.equal(document.originalName, 'secret.txt');
    assert.equal(document.owner, 'alice');
    assert.equal(document.size, Buffer.byteLength('conteudo protegido'));
    assert.equal(new Date(document.uploadedAt).toISOString(), document.uploadedAt);
    const storedFiles = fs.readdirSync(storageDirectory);
    assert.equal(storedFiles.length, 1);
    assert.equal(
      fs.readFileSync(path.join(storageDirectory, storedFiles[0]), 'utf8'),
      'conteudo protegido'
    );
  });

  await t.test('GET /documents lista metadados e respeita limit e offset', async () => {
    const response = await fetch(`${baseUrl}/documents?limit=1&offset=0`, {
      headers: headers('alice', 'alice-token-for-integration-tests-0001'),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      documents: [document],
      pagination: { limit: 1, offset: 0, total: 1 },
    });

    const nextPage = await fetch(`${baseUrl}/documents?limit=1&offset=1`, {
      headers: headers('alice', 'alice-token-for-integration-tests-0001'),
    });
    assert.equal(nextPage.status, 200);
    assert.deepEqual(await nextPage.json(), {
      documents: [],
      pagination: { limit: 1, offset: 1, total: 1 },
    });
  });

  await t.test('GET /documents rejeita paginação inválida', async () => {
    for (const query of ['limit=0', 'limit=101', 'limit=abc', 'offset=-1', 'offset=1.5']) {
      const response = await fetch(`${baseUrl}/documents?${query}`, {
        headers: headers('alice', 'alice-token-for-integration-tests-0001'),
      });
      assert.equal(response.status, 400, query);
      assert.equal((await response.json()).error.code, 'INVALID_REQUEST', query);
    }
  });

  await t.test('GET /documents/:id/download retorna conteúdo e nome do arquivo', async () => {
    const response = await fetch(`${baseUrl}/documents/${document.id}/download`, {
      headers: headers('alice', 'alice-token-for-integration-tests-0001'),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /attachment; filename="secret.txt"/);
    assert.equal(Number(response.headers.get('content-length')), document.size);
    assert.equal(await response.text(), 'conteudo protegido');
  });

  await t.test('GET /documents/:id/download rejeita IDs inválidos ou inexistentes', async () => {
    for (const [id, status, code] of [
      ['invalid-id', 400, 'INVALID_REQUEST'],
      [crypto.randomUUID(), 404, 'DOCUMENT_NOT_FOUND'],
    ]) {
      const response = await fetch(`${baseUrl}/documents/${id}/download`, {
        headers: headers('alice', 'alice-token-for-integration-tests-0001'),
      });
      assert.equal(response.status, status);
      assert.equal((await response.json()).error.code, code);
    }
  });

  const otherOwnerDownload = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: headers('bob', 'bob-token-for-integration-tests-00002'),
  });
  assert.equal(otherOwnerDownload.status, 404);

  const otherOwnerList = await fetch(`${baseUrl}/documents`, {
    headers: headers('bob', 'bob-token-for-integration-tests-00002'),
  });
  assert.deepEqual((await otherOwnerList.json()).documents, []);

  const traversalId = await fetch(`${baseUrl}/documents/..%2F..%2Fetc%2Fpasswd/download`, {
    headers: headers('alice', 'alice-token-for-integration-tests-0001'),
  });
  assert.equal(traversalId.status, 400);

  const userQuota = await upload(
    'alice',
    'alice-token-for-integration-tests-0001',
    'second.txt',
    'conteudo'
  );
  assert.equal(userQuota.status, 413);

  const totalQuota = await upload(
    'bob',
    'bob-token-for-integration-tests-00002',
    'bob.txt',
    'conteudo'
  );
  assert.equal(totalQuota.status, 413);
  assert.equal((await totalQuota.json()).error.code, 'STORAGE_QUOTA_EXCEEDED');

  const storedFilename = fs.readdirSync(storageDirectory).find((filename) => /^[0-9a-f-]{36}$/i.test(filename));
  fs.unlinkSync(path.join(storageDirectory, storedFilename));
  const missingStoredFile = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: headers('alice', 'alice-token-for-integration-tests-0001'),
  });
  assert.equal(missingStoredFile.status, 404);

  const missingFile = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: headers('charlie', 'charlie-token-for-integration-tests-0003'),
    body: new FormData(),
  });
  assert.equal(missingFile.status, 400);
  assert.equal((await missingFile.json()).error.code, 'FILE_REQUIRED');

  const secondMissingFile = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: headers('charlie', 'charlie-token-for-integration-tests-0003'),
    body: new FormData(),
  });
  assert.equal(secondMissingFile.status, 400);

  const rateLimited = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: headers('charlie', 'charlie-token-for-integration-tests-0003'),
    body: new FormData(),
  });
  assert.equal(rateLimited.status, 429);

  const oversized = await upload(
    'bob',
    'bob-token-for-integration-tests-00002',
    'large.txt',
    'x'.repeat(1025)
  );
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).error.code, 'FILE_TOO_LARGE');

  const orphanedFile = path.join(storageDirectory, crypto.randomUUID());
  fs.writeFileSync(orphanedFile, 'orphan');
  const expiredAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  fs.utimesSync(orphanedFile, expiredAt, expiredAt);
  assert.equal(await localFileRepository.cleanupOrphanedFiles(30), 1);
  assert.equal(fs.existsSync(orphanedFile), false);
});

test('exige tokens fora do modo development e preserva o modo local explícito', () => {
  const appPath = path.join(__dirname, '..');
  const production = spawnSync(process.execPath, ['-e', "require('./src/app')"], {
    cwd: appPath,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production', DMS_USER_TOKENS: '' },
  });
  assert.notEqual(production.status, 0);
  assert.match(production.stderr, /DMS_USER_TOKENS/);

  const development = spawnSync(process.execPath, ['-e', "require('./src/app')"], {
    cwd: appPath,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'development', DMS_USER_TOKENS: '' },
  });
  assert.equal(development.status, 0, development.stderr);
});
