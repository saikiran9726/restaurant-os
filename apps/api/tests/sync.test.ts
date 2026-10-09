import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { Roles, ROLE_DEFAULT_PERMISSIONS, Permissions } from '@restaurant-os/shared';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';

describe('Offline Sync & Local Hub Integration Tests', () => {
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
    it('blocks unauthenticated requests to /sync/push', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/sync/push',
        payload: {
          restaurantId: testRestaurantId,
          deviceId: 'dev-001',
          batchId: 'batch-001',
          commands: [],
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it('blocks waiter from viewing sync status overview (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/sync/status',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('blocks kitchen from registering a local hub (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/sync/hub/register',
        headers: { authorization: `Bearer ${kitchenToken}` },
        payload: {
          deviceId: 'hub-001',
          name: 'Kitchen Hub',
          hostAddress: '192.168.1.100:3000',
          apiKey: 'super-secret-hub-key-1234',
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('blocks waiter from viewing dead letter commands (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/sync/dead-letter',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('blocks waiter from viewing conflict reviews (403 Forbidden)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/sync/conflicts',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('allows owner to access /sync/status passing RBAC guard', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/sync/status',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('Validation & Batch Guards', () => {
    it('rejects push batch with empty commands array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/sync/push',
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          restaurantId: testRestaurantId,
          deviceId: 'dev-001',
          batchId: 'batch-001',
          commands: [],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects hub registration with short apiKey', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/sync/hub/register',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          deviceId: 'hub-001',
          name: 'Local Hub',
          hostAddress: '192.168.1.100:3000',
          apiKey: 'short', // Min 8 chars
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects discarding dead-letter without explanatory reason', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/sync/dead-letter/018f9e1e-2895-7800-9831-000000000000/discard',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          reason: 'no', // Min 3 chars
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects conflict resolution without explanatory note', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/sync/conflicts/018f9e1e-2895-7800-9831-000000000000/resolve',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          resolutionNote: '  ',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });
});
