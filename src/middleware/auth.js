/**
 * Authentication & Authorization Middleware
 */

const jwt = require('jsonwebtoken');
const { getDatabase } = require('../config/database');
const { sendError } = require('../utils/response');
const { PERMISSIONS } = require('../config/constants');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'finance_dashboard_secret';

/**
 * Verify JWT and attach user to req.user
 */
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required. Provide a Bearer token.', 401);
    }

    const token = authHeader.slice(7);

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Token expired. Please refresh your token.', 401);
      }
      return sendError(res, 'Invalid token.', 401);
    }

    // Load user from DB to ensure they still exist and are active
    const db = getDatabase();
    const user = db.prepare(
      'SELECT id, name, email, role, status FROM users WHERE id = ?'
    ).get(decoded.userId);

    if (!user) {
      return sendError(res, 'User not found.', 401);
    }

    if (user.status === 'inactive') {
      return sendError(res, 'Account is inactive. Contact an administrator.', 403);
    }

    req.user = user;
    next();
  } catch (err) {
    logger.error('Authentication middleware error', { error: err.message });
    return sendError(res, 'Authentication failed.', 500);
  }
}

/**
 * Check that the authenticated user has the required permission.
 * @param {string} permission - e.g. 'records:create'
 */
function authorize(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required.', 401);
    }

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      logger.warn('Unknown permission checked', { permission });
      return sendError(res, 'Permission not defined.', 500);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Access denied. Required permission: '${permission}'. Your role: '${req.user.role}'.`,
        403
      );
    }

    next();
  };
}

/**
 * Allow admins to manage other users, or users to access only their own resources.
 * Usage: attachSelfOrAdmin('userId' param name)
 */
function selfOrAdmin(paramName = 'userId') {
  return (req, res, next) => {
    const targetId = req.params[paramName];
    if (req.user.role === 'admin' || req.user.id === targetId) {
      return next();
    }
    return sendError(res, 'You can only access your own resources.', 403);
  };
}

/**
 * Generate a signed JWT access token.
 */
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

/**
 * Generate a refresh token (longer lived).
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

module.exports = {
  authenticate,
  authorize,
  selfOrAdmin,
  generateAccessToken,
  generateRefreshToken,
};
