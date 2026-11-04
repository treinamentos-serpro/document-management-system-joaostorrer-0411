const multer = require('multer');
const documentsService = require('../services/documents.service');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireOwner(req, res, next) {
  const owner = req.get('X-User-Id')?.trim();
  if (!owner || owner.length > 100) {
    return next(createError(400, 'INVALID_REQUEST', 'Informe um X-User-Id válido.'));
  }
  req.owner = owner;
  return next();
}

async function upload(req, res, next) {
  try {
    const document = await documentsService.createDocument(req.file, req.owner);
    return res.status(201).json({ document });
  } catch (error) {
    return next(error);
  }
}

function list(req, res, next) {
  try {
    const owner = getOwner(req);
    const limit = parseInteger(req.query.limit, 50, 1, 100, 'limit');
    const offset = parseInteger(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER, 'offset');
    const result = documentsService.listDocuments(owner, limit, offset);

    return res.json({
      documents: result.documents,
      pagination: { limit, offset, total: result.total },
    });
  } catch (error) {
    return next(error);
  }
}

async function download(req, res, next) {
  try {
    const owner = getOwner(req);
    if (!UUID_PATTERN.test(req.params.id)) {
      throw createError(400, 'INVALID_REQUEST', 'O identificador do documento é inválido.');
    }

    const document = await documentsService.getDocumentForDownload(req.params.id, owner);
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

  if (error.status && error.code) {
    return res.status(error.status).json({
      error: { code: error.code, message: error.message },
    });
  }

  console.error('Erro ao processar documento:', error.message);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Não foi possível processar a requisição.' },
  });
}

function getOwner(req) {
  const owner = req.get('X-User-Id')?.trim();
  if (!owner || owner.length > 100) {
    throw createError(400, 'INVALID_REQUEST', 'Informe um X-User-Id válido.');
  }
  return owner;
}

function parseInteger(value, defaultValue, minimum, maximum, field) {
  if (value === undefined) {
    return defaultValue;
  }
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw createError(400, 'INVALID_REQUEST', `O parâmetro ${field} deve ser um inteiro válido.`);
  }

  const parsedValue = Number(value);
  if (!Number.isSafeInteger(parsedValue) || parsedValue < minimum || parsedValue > maximum) {
    throw createError(400, 'INVALID_REQUEST', `O parâmetro ${field} está fora do intervalo permitido.`);
  }
  return parsedValue;
}

function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

module.exports = { download, handleError, list, requireOwner, upload };