/**
 * Rate Limiting Configuration
 */

const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/response');

const isTest = process.env.NODE_ENV === 'test';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const max = parseInt(process.env.RATE_LIMIT_MAX, 10) || 100;

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs,
  max: isTest ? 0 : max,   // 0 = unlimited in test mode
  skip: () => isTest,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 'Too many requests. Please try again later.', 429);
  },
});

/**
 * Stricter limiter for auth endpoints
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 0 : 10,    // 0 = unlimited in test mode
  skip: () => isTest,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, 'Too many authentication attempts. Please try again in 15 minutes.', 429);
  },
});

module.exports = { apiLimiter, authLimiter };