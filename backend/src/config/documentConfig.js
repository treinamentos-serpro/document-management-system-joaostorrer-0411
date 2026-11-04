const crypto = require('node:crypto');
const path = require('node:path');

function readPositiveInteger(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }
  return value;
}

function readUserTokens() {
  if (!process.env.DMS_USER_TOKENS) {
    return new Map();
  }

  let tokenEntries;
  try {
    tokenEntries = JSON.parse(process.env.DMS_USER_TOKENS);
  } catch {
    throw new Error('DMS_USER_TOKENS deve conter um objeto JSON válido.');
  }

  if (!tokenEntries || Array.isArray(tokenEntries) || typeof tokenEntries !== 'object') {
    throw new Error('DMS_USER_TOKENS deve mapear identificadores para tokens.');
  }

  const userTokens = new Map(Object.entries(tokenEntries));
  for (const [userId, token] of userTokens) {
    if (!userId.trim() || userId.length > 100 || typeof token !== 'string' || Buffer.byteLength(token) < 32) {
      throw new Error('Cada usuário deve ter um token secreto com pelo menos 32 bytes.');
    }
  }
  return userTokens;
}

const userTokens = readUserTokens();

if (process.env.NODE_ENV !== 'development' && userTokens.size === 0) {
  throw new Error('Configure DMS_USER_TOKENS ou inicie explicitamente em modo development.');
}

function tokenMatches(expectedToken, providedToken) {
  if (!expectedToken || !providedToken) {
    return false;
  }
  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

module.exports = Object.freeze({
  maxFileSizeBytes: readPositiveInteger('MAX_FILE_SIZE_BYTES', 10 * 1024 * 1024),
  maxDocumentsPerUser: readPositiveInteger('MAX_DOCUMENTS_PER_USER', 200),
  maxDocumentsTotal: readPositiveInteger('MAX_DOCUMENTS_TOTAL', 10000),
  maxStorageBytesPerUser: readPositiveInteger('MAX_STORAGE_BYTES_PER_USER', 1024 * 1024 * 1024),
  maxStorageBytesTotal: readPositiveInteger('MAX_STORAGE_BYTES_TOTAL', 10 * 1024 * 1024 * 1024),
  maxUploadsPerMinute: readPositiveInteger('MAX_UPLOADS_PER_MINUTE', 30),
  orphanRetentionDays: readPositiveInteger('ORPHAN_RETENTION_DAYS', 30),
  storageDirectory: path.resolve(
    process.env.STORAGE_DIR || path.join(__dirname, '../../storage')
  ),
  tokenMatches,
  userTokens,
});