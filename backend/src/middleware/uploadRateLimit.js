const { maxUploadsPerMinute } = require('../config/documentConfig');

const WINDOW_MS = 60 * 1000;
const MAX_TRACKED_USERS = 10000;
const requestsByUser = new Map();

function uploadRateLimit(req, res, next) {
  const now = Date.now();
  let entry = requestsByUser.get(req.user.id);

  if (!entry || now - entry.windowStartedAt >= WINDOW_MS) {
    entry = { count: 0, windowStartedAt: now };
    requestsByUser.set(req.user.id, entry);
  }

  if (entry.count >= maxUploadsPerMinute) {
    return res.status(429).json({
      error: { code: 'UPLOAD_RATE_LIMITED', message: 'Limite de uploads atingido. Tente novamente em instantes.' },
    });
  }

  entry.count += 1;
  if (requestsByUser.size > MAX_TRACKED_USERS) {
    for (const [userId, trackedEntry] of requestsByUser) {
      if (now - trackedEntry.windowStartedAt >= WINDOW_MS) {
        requestsByUser.delete(userId);
      }
    }
    if (requestsByUser.size > MAX_TRACKED_USERS) {
      requestsByUser.delete(requestsByUser.keys().next().value);
    }
  }

  return next();
}

module.exports = uploadRateLimit;