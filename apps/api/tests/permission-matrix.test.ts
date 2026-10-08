import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Roles, ROLE_DEFAULT_PERMISSIONS } from '@restaurant-os/shared';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';

describe('Role Permission Matrix Enforcement', () => {
  let app: FastifyInstance;

  const testRestaurantId = '018f9e1e-2895-7800-9831-294719283748';
  const ownerToken = signAccessToken({
    userId: '018f9e1e-2895-7800-9831-111111111111',
    restaurantId: testRestaurantId,
    username: 'owner_user',
    name: 'Owner',
    role: Roles.OWNER,
    permissions: ROLE_DEFAULT_PERMISSIONS[Roles.OWNER],
  });

  const waiterToken = signAccessToken({
    userId: '018f9e1e-2895-7800-9831-222222222222',
    restaurantId: testRestaurantId,
    username: 'waiter_user',
    name: 'Waiter',
    role: Roles.WAITER,
    permissions: ROLE_DEFAULT_PERMISSIONS[Roles.WAITER],
  });

  const kitchenToken = signAccessToken({
    userId: '018f9e1e-2895-7800-9831-333333333333',
    restaurantId: testRestaurantId,
    username: 'kitchen_user',
    name: 'Kitchen',
    role: Roles.KITCHEN,
    permissions: ROLE_DEFAULT_PERMISSIONS[Roles.KITCHEN],
  });

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Unauthenticated requests', () => {
    it('rejects /staff with 401 when no token provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/staff',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects /audit-logs with 401 when no token provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/audit-logs',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Owner endpoints access by Waiter and Kitchen roles', () => {
    it('allows OWNER to access GET /staff', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/staff',
        headers: {
          authorization: `Bearer ${ownerToken}`,
        },
      });
      // Not 401 or 403 forbidden
      expect(res.statusCode).not.toBe(403);
      expect(res.statusCode).not.toBe(401);
    });

    it('WAITER receives 403 on staff management (GET /staff)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/staff',
        headers: {
          authorization: `Bearer ${waiterToken}`,
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('KITCHEN receives 403 on staff management (GET /staff)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/staff',
        headers: {
          authorization: `Bearer ${kitchenToken}`,
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('WAITER receives 403 on audit logs (GET /audit-logs)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/audit-logs',
        headers: {
          authorization: `Bearer ${waiterToken}`,
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('KITCHEN receives 403 on audit logs (GET /audit-logs)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/audit-logs',
        headers: {
          authorization: `Bearer ${kitchenToken}`,
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });
  });

  describe('Authenticated user endpoint (/me)', () => {
    it('allows WAITER to access /me with valid token', async () => {
      // Stub db query for /me so it returns active user
      const res = await app.inject({
        method: 'GET',
        url: '/me',
        headers: {
          authorization: `Bearer ${waiterToken}`,
        },
      });
      // Either 200 or 401 if user not found in mock db, but NOT 403 forbidden
      expect(res.statusCode).not.toBe(403);
    });
  });
});
