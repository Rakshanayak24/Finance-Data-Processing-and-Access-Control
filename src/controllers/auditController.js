/**
 * Audit Log Controller
 */

const { getAuditLogs } = require('../services/auditService');
const { sendSuccess, buildPaginationMeta, parsePagination } = require('../utils/response');

function getAuditLogsHandler(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query);
    const { userId, resource, action } = req.query;
    const { logs, total } = getAuditLogs({ page, limit, userId, resource, action });
    return sendSuccess(res, logs, 'Audit logs fetched.', 200, buildPaginationMeta(page, limit, total));
  } catch (err) { next(err); }
}

module.exports = { getAuditLogsHandler };
