const { tokenMatches, userTokens } = require('../config/documentConfig');
const AppError = require('../errors/appError');

function authenticateUser(req, res, next) {
  const userId = req.get('X-User-Id')?.trim();
  if (!userId || userId.length > 100) {
    return next(new AppError('AUTHENTICATION_REQUIRED', 'Autenticação necessária.'));
  }

  if (userTokens.size > 0) {
    const authorization = req.get('Authorization') || '';
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    const expectedToken = userTokens.get(userId);
    if (!match || !tokenMatches(expectedToken, match[1])) {
      return next(new AppError('AUTHENTICATION_REQUIRED', 'Autenticação necessária.'));
    }
  } else if (process.env.NODE_ENV !== 'development') {
    return next(new AppError('AUTHENTICATION_UNAVAILABLE', 'A autenticação não está configurada.'));
  }

  req.user = Object.freeze({ id: userId });
  return next();
}

module.exports = authenticateUser;