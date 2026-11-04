const multer = require('multer');
const AppError = require('../errors/appError');
const documentsPresenter = require('./documents.presenter');
const documentsService = require('../services/documents.service');

const DOCUMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ERROR_STATUS = {
  AUTHENTICATION_REQUIRED: 401,
  AUTHENTICATION_UNAVAILABLE: 503,
  DOCUMENT_NOT_FOUND: 404,
  FILE_REQUIRED: 400,
  INVALID_REQUEST: 400,
  STORAGE_QUOTA_EXCEEDED: 413,
};

async function upload(req, res, next) {
  try {
    const document = await documentsService.createDocument(req.file, req.user.id);
    return res.status(201).json({ document: documentsPresenter.toPublicDocument(document) });
  } catch (error) {
    return next(error);
  }
}

function list(req, res, next) {
  try {
    const limit = parseInteger(req.query.limit, 50, 1, 100, 'limit');
    const offset = parseInteger(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER, 'offset');
    const result = documentsService.listDocuments(req.user.id, limit, offset);

    return res.json({
      documents: result.documents.map(documentsPresenter.toPublicDocument),
      pagination: { limit, offset, total: result.total },
    });
  } catch (error) {
    return next(error);
  }
}

async function download(req, res, next) {
  try {
    if (!DOCUMENT_ID_PATTERN.test(req.params.id)) {
      throw new AppError('INVALID_REQUEST', 'O identificador do documento é inválido.');
    }

    const document = await documentsService.getDocumentForDownload(req.params.id, req.user.id);
    return res.download(document.storagePath, document.originalName, (error) => {
      if (!error) {
        return;
      }
      if (!res.headersSent && error.code === 'ENOENT') {
        return res.status(404).json({
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado.' },
        });
      }
      if (res.headersSent) {
        res.destroy(error);
      } else {
        next(error);
      }
    });
  } catch (error) {
    return next(error);
  }
}

function handleError(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: { code: 'FILE_TOO_LARGE', message: 'O arquivo excede o tamanho máximo permitido.' },
    });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'A requisição de upload é inválida.' },
    });
  }

  if (ERROR_STATUS[error.code]) {
    return res.status(ERROR_STATUS[error.code]).json({
      error: { code: error.code, message: error.message },
    });
  }

  console.error('Erro ao processar documento:', error.message);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Não foi possível processar a requisição.' },
  });
}

function parseInteger(value, defaultValue, minimum, maximum, field) {
  if (value === undefined) {
    return defaultValue;
  }
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new AppError('INVALID_REQUEST', `O parâmetro ${field} deve ser um inteiro válido.`);
  }

  const parsedValue = Number(value);
  if (!Number.isSafeInteger(parsedValue) || parsedValue < minimum || parsedValue > maximum) {
    throw new AppError('INVALID_REQUEST', `O parâmetro ${field} está fora do intervalo permitido.`);
  }
  return parsedValue;
}

module.exports = { download, handleError, list, upload };