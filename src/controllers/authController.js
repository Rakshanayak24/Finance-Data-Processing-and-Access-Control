/**
 * Authentication Controller
 */
const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/response');
const { createAuditLog } = require('../services/auditService');

async function register(req, res, next) {
  try {
    // req.user is undefined here (public route, no authenticate middleware).
    // authService.register() uses this to enforce that public callers
    // cannot self-assign roles other than 'viewer'.
    const user = await authService.register(req.body, req.user || null);
    createAuditLog({
      userId: user.id,
      action: 'REGISTER',
      resource: 'users',
      resourceId: user.id,
      ipAddress: req.ip,
    });
    return sendSuccess(res, { user }, 'Account created successfully.', 201);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login({ ...req.body, ipAddress: req.ip });
    return sendSuccess(res, result, 'Login successful.');
  } catch (err) {
    next(err);
  }
}

function refreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return sendError(res, 'Refresh token is required.', 400);
    }
    const tokens = authService.refreshTokens(refreshToken);
    return sendSuccess(res, tokens, 'Tokens refreshed successfully.');
  } catch (err) {
    next(err);
  }
}

function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      authService.logout(refreshToken);
    }
    createAuditLog({
      userId: req.user.id,
      action: 'LOGOUT',
      resource: 'auth',
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
}

function logoutAll(req, res, next) {
  try {
    authService.logoutAll(req.user.id);
    createAuditLog({
      userId: req.user.id,
      action: 'LOGOUT_ALL',
      resource: 'auth',
      ipAddress: req.ip,
    });
    return sendSuccess(res, null, 'All sessions terminated.');
  } catch (err) {
    next(err);
  }
}

function getMe(req, res) {
  return sendSuccess(res, { user: req.user }, 'Profile fetched successfully.');
}

module.exports = { register, login, refreshToken, logout, logoutAll, getMe };