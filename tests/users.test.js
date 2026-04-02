/**
 * User Management API Tests
 */

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb, teardownTestDb, createTestUser, loginAs } = require('./helpers');

beforeEach(setupTestDb);
afterEach(teardownTestDb);

describe('GET /api/v1/users', () => {
  it('admin can list all users', async () => {
    const admin = await createTestUser({ role: 'admin' });
    await createTestUser({ role: 'viewer' });
    const token = await loginAs(admin);
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.meta.pagination).toBeDefined();
  });

  it('analyst cannot list all users', async () => {
    const analyst = await createTestUser({ role: 'analyst' });
    const token = await loginAs(analyst);
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('supports search filtering', async () => {
    const admin = await createTestUser({ role: 'admin', name: 'Admin Person' });
    await createTestUser({ role: 'viewer', name: 'Another User' });
    const token = await loginAs(admin);
    const res = await request(app).get('/api/v1/users?search=Admin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every(u => u.name.includes('Admin') || u.email.includes('admin'))).toBe(true);
  });
});

describe('GET /api/v1/users/:id', () => {
  it('admin can get any user', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const viewer = await createTestUser({ role: 'viewer' });
    const token = await loginAs(admin);
    const res = await request(app).get(`/api/v1/users/${viewer.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(viewer.id);
  });

  it('user can get their own profile', async () => {
    const user = await createTestUser({ role: 'viewer' });
    const token = await loginAs(user);
    const res = await request(app).get(`/api/v1/users/${user.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('user cannot get another user\'s profile', async () => {
    const user1 = await createTestUser({ role: 'viewer' });
    const user2 = await createTestUser({ role: 'viewer' });
    const token = await loginAs(user1);
    const res = await request(app).get(`/api/v1/users/${user2.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent user', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const token = await loginAs(admin);
    const res = await request(app).get('/api/v1/users/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/users/:id', () => {
  it('admin can change another user\'s role', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const viewer = await createTestUser({ role: 'viewer' });
    const token = await loginAs(admin);
    const res = await request(app).patch(`/api/v1/users/${viewer.id}`).set('Authorization', `Bearer ${token}`).send({ role: 'analyst' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('analyst');
  });

  it('admin can deactivate a user', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const viewer = await createTestUser({ role: 'viewer' });
    const token = await loginAs(admin);
    const res = await request(app).patch(`/api/v1/users/${viewer.id}`).set('Authorization', `Bearer ${token}`).send({ status: 'inactive' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('inactive');
  });

  it('non-admin cannot change roles', async () => {
    const viewer = await createTestUser({ role: 'viewer' });
    const token = await loginAs(viewer);
    const res = await request(app).patch(`/api/v1/users/${viewer.id}`).set('Authorization', `Bearer ${token}`).send({ role: 'admin' });
    expect(res.status).toBe(403);
  });

  it('user can update their own name', async () => {
    const user = await createTestUser({ role: 'viewer' });
    const token = await loginAs(user);
    const res = await request(app).patch(`/api/v1/users/${user.id}`).set('Authorization', `Bearer ${token}`).send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
  });
});

describe('DELETE /api/v1/users/:id', () => {
  it('admin can delete another user', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const viewer = await createTestUser({ role: 'viewer' });
    const token = await loginAs(admin);
    const res = await request(app).delete(`/api/v1/users/${viewer.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('admin cannot delete themselves', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const token = await loginAs(admin);
    const res = await request(app).delete(`/api/v1/users/${admin.id}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('non-admin cannot delete users', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const viewer = await createTestUser({ role: 'viewer' });
    const viewerToken = await loginAs(viewer);
    const res = await request(app).delete(`/api/v1/users/${admin.id}`).set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
  });
});
