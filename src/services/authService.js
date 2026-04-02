/**
 * Authentication Service
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const { createAuditLog } = require('./auditService');
const { ROLES } = require('../config/constants');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
const JWT_SECRET = process.env.JWT_SECRET || 'finance_dashboard_secret';

/**
 * Register a new user.
 *
 * Role assignment rules (security-critical):
 * - Unauthenticated callers always get role='viewer', regardless of
 *   what they send in the body. This prevents self-promotion to admin.
 * - An authenticated admin can specify any valid role.
 *
 * @param {object} body            - Parsed request body (name, email, password, role)
 * @param {object|null} requestingUser - req.user from authenticate middleware,
 *                                      or null for public registration
 */
async function register({ name, email, password, role }, requestingUser = null) {
  const db = getDatabase();

  // Security: only admins may assign roles other than viewer.
  // Public self-registration is always forced to viewer.
  const assignedRole =
    requestingUser?.role === ROLES.ADMIN && role ? role : ROLES.VIEWER;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    const err = new Error('An account with this email already exists.');
    err.statusCode = 409;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const id = uuidv4();

  db.prepare(
    'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, email, hashedPassword, assignedRole);

  const user = db.prepare(
    'SELECT id, name, email, role, status, created_at FROM users WHERE id = ?'
  ).get(id);

  logger.info('User registered', { userId: id, email, role: assignedRole });
  return user;
}

async function login({ email, password, ipAddress }) {
  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    // Constant-time-ish: hash a dummy value to prevent timing attacks
    await bcrypt.compare(password, '$2a$12$dummyhashforpreventionoftiming');
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  if (user.status === 'inactive') {
    const err = new Error('Account is inactive. Contact an administrator.');
    err.statusCode = 403;
    throw err;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    createAuditLog({ userId: user.id, action: 'LOGIN_FAILED', resource: 'auth', ipAddress });
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), user.id, refreshToken, expiresAt);

  createAuditLog({ userId: user.id, action: 'LOGIN_SUCCESS', resource: 'auth', ipAddress });
  logger.info('User logged in', { userId: user.id, email: user.email });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status },
  };
}

function refreshTokens(refreshToken) {
  const db = getDatabase();
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, JWT_SECRET);
  } catch {
    const err = new Error('Invalid or expired refresh token.');
    err.statusCode = 401;
    throw err;
  }

  if (decoded.type !== 'refresh') {
    const err = new Error('Invalid token type.');
    err.statusCode = 401;
    throw err;
  }

  const storedToken = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken);
  if (!storedToken) {
    const err = new Error('Refresh token not found or already revoked.');
    err.statusCode = 401;
    throw err;
  }

  if (new Date(storedToken.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(storedToken.id);
    const err = new Error('Refresh token expired.');
    err.statusCode = 401;
    throw err;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(storedToken.user_id);
  if (!user || user.status === 'inactive') {
    const err = new Error('User not found or inactive.');
    err.statusCode = 401;
    throw err;
  }

  // Rotate: delete old, issue new
  db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(storedToken.id);
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), user.id, newRefreshToken, expiresAt);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

function logout(refreshToken) {
  const db = getDatabase();
  db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
}

function logoutAll(userId) {
  const db = getDatabase();
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
}

module.exports = { register, login, refreshTokens, logout, logoutAll };