/**
 * Validation Middleware
 * Centralized validation rules using express-validator.
 */

const { body, query, param, validationResult } = require('express-validator');
const { sendError } = require('../utils/response');
const { CATEGORIES, TRANSACTION_TYPES } = require('../config/constants');

/**
 * Run after validators — extracts errors and returns 422 if any.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(
      res,
      'Validation failed. Check the errors field for details.',
      422,
      errors.array().map(e => ({ field: e.path, message: e.msg, value: e.value }))
    );
  }
  next();
}

// ================================================================
// Auth validators
// ================================================================
const registerValidators = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Must be a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.'),
  body('role')
    .optional()
    .isIn(['viewer', 'analyst', 'admin']).withMessage('Role must be viewer, analyst, or admin.'),
];

const loginValidators = [
  body('email')
    .trim().notEmpty().withMessage('Email is required.').isEmail().normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.'),
];

// ================================================================
// User validators
// ================================================================
const updateUserValidators = [
  body('name')
    .optional().trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters.'),
  body('role')
    .optional()
    .isIn(['viewer', 'analyst', 'admin']).withMessage('Invalid role.'),
  body('status')
    .optional()
    .isIn(['active', 'inactive']).withMessage('Status must be active or inactive.'),
];

// ================================================================
// Financial record validators
// ================================================================
const createRecordValidators = [
  body('amount')
    .notEmpty().withMessage('Amount is required.')
    .isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
  body('type')
    .notEmpty().withMessage('Type is required.')
    .isIn(Object.values(TRANSACTION_TYPES)).withMessage('Type must be income or expense.'),
  body('category')
    .trim().notEmpty().withMessage('Category is required.')
    .isLength({ max: 50 }).withMessage('Category must be 50 characters or fewer.'),
  body('date')
    .notEmpty().withMessage('Date is required.')
    .isISO8601().withMessage('Date must be a valid ISO 8601 date (YYYY-MM-DD).'),
  body('description')
    .optional().trim()
    .isLength({ max: 500 }).withMessage('Description must be 500 characters or fewer.'),
  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array.')
    .custom(tags => tags.every(t => typeof t === 'string' && t.length <= 30))
    .withMessage('Each tag must be a string ≤ 30 characters.'),
];

const updateRecordValidators = [
  body('amount')
    .optional()
    .isFloat({ gt: 0 }).withMessage('Amount must be a positive number.'),
  body('type')
    .optional()
    .isIn(Object.values(TRANSACTION_TYPES)).withMessage('Type must be income or expense.'),
  body('category')
    .optional().trim()
    .isLength({ max: 50 }).withMessage('Category must be 50 characters or fewer.'),
  body('date')
    .optional()
    .isISO8601().withMessage('Date must be a valid ISO 8601 date.'),
  body('description')
    .optional().trim()
    .isLength({ max: 500 }).withMessage('Description must be 500 characters or fewer.'),
  body('tags')
    .optional()
    .isArray().withMessage('Tags must be an array.'),
];

// ================================================================
// Query param validators for filtering
// ================================================================
const recordQueryValidators = [
  query('type')
    .optional()
    .isIn(['income', 'expense']).withMessage('type must be income or expense.'),
  query('startDate')
    .optional()
    .isISO8601().withMessage('startDate must be a valid date.'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('endDate must be a valid date.'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100.'),
  query('sortBy')
    .optional()
    .isIn(['date', 'amount', 'category', 'created_at']).withMessage('Invalid sortBy field.'),
  query('order')
    .optional()
    .isIn(['asc', 'desc']).withMessage('order must be asc or desc.'),
];

const paramIdValidator = [
  param('id').isUUID().withMessage('ID must be a valid UUID.'),
];

module.exports = {
  validate,
  registerValidators,
  loginValidators,
  updateUserValidators,
  createRecordValidators,
  updateRecordValidators,
  recordQueryValidators,
  paramIdValidator,
};
