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

test('protege documentos, aplica cotas e impede traversal via ID e nome', async () => {
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

  const initialList = await fetch(`${baseUrl}/documents`, {
    headers: headers('alice', 'alice-token-for-integration-tests-0001'),
  });
  assert.equal(initialList.status, 200);
  assert.deepEqual((await initialList.json()).documents, []);

  const uploaded = await upload(
    'alice',
    'alice-token-for-integration-tests-0001',
    '../../secret.txt',
    'conteudo protegido'
  );
  assert.equal(uploaded.status, 201);
  const { document } = await uploaded.json();
  assert.equal(document.originalName, 'secret.txt');
  assert.equal(document.owner, 'alice');
  assert.equal(Object.hasOwn(document, 'storagePath'), false);

  const aliceList = await fetch(`${baseUrl}/documents?limit=1&offset=0`, {
    headers: headers('alice', 'alice-token-for-integration-tests-0001'),
  });
  const listBody = await aliceList.json();
  assert.equal(listBody.pagination.total, 1);
  assert.equal(listBody.documents[0].id, document.id);

  const download = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: headers('alice', 'alice-token-for-integration-tests-0001'),
  });
  assert.equal(download.status, 200);
  assert.match(download.headers.get('content-disposition'), /attachment/);
  assert.equal(await download.text(), 'conteudo protegido');

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
