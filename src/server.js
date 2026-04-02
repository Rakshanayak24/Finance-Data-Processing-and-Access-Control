/**
 * Server Entry Point
 * Initializes the database, then starts listening.
 */

require('dotenv').config();

const app = require('./app');
const { initializeDatabase } = require('./config/database');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT, 10) || 3000;

// Initialize DB before accepting requests
initializeDatabase();
logger.info('Database initialized.');

const server = app.listen(PORT, () => {
  logger.info(`Finance Dashboard API running`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    url: `http://localhost:${PORT}`,
  });
});

// Graceful shutdown
function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    const { closeDatabase } = require('./config/database');
    closeDatabase();
    logger.info('Server closed. Database connection terminated.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  process.exit(1);
});

module.exports = server;
