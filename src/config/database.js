/**
 * Database Configuration
 * Uses better-sqlite3 for synchronous, performant SQLite access.
 * WAL mode is enabled for better concurrent read performance.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/finance.db';

let db;

function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

function initializeDatabase(dbPath = DB_PATH) {
  // Special case: in-memory database for tests.
  // path.resolve(':memory:') would produce an invalid file path on Windows,
  // so we bypass all filesystem logic and open it directly.
  if (dbPath === ':memory:') {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    runMigrations();
    return db;
  }

  const resolvedPath = path.resolve(dbPath);
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);

  // Performance and reliability pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache

  runMigrations();
  return db;
}

function runMigrations() {
  db.exec(`
    -- ================================================================
    -- Users Table
    -- ================================================================
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'viewer'
                   CHECK (role IN ('viewer', 'analyst', 'admin')),
      status     TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ================================================================
    -- Financial Records Table
    -- ================================================================
    CREATE TABLE IF NOT EXISTS financial_records (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      amount      REAL NOT NULL CHECK (amount > 0),
      type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      category    TEXT NOT NULL,
      date        TEXT NOT NULL,
      description TEXT,
      tags        TEXT,
      is_deleted  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ================================================================
    -- Refresh Tokens Table
    -- ================================================================
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      token      TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- ================================================================
    -- Audit Logs Table
    -- ================================================================
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          TEXT PRIMARY KEY,
      user_id     TEXT,
      action      TEXT NOT NULL,
      resource    TEXT NOT NULL,
      resource_id TEXT,
      details     TEXT,
      ip_address  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ================================================================
    -- Indexes
    -- ================================================================
    CREATE INDEX IF NOT EXISTS idx_financial_records_user_id
      ON financial_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_financial_records_date
      ON financial_records(date);
    CREATE INDEX IF NOT EXISTS idx_financial_records_type
      ON financial_records(type);
    CREATE INDEX IF NOT EXISTS idx_financial_records_category
      ON financial_records(category);
    CREATE INDEX IF NOT EXISTS idx_financial_records_is_deleted
      ON financial_records(is_deleted);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
      ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
      ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
      ON audit_logs(created_at);

    CREATE INDEX IF NOT EXISTS idx_records_user_deleted_date
      ON financial_records(user_id, is_deleted, date);
    CREATE INDEX IF NOT EXISTS idx_records_deleted_type
      ON financial_records(is_deleted, type);
    CREATE INDEX IF NOT EXISTS idx_records_deleted_category
      ON financial_records(is_deleted, category);
  `);
}

function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { initializeDatabase, getDatabase, closeDatabase };