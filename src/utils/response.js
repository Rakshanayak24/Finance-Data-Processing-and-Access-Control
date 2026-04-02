/**
 * Standardized API Response Helpers
 * Ensures consistent response envelope across all endpoints.
 */

/**
 * Send a successful response.
 * @param {object} res - Express response object
 * @param {*} data - Payload to return
 * @param {string} message - Human-readable message
 * @param {number} statusCode - HTTP status code (default 200)
 * @param {object} meta - Optional pagination or extra metadata
 */
function sendSuccess(res, data = null, message = 'Success', statusCode = 200, meta = null) {
  const response = {
    success: true,
    message,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send an error response.
 * @param {object} res - Express response object
 * @param {string} message - Human-readable error message
 * @param {number} statusCode - HTTP status code (default 400)
 * @param {*} errors - Validation errors or detailed error info
 */
function sendError(res, message = 'An error occurred', statusCode = 400, errors = null) {
  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
}

/**
 * Build pagination metadata.
 */
function buildPaginationMeta(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  return {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Parse and validate pagination query params.
 */
function parsePagination(query, defaults = { page: 1, limit: 20, maxLimit: 100 }) {
  let page = parseInt(query.page, 10) || defaults.page;
  let limit = parseInt(query.limit, 10) || defaults.limit;

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > defaults.maxLimit) limit = defaults.maxLimit;

  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = { sendSuccess, sendError, buildPaginationMeta, parsePagination };
