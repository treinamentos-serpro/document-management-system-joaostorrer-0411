const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const documentsController = require('../controllers/documents.controller');

const router = express.Router();
const storageDirectory = path.resolve(
  process.env.STORAGE_DIR || path.join(__dirname, '../../storage')
);
const configuredFileSize = Number.parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760', 10);
const maxFileSize = Number.isSafeInteger(configuredFileSize) && configuredFileSize > 0
  ? configuredFileSize
  : 10485760;

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    fs.mkdir(storageDirectory, { recursive: true })
      .then(() => callback(null, storageDirectory))
      .catch(callback);
  },
  filename: (req, file, callback) => callback(null, crypto.randomUUID()),
});

const upload = multer({
  storage,
  limits: { fileSize: maxFileSize, files: 1, fields: 0 },
});

router.post(
  '/upload',
  documentsController.requireOwner,
  upload.single('file'),
  documentsController.upload
);
router.get('/documents', documentsController.list);
router.get('/documents/:id/download', documentsController.download);
router.use(documentsController.handleError);

module.exports = router;