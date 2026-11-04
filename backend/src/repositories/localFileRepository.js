const fs = require('node:fs/promises');
const path = require('node:path');
const { storageDirectory } = require('../config/documentConfig');
const AppError = require('../errors/appError');

const UUID_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function remove(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function assertAvailable(filePath) {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new AppError('INVALID_STORAGE_ENTRY', 'O arquivo armazenado não é regular.');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new AppError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    }
    throw error;
  }
}

async function getUsage() {
  let fileCount = 0;
  let totalBytes = 0;
  let entries;

  try {
    entries = await fs.readdir(storageDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { fileCount, totalBytes };
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !UUID_FILENAME.test(entry.name)) {
      continue;
    }
    const stats = await fs.stat(path.join(storageDirectory, entry.name));
    fileCount += 1;
    totalBytes += stats.size;
  }

  return { fileCount, totalBytes };
}

async function cleanupOrphanedFiles(retentionDays) {
  let entries;
  try {
    entries = await fs.readdir(storageDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return 0;
    }
    throw error;
  }

  const expirationTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removedCount = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !UUID_FILENAME.test(entry.name)) {
      continue;
    }

    const filePath = path.join(storageDirectory, entry.name);
    const stats = await fs.stat(filePath);
    if (stats.mtimeMs < expirationTime) {
      await fs.unlink(filePath);
      removedCount += 1;
    }
  }

  return removedCount;
}

module.exports = { assertAvailable, cleanupOrphanedFiles, getUsage, remove, storageDirectory };