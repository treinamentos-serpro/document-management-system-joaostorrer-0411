const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const documentsRepository = require('../repositories/documents.repository');

async function createDocument(file, owner) {
  if (!file) {
    throw createError(400, 'FILE_REQUIRED', 'Envie um arquivo no campo "file".');
  }
  if (file.size === 0) {
    await documentsRepository.removeFile(file.path);
    throw createError(400, 'FILE_REQUIRED', 'O arquivo enviado não pode estar vazio.');
  }

  const originalName = path.win32.basename(path.basename(file.originalname)).slice(0, 255) || 'document';
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
    documentsRepository.save(document);
  } catch (error) {
    await documentsRepository.removeFile(file.path);
    throw error;
  }

  return toPublicDocument(document);
}

function listDocuments(owner, limit, offset) {
  const result = documentsRepository.findByOwner(owner, limit, offset);
  return {
    documents: result.documents.map(toPublicDocument),
    total: result.total,
  };
}

async function getDocumentForDownload(id, owner) {
  const document = documentsRepository.findById(id);
  if (!document || document.owner !== owner) {
    throw createError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }

  try {
    await fs.access(document.storagePath);
  } catch {
    throw createError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }

  return document;
}

function toPublicDocument(document) {
  return {
    id: document.id,
    originalName: document.originalName,
    size: document.size,
    uploadedAt: document.uploadedAt,
    owner: document.owner,
  };
}

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

module.exports = { createDocument, getDocumentForDownload, listDocuments };