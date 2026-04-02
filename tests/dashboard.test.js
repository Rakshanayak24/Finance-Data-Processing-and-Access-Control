/**
 * Dashboard & Analytics API Tests
 */

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb, teardownTestDb, createTestUser, loginAs, createTestRecord } = require('./helpers');

beforeEach(setupTestDb);
afterEach(teardownTestDb);

async function setup(role) {
  const user = await createTestUser({ role });
  const token = await loginAs(user);
  // Seed some records
  createTestRecord(user.id, { type: 'income',  amount: 50000, category: 'salary',  date: '2024-06-01' });
  createTestRecord(user.id, { type: 'expense', amount: 5000,  category: 'food',    date: '2024-06-05' });
  createTestRecord(user.id, { type: 'expense', amount: 2000,  category: 'transport', date: '2024-06-10' });
  return { user, token };
}

describe('GET /api/v1/dashboard/overview', () => {
  it('returns full overview for admin', async () => {
    const { token } = await setup('admin');
    const res = await request(app).get('/api/v1/dashboard/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('categoryBreakdown');
    expect(res.body.data).toHaveProperty('monthlyTrends');
    expect(res.body.data).toHaveProperty('recentActivity');
  });

  it('viewers can access overview', async () => {
    const { token } = await setup('viewer');
    const res = await request(app).get('/api/v1/dashboard/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/dashboard/summary', () => {
  it('returns correct totals', async () => {
    const { token } = await setup('analyst');
    const res = await request(app).get('/api/v1/dashboard/summary').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const { totalIncome, totalExpenses, netBalance } = res.body.data;
    expect(totalIncome).toBeGreaterThan(0);
    expect(totalExpenses).toBeGreaterThan(0);
    expect(netBalance).toBe(Math.round((totalIncome - totalExpenses) * 100) / 100);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/dashboard/categories', () => {
  it('viewers cannot access analytics', async () => {
    const { token } = await setup('viewer');
    const res = await request(app).get('/api/v1/dashboard/categories').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('analysts can access category breakdown', async () => {
    const { token } = await setup('analyst');
    const res = await request(app).get('/api/v1/dashboard/categories').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/v1/dashboard/trends/monthly', () => {
  it('returns monthly trend data for analyst', async () => {
    const { token } = await setup('analyst');
    const res = await request(app).get('/api/v1/dashboard/trends/monthly').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('blocks viewers from trend data', async () => {
    const { token } = await setup('viewer');
    const res = await request(app).get('/api/v1/dashboard/trends/monthly').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/dashboard/recent-activity', () => {
  it('returns recent records for all roles', async () => {
    const { token } = await setup('viewer');
    const res = await request(app).get('/api/v1/dashboard/recent-activity').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
