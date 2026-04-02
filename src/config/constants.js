/**
 * Application Constants
 */

const ROLES = {
  VIEWER: 'viewer',
  ANALYST: 'analyst',
  ADMIN: 'admin',
};

const ROLE_HIERARCHY = {
  [ROLES.VIEWER]: 1,
  [ROLES.ANALYST]: 2,
  [ROLES.ADMIN]: 3,
};

const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
};

const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

// Predefined categories for financial records
const CATEGORIES = [
  'salary', 'freelance', 'investment', 'rental',
  'food', 'transport', 'utilities', 'healthcare',
  'entertainment', 'shopping', 'education', 'travel',
  'insurance', 'taxes', 'loan_payment', 'other',
];

// Role permissions matrix
const PERMISSIONS = {
  // User management
  'users:read':       [ROLES.ADMIN],
  'users:create':     [ROLES.ADMIN],
  'users:update':     [ROLES.ADMIN],
  'users:delete':     [ROLES.ADMIN],

  // Own profile
  'profile:read':     [ROLES.VIEWER, ROLES.ANALYST, ROLES.ADMIN],
  'profile:update':   [ROLES.VIEWER, ROLES.ANALYST, ROLES.ADMIN],

  // Financial records
  'records:read':     [ROLES.VIEWER, ROLES.ANALYST, ROLES.ADMIN],
  'records:create':   [ROLES.ANALYST, ROLES.ADMIN],
  'records:update':   [ROLES.ANALYST, ROLES.ADMIN],
  'records:delete':   [ROLES.ADMIN],

  // Dashboard & analytics
  'dashboard:read':   [ROLES.VIEWER, ROLES.ANALYST, ROLES.ADMIN],
  'analytics:read':   [ROLES.ANALYST, ROLES.ADMIN],

  // Audit logs
  'audit:read':       [ROLES.ADMIN],
};

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  TRANSACTION_TYPES,
  USER_STATUS,
  CATEGORIES,
  PERMISSIONS,
  PAGINATION,
};
