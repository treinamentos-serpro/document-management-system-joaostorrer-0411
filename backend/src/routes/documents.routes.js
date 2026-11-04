const express = require('express');
const documentsController = require('../controllers/documents.controller');
const authenticateUser = require('../middleware/authenticateUser');
const uploadRateLimit = require('../middleware/uploadRateLimit');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(authenticateUser);

router.post(
  '/upload',
  uploadRateLimit,
  upload.single('file'),
  documentsController.upload
);
router.get('/documents', documentsController.list);
router.get('/documents/:id/download', documentsController.download);
router.use(documentsController.handleError);

module.exports = router;