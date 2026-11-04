const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const multer = require('multer');
const { maxFileSizeBytes, storageDirectory } = require('../config/documentConfig');

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    fs.mkdir(storageDirectory, { recursive: true })
      .then(() => callback(null, storageDirectory))
      .catch(callback);
  },
  filename: (req, file, callback) => callback(null, crypto.randomUUID()),
});

module.exports = multer({
  storage,
  limits: { fileSize: maxFileSizeBytes, files: 1, fields: 0 },
});