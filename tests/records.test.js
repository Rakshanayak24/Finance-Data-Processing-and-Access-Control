/**
 * Financial Records API Tests
 */

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb, teardownTestDb, createTestUser, loginAs, createTestRecord } = require('./helpers');

beforeEach(setupTestDb);
afterEach(teardownTestDb);

async function getToken(role) {
  const user = await createTestUser({ role });
  const token = await loginAs(user);
  return { user, token };
}

const validRecord = {
  amount: 1500,
  type: 'expense',
  category: 'food',
  date: '2024-03-15',
  description: 'Grocery shopping',
  tags: ['monthly', 'food'],
};

describe('GET /api/v1/records', () => {
  it('allows viewers to read records', async () => {
    const { token } = await getToken('viewer');
    const res = await request(app).get('/api/v1/records').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns paginated results with meta', async () => {
    const { token } = await getToken('admin');
    const res = await request(app).get('/api/v1/records?page=1&limit=5').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination).toBeDefined();
    expect(res.body.meta.pagination.limit).toBe(5);
  });

  it('filters by type', async () => {
    const { user, token } = await getToken('analyst');
    createTestRecord(user.id, { type: 'income', category: 'salary' });
    createTestRecord(user.id, { type: 'expense', category: 'food' });

    const res = await request(app).get('/api/v1/records?type=income').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every(r => r.type === 'income')).toBe(true);
  });

  it('filters by date range', async () => {
    const { token } = await getToken('viewer');
    const res = await request(app)
      .get('/api/v1/records?startDate=2024-01-01&endDate=2024-12-31')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/records');
    expect(res.status).toBe(401);
  });

  it('returns 422 for invalid query params', async () => {
    const { token } = await getToken('viewer');
    const res = await request(app).get('/api/v1/records?type=invalid').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/records', () => {
  it('allows analyst to create a record', async () => {
    const { token } = await getToken('analyst');
    const res = await request(app).post('/api/v1/records').set('Authorization', `Bearer ${token}`).send(validRecord);
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(1500);
    expect(res.body.data.tags).toEqual(['monthly', 'food']);
  });

  it('allows admin to create a record', async () => {
    const { token } = await getToken('admin');
    const res = await request(app).post('/api/v1/records').set('Authorization', `Bearer ${token}`).send(validRecord);
    expect(res.status).toBe(201);
  });

  it('blocks viewer from creating records', async () => {
    const { token } = await getToken('viewer');
    const res = await request(app).post('/api/v1/records').set('Authorization', `Bearer ${token}`).send(validRecord);
    expect(res.status).toBe(403);
  });

  it('returns 422 for negative amount', async () => {
    const { token } = await getToken('analyst');
    const res = await request(app).post('/api/v1/records').set('Authorization', `Bearer ${token}`).send({ ...validRecord, amount: -100 });
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid date', async () => {
    const { token } = await getToken('analyst');
    const res = await request(app).post('/api/v1/records').set('Authorization', `Bearer ${token}`).send({ ...validRecord, date: 'not-a-date' });
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid type', async () => {
    const { token } = await getToken('analyst');
    const res = await request(app).post('/api/v1/records').set('Authorization', `Bearer ${token}`).send({ ...validRecord, type: 'refund' });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/v1/records/:id', () => {
  it('allows analyst to update a record', async () => {
    const { user, token } = await getToken('analyst');
    const record = createTestRecord(user.id);
    const res = await request(app).patch(`/api/v1/records/${record.id}`).set('Authorization', `Bearer ${token}`).send({ amount: 999 });
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(999);
  });

  it('blocks viewer from updating', async () => {
    const adminData = await getToken('admin');
    const record = createTestRecord(adminData.user.id);
    const { token } = await getToken('viewer');
    const res = await request(app).patch(`/api/v1/records/${record.id}`).set('Authorization', `Bearer ${token}`).send({ amount: 1 });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent record', async () => {
    const { token } = await getToken('analyst');
    const res = await request(app).patch('/api/v1/records/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${token}`).send({ amount: 100 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/records/:id (soft delete)', () => {
  it('allows admin to soft-delete a record', async () => {
    const { user, token } = await getToken('admin');
    const record = createTestRecord(user.id);
    const res = await request(app).delete(`/api/v1/records/${record.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // Verify it's gone from normal queries
    const getRes = await request(app).get(`/api/v1/records/${record.id}`).set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  it('blocks analyst from deleting', async () => {
    const adminData = await getToken('admin');
    const record = createTestRecord(adminData.user.id);
    const { token } = await getToken('analyst');
    const res = await request(app).delete(`/api/v1/records/${record.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('allows admin to restore a soft-deleted record', async () => {
    const { user, token } = await getToken('admin');
    const record = createTestRecord(user.id);
    await request(app).delete(`/api/v1/records/${record.id}`).set('Authorization', `Bearer ${token}`);
    const res = await request(app).post(`/api/v1/records/${record.id}/restore`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
