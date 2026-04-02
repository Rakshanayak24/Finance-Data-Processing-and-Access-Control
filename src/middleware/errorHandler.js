/**
 * Global Error Handler Middleware
 */

const logger = require('../utils/logger');
const { sendError } = require('../utils/response');

/**
 * Catch-all error handler. Must have 4 params for Express to treat as error handler.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // SQLite unique constraint violation
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return sendError(res, 'A resource with that value already exists.', 409);
  }

  // SQLite foreign key violation
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return sendError(res, 'Referenced resource does not exist.', 422);
  }

  // JSON parse errors from express.json()
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 'Invalid JSON in request body.', 400);
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode < 500 ? err.message : 'Internal server error.';

  return sendError(res, message, statusCode);
}

/**
 * 404 handler — mounted after all routes.
 */
function notFoundHandler(req, res) {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

module.exports = { errorHandler, notFoundHandler };
