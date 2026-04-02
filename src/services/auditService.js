/**
 * Audit Log Service
 * Records all significant actions for compliance and debugging.
 */

const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

function createAuditLog({ userId, action, resource, resourceId, details, ipAddress }) {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, resource, resource_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      uuidv4(),
      userId || null,
      action,
      resource,
      resourceId || null,
      details ? JSON.stringify(details) : null,
      ipAddress || null
    );
  } catch (err) {
    // Audit failures should not crash the request
    logger.error('Failed to write audit log', { error: err.message, action, resource });
  }
}

function getAuditLogs({ page = 1, limit = 20, userId, resource, action } = {}) {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (userId) { conditions.push('user_id = ?'); params.push(userId); }
  if (resource) { conditions.push('resource = ?'); params.push(resource); }
  if (action) { conditions.push('action LIKE ?'); params.push(`%${action}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) as count FROM audit_logs ${where}`).get(...params).count;

  const logs = db.prepare(`
    SELECT al.*, u.name as user_name, u.email as user_email
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ${where}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return {
    logs: logs.map(l => ({
      ...l,
      details: l.details ? JSON.parse(l.details) : null,
    })),
    total,
  };
}

module.exports = { createAuditLog, getAuditLogs };
