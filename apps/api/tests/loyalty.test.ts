import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { Roles, ROLE_DEFAULT_PERMISSIONS } from '@restaurant-os/shared';

describe('Loyalty Program & Ledger API Integration Tests', () => {
  let app: FastifyInstance;
  const testRestaurantId = '018f9e1e-2895-7800-9831-000000000000';

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
    name: 'Kitchen Staff',
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

  describe('Security & RBAC Enforcement', () => {
    it('blocks waiters from accessing loyalty settings and overview', async () => {
      const settingsRes = await app.inject({
        method: 'GET',
        url: '/loyalty/settings',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(settingsRes.statusCode).toBe(403);

      const overviewRes = await app.inject({
        method: 'GET',
        url: '/loyalty/overview',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(overviewRes.statusCode).toBe(403);
    });

    it('blocks waiters from manual loyalty adjustment', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/loyalty/adjust',
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          customerId: '018f9e1e-2895-7800-9831-000000000001',
          points: 100,
          reason: 'Unauthorized attempt',
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('passes RBAC guard for owner loyalty settings and overview', async () => {
      const getRes = await app.inject({
        method: 'GET',
        url: '/loyalty/settings',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      // Passes authentication & RBAC check
      expect(getRes.statusCode).not.toBe(401);
      expect(getRes.statusCode).not.toBe(403);

      const overviewRes = await app.inject({
        method: 'GET',
        url: '/loyalty/overview',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(overviewRes.statusCode).not.toBe(401);
      expect(overviewRes.statusCode).not.toBe(403);
    });

    it('passes RBAC guard for customer loyalty lookup', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/customers/018f9e1e-2895-7800-9831-000000000001/loyalty',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it('passes RBAC guard for owner manual adjustment', async () => {
      const adjustRes = await app.inject({
        method: 'POST',
        url: '/loyalty/adjust',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          customerId: '018f9e1e-2895-7800-9831-000000000001',
          points: 500,
          reason: 'Welcome bonus approved by Owner',
        },
      });
      expect(adjustRes.statusCode).not.toBe(401);
      expect(adjustRes.statusCode).not.toBe(403);
    });

    it('rejects manual adjust with zero points or invalid reason length', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/loyalty/adjust',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          customerId: '018f9e1e-2895-7800-9831-000000000001',
          points: 0,
          reason: 'Hi',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects points redemption on bill without positive integer points', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/bills/018f9e1e-2895-7800-9831-000000000001/redeem',
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          pointsToRedeem: -50,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });
});
