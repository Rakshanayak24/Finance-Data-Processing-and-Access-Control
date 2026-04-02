/**
 * Auth API Tests
 */

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb, teardownTestDb, createTestUser, loginAs } = require('./helpers');

beforeEach(setupTestDb);
afterEach(teardownTestDb);

describe('POST /api/v1/auth/register', () => {
  const validPayload = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'Secret@123',
  };

  it('registers a new user and returns 201', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(validPayload.email);
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('returns 409 for duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send(validPayload);
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);
    expect(res.status).toBe(409);
  });

  it('returns 422 for missing required fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'x@x.com' });
    expect(res.status).toBe(422);
    expect(res.body.errors).toBeDefined();
  });

  it('returns 422 for weak password', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...validPayload, password: 'weak' });
    expect(res.status).toBe(422);
  });

  it('returns 422 for invalid email', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ ...validPayload, email: 'not-an-email' });
    expect(res.status).toBe(422);
  });

  it('defaults role to viewer', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(validPayload);
    expect(res.body.data.user.role).toBe('viewer');
  });
});

describe('POST /api/v1/auth/login', () => {
  let user;
  beforeEach(async () => { user = await createTestUser({ role: 'admin' }); });

  it('returns tokens and user info on valid credentials', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.role).toBe('admin');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'WrongPass@1' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'ghost@nowhere.com', password: 'Test@1234' });
    expect(res.status).toBe(401);
  });

  it('rejects inactive users', async () => {
    const inactive = await createTestUser({ role: 'viewer', status: 'inactive' });
    const res = await request(app).post('/api/v1/auth/login').send({ email: inactive.email, password: inactive.password });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns current user profile', async () => {
    const user = await createTestUser({ role: 'analyst' });
    const token = await loginAs(user);
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer badtoken');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('issues new tokens with a valid refresh token', async () => {
    const user = await createTestUser();
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: user.password });
    const { refreshToken } = loginRes.body.data;

    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('rejects invalid refresh tokens', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: 'garbage' });
    expect(res.status).toBe(401);
  });
});
