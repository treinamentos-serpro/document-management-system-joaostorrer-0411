const {
  maxDocumentsPerUser,
  maxDocumentsTotal,
  maxStorageBytesPerUser,
} = require('../config/documentConfig');
const AppError = require('../errors/appError');

const documents = new Map();

function save(document) {
  let userDocumentCount = 0;
  let userStorageBytes = 0;
  let totalStorageBytes = 0;

  for (const existingDocument of documents.values()) {
    totalStorageBytes += existingDocument.size;
    if (existingDocument.owner === document.owner) {
      userDocumentCount += 1;
      userStorageBytes += existingDocument.size;
    }
  }

  if (documents.size >= maxDocumentsTotal || userDocumentCount >= maxDocumentsPerUser) {
    throw createQuotaError('O limite de documentos foi atingido.');
  }
  if (userStorageBytes + document.size > maxStorageBytesPerUser) {
    throw createQuotaError('O limite de armazenamento deste usuário foi atingido.');
  }

  documents.set(document.id, document);
  return document;
}

function findById(id) {
  return documents.get(id) || null;
}

function findByOwner(owner, limit, offset) {
  const ownedDocuments = [...documents.values()]
    .filter((document) => document.owner === owner)
    .sort((first, second) => second.uploadedAt.localeCompare(first.uploadedAt));

  return {
    documents: ownedDocuments.slice(offset, offset + limit),
    total: ownedDocuments.length,
  };
}

function createQuotaError(message) {
  return new AppError('STORAGE_QUOTA_EXCEEDED', message);
}

module.exports = { findById, findByOwner, save };