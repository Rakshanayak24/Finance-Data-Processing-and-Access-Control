/**
 * User Service
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;

const SAFE_FIELDS = 'id, name, email, role, status, created_at, updated_at';

function getAllUsers({ page = 1, limit = 20, role, status, search } = {}) {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (role)   { conditions.push('role = ?');   params.push(role); }
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (search) {
    conditions.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = db.prepare(
    `SELECT COUNT(*) as count FROM users ${where}`
  ).get(...params).count;

  const users = db.prepare(
    `SELECT ${SAFE_FIELDS} FROM users ${where}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { users, total };
}

function getUserById(id) {
  const db = getDatabase();
  const user = db.prepare(
    `SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`
  ).get(id);

  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }

  return user;
}

async function updateUser(id, updates, requestingUser) {
  const db = getDatabase();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }

  // Only admins can change roles/status
  if ((updates.role || updates.status) && requestingUser.role !== 'admin') {
    const err = new Error('Only admins can change roles or status.');
    err.statusCode = 403;
    throw err;
  }

  // Prevent admins from demoting themselves accidentally
  if (updates.role && id === requestingUser.id && updates.role !== 'admin') {
    const err = new Error('You cannot change your own role.');
    err.statusCode = 400;
    throw err;
  }

  const fields = [];
  const values = [];

  if (updates.name)   { fields.push('name = ?');   values.push(updates.name); }
  if (updates.role)   { fields.push('role = ?');   values.push(updates.role); }
  if (updates.status) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.password) {
    const hashed = await bcrypt.hash(updates.password, BCRYPT_ROUNDS);
    fields.push('password = ?');
    values.push(hashed);
  }

  if (fields.length === 0) {
    const err = new Error('No valid fields provided to update.');
    err.statusCode = 400;
    throw err;
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`
  ).run(...values);

  return getUserById(id);
}

function deleteUser(id, requestingUserId) {
  const db = getDatabase();

  if (id === requestingUserId) {
    const err = new Error('You cannot delete your own account.');
    err.statusCode = 400;
    throw err;
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    const err = new Error('User not found.');
    err.statusCode = 404;
    throw err;
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

module.exports = { getAllUsers, getUserById, updateUser, deleteUser };
