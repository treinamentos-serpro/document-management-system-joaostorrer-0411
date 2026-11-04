const crypto = require('node:crypto');
const path = require('node:path');
const config = require('../config/documentConfig');
const AppError = require('../errors/appError');
const documentsRepository = require('../repositories/documents.repository');
const localFileRepository = require('../repositories/localFileRepository');

async function createDocument(file, owner) {
  if (!file) {
    throw new AppError('FILE_REQUIRED', 'Envie um arquivo no campo "file".');
  }
  if (file.size === 0) {
    await discardUploadedFile(file.path);
    throw new AppError('FILE_REQUIRED', 'O arquivo enviado não pode estar vazio.');
  }

  const originalName = path.win32.basename(path.basename(file.originalname))
    .replace(/[\u0000-\u001f\u007f]/g, '_')
    .slice(0, 255) || 'document';
  const document = {
    id: crypto.randomUUID(),
    originalName,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
    storedName: file.filename,
    storagePath: file.path,
  };

  try {
    const storageUsage = await localFileRepository.getUsage();
    if (storageUsage.fileCount > config.maxDocumentsTotal
      || storageUsage.totalBytes > config.maxStorageBytesTotal) {
      throw new AppError('STORAGE_QUOTA_EXCEEDED', 'O limite total de armazenamento foi atingido.');
    }
    documentsRepository.save(document);
  } catch (error) {
    await discardUploadedFile(file.path);
    throw error;
  }

  return document;
}

function listDocuments(owner, limit, offset) {
  return documentsRepository.findByOwner(owner, limit, offset);
}

async function discardUploadedFile(filePath) {
  try {
    await localFileRepository.remove(filePath);
  } catch (error) {
    console.error('Não foi possível remover um upload rejeitado:', error.message);
  }
}

async function getDocumentForDownload(id, owner) {
  const document = documentsRepository.findById(id);
  if (!document || document.owner !== owner) {
    throw new AppError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }

  await localFileRepository.assertAvailable(document.storagePath);

  return document;
}

module.exports = { createDocument, getDocumentForDownload, listDocuments };