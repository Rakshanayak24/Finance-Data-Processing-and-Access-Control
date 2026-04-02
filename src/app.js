
/**
 * Express Application Setup
 * Kept separate from server.js to allow clean testing without port binding.
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Routes
const authRoutes      = require('./routes/authRoutes');
const userRoutes      = require('./routes/userRoutes');
const recordRoutes    = require('./routes/recordRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const auditRoutes     = require('./routes/auditRoutes');
const docsRoutes      = require('./routes/docsRoutes');

const app = express();

// ================================================================
// Security headers
// Swagger UI needs inline styles/scripts so we relax CSP for /docs only
// ================================================================
app.use('/api/v1/docs', (req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;"
  );
  next();
});
app.use(helmet());

// ================================================================
// CORS
// ================================================================
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ================================================================
// Body parsing & compression
// ================================================================
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ================================================================
// HTTP request logging
// ================================================================
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ================================================================
// Rate limiting (global — excludes docs)
// ================================================================
app.use('/api', apiLimiter);

// ================================================================
// Health check (unauthenticated)
// ================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
    environment: process.env.NODE_ENV || 'development',
    docs: '/api/v1/docs',
  });
});

// ================================================================
// API Routes
// ================================================================
app.use('/api/v1/auth',      authRoutes);
app.use('/api/v1/users',     userRoutes);
app.use('/api/v1/records',   recordRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/audit',     auditRoutes);
app.use('/api/v1/docs',      docsRoutes);

// ================================================================
// API root — shows all available routes
// ================================================================
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Finance Dashboard API',
    version: 'v1',
    documentation: 'http://localhost:3000/api/v1/docs',
    endpoints: {
      auth:      '/api/v1/auth',
      users:     '/api/v1/users',
      records:   '/api/v1/records',
      dashboard: '/api/v1/dashboard',
      audit:     '/api/v1/audit',
      docs:      '/api/v1/docs',
    },
  });
});

// ================================================================
// Error handling — must be last
// ================================================================
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;