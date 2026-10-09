import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Roles, ROLE_DEFAULT_PERMISSIONS } from '@restaurant-os/shared';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';

describe('Alerts & Insights API Integration Tests', () => {
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

  describe('RBAC & Role Isolation', () => {
    it('blocks unauthenticated requests to /alerts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/alerts',
      });
      expect(res.statusCode).toBe(401);
    });

    it('blocks waiter from viewing alerts (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/alerts',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('blocks kitchen staff from viewing alerts (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/alerts',
        headers: { authorization: `Bearer ${kitchenToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('blocks waiter from viewing business insights (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/insights',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('blocks waiter from viewing alert settings (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/alert-settings',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('allows owner to reach /alerts passing RBAC guard', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/alerts',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it('allows owner to reach /insights passing RBAC guard', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/insights',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it('allows owner to reach /alert-settings passing RBAC guard', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/alert-settings',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('Validation & Payload Constraints', () => {
    it('rejects update alert settings with invalid threshold values', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/alert-settings',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          cashMismatchTolerancePaise: -100, // Invalid: must be non-negative
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects snooze alert with invalid duration', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/alerts/018f9e1e-2895-7800-9831-111111111111/snooze',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          duration: '30d', // Invalid: only '1d' or '7d' allowed
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects acknowledge alert with empty note', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/alerts/018f9e1e-2895-7800-9831-111111111111/acknowledge',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          note: '',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects dismiss alert with invalid reason type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/alerts/018f9e1e-2895-7800-9831-111111111111/dismiss',
        headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
        payload: {
          reason: 12345, // Invalid: must be string
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });
});
