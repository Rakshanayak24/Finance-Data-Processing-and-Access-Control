/**
 * Financial Records Service
 * Handles all CRUD operations and filtering for financial entries.
 */

const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');

/**
 * Build a WHERE clause dynamically based on filter params.
 * Always filters out soft-deleted records unless explicitly requested.
 */
function buildFilters(filters = {}, includeDeleted = false) {
  const conditions = [];
  const params = [];

  if (!includeDeleted) {
    conditions.push('r.is_deleted = 0');
  }

  if (filters.type) {
    conditions.push('r.type = ?');
    params.push(filters.type);
  }
  if (filters.category) {
    conditions.push('r.category = ?');
    params.push(filters.category);
  }
  if (filters.startDate) {
    conditions.push('r.date >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push('r.date <= ?');
    params.push(filters.endDate);
  }
  if (filters.userId) {
    conditions.push('r.user_id = ?');
    params.push(filters.userId);
  }
  if (filters.minAmount !== undefined) {
    conditions.push('r.amount >= ?');
    params.push(filters.minAmount);
  }
  if (filters.maxAmount !== undefined) {
    conditions.push('r.amount <= ?');
    params.push(filters.maxAmount);
  }
  if (filters.search) {
    conditions.push('(r.description LIKE ? OR r.category LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.tags) {
    // Search within JSON tags string
    const tagList = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
    tagList.forEach(tag => {
      conditions.push('r.tags LIKE ?');
      params.push(`%"${tag}"%`);
    });
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

const VALID_SORT_FIELDS = { date: 'r.date', amount: 'r.amount', category: 'r.category', created_at: 'r.created_at' };

function getRecords({
  page = 1,
  limit = 20,
  sortBy = 'date',
  order = 'desc',
  filters = {},
} = {}) {
  const db = getDatabase();
  const offset = (page - 1) * limit;
  const { where, params } = buildFilters(filters);

  const sortField = VALID_SORT_FIELDS[sortBy] || 'r.date';
  const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const total = db.prepare(
    `SELECT COUNT(*) as count FROM financial_records r ${where}`
  ).get(...params).count;

  const records = db.prepare(`
    SELECT r.*, u.name as created_by_name
    FROM financial_records r
    LEFT JOIN users u ON r.user_id = u.id
    ${where}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { records: records.map(deserializeRecord), total };
}

function getRecordById(id) {
  const db = getDatabase();
  const record = db.prepare(`
    SELECT r.*, u.name as created_by_name
    FROM financial_records r
    LEFT JOIN users u ON r.user_id = u.id
    WHERE r.id = ? AND r.is_deleted = 0
  `).get(id);

  if (!record) {
    const err = new Error('Financial record not found.');
    err.statusCode = 404;
    throw err;
  }

  return deserializeRecord(record);
}

function createRecord({ amount, type, category, date, description, tags, userId }) {
  const db = getDatabase();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO financial_records (id, user_id, amount, type, category, date, description, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, userId,
    parseFloat(amount),
    type,
    category.trim(),
    date,
    description || null,
    tags ? JSON.stringify(tags) : null
  );

  return getRecordById(id);
}

function updateRecord(id, updates) {
  const db = getDatabase();

  const existing = db.prepare(
    'SELECT id FROM financial_records WHERE id = ? AND is_deleted = 0'
  ).get(id);

  if (!existing) {
    const err = new Error('Financial record not found.');
    err.statusCode = 404;
    throw err;
  }

  const fields = [];
  const values = [];

  if (updates.amount !== undefined) { fields.push('amount = ?');      values.push(parseFloat(updates.amount)); }
  if (updates.type)                 { fields.push('type = ?');        values.push(updates.type); }
  if (updates.category)             { fields.push('category = ?');    values.push(updates.category.trim()); }
  if (updates.date)                 { fields.push('date = ?');        values.push(updates.date); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description || null); }
  if (updates.tags !== undefined)   { fields.push('tags = ?');        values.push(updates.tags ? JSON.stringify(updates.tags) : null); }

  if (fields.length === 0) {
    const err = new Error('No valid fields provided to update.');
    err.statusCode = 400;
    throw err;
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(
    `UPDATE financial_records SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values);

  return getRecordById(id);
}

/**
 * Soft delete — sets is_deleted flag without removing the row.
 * This preserves historical data and audit trails.
 */
function deleteRecord(id) {
  const db = getDatabase();

  const existing = db.prepare(
    'SELECT id FROM financial_records WHERE id = ? AND is_deleted = 0'
  ).get(id);

  if (!existing) {
    const err = new Error('Financial record not found.');
    err.statusCode = 404;
    throw err;
  }

  db.prepare(
    "UPDATE financial_records SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?"
  ).run(id);
}

/**
 * Restore a soft-deleted record (admin only).
 */
function restoreRecord(id) {
  const db = getDatabase();

  const existing = db.prepare(
    'SELECT id FROM financial_records WHERE id = ? AND is_deleted = 1'
  ).get(id);

  if (!existing) {
    const err = new Error('Deleted record not found.');
    err.statusCode = 404;
    throw err;
  }

  db.prepare(
    "UPDATE financial_records SET is_deleted = 0, updated_at = datetime('now') WHERE id = ?"
  ).run(id);

  return getRecordById(id);
}

/**
 * Deserialize stored JSON fields back to JS types.
 */
function deserializeRecord(record) {
  return {
    ...record,
    tags: record.tags ? JSON.parse(record.tags) : [],
    is_deleted: Boolean(record.is_deleted),
  };
}

module.exports = {
  getRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  restoreRecord,
  buildFilters,
};
