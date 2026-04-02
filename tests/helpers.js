/**
 * Test Setup Helper
 * Creates an isolated in-memory database for each test suite.
 */

require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.DB_PATH = ':memory:';

const { initializeDatabase, closeDatabase, getDatabase } = require('../src/config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const request = require('supertest');
const app = require('../src/app');

function setupTestDb() {
  initializeDatabase(':memory:');
}

function teardownTestDb() {
  closeDatabase();
}

async function createTestUser({ name = 'Test User', email, password = 'Test@1234', role = 'viewer', status = 'active' } = {}) {
  const db = getDatabase();
  const id = uuidv4();
  const hashed = await bcrypt.hash(password, 10);
  email = email || `${role}_${id.slice(0, 8)}@test.com`;

  db.prepare(
    'INSERT INTO users (id, name, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name, email, hashed, role, status);

  return { id, name, email, password, role, status };
}

async function loginAs(user) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: user.password });
  return res.body.data.accessToken;
}

async function getAuthHeader(role = 'admin') {
  const user = await createTestUser({ role });
  const token = await loginAs(user);
  return { user, token, header: `Bearer ${token}` };
}

function createTestRecord(userId, overrides = {}) {
  const db = getDatabase();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO financial_records (id, user_id, amount, type, category, date, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, userId,
    overrides.amount || 1000,
    overrides.type || 'expense',
    overrides.category || 'food',
    overrides.date || '2024-06-15',
    overrides.description || 'Test record'
  );
  return { id, userId, ...overrides };
}

module.exports = { setupTestDb, teardownTestDb, createTestUser, loginAs, getAuthHeader, createTestRecord };
