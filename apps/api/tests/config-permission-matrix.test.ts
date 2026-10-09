import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Roles, ROLE_DEFAULT_PERMISSIONS, Permissions } from '@restaurant-os/shared';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';

describe('Phase 3 Config & Menu Permission Matrix', () => {
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

  describe('Write Endpoints Restriction (Only OWNER/MANAGER can write)', () => {
    it('WAITER receives 403 on PUT /settings', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/settings',
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: { name: 'Unauthorized Change' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('KITCHEN receives 403 on PUT /settings', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/settings',
        headers: { authorization: `Bearer ${kitchenToken}` },
        payload: { name: 'Unauthorized Change' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('WAITER receives 403 on POST /tables', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/tables',
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: { label: 'T-99' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('KITCHEN receives 403 on POST /tables', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/tables',
        headers: { authorization: `Bearer ${kitchenToken}` },
        payload: { label: 'T-99' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('WAITER receives 403 on POST /menu/items', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/menu/items',
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: { name: 'Unauthorized Item' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('KITCHEN receives 403 on POST /menu/items', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/menu/items',
        headers: { authorization: `Bearer ${kitchenToken}` },
        payload: { name: 'Unauthorized Item' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Read Endpoints Access', () => {
    it('WAITER is allowed to access GET /tables', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/tables',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).not.toBe(403);
      expect(res.statusCode).not.toBe(401);
    });

    it('WAITER is allowed to access GET /menu', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/menu',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).not.toBe(403);
      expect(res.statusCode).not.toBe(401);
    });

    it('KITCHEN is allowed to access GET /menu', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/menu',
        headers: { authorization: `Bearer ${kitchenToken}` },
      });
      expect(res.statusCode).not.toBe(403);
      expect(res.statusCode).not.toBe(401);
    });
  });
});
