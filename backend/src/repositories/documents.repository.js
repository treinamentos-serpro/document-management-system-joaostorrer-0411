const fs = require('node:fs/promises');

const documents = new Map();

function save(document) {
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

async function removeFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = { findById, findByOwner, removeFile, save };