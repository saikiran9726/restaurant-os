import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  Roles,
  ROLE_DEFAULT_PERMISSIONS,
  DEFAULT_HEALTH_WEIGHTS,
  DEFAULT_HEALTH_TARGETS,
} from '@restaurant-os/shared';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';

describe('Restaurant Health Score API Integration Tests', () => {
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

  const managerToken = signAccessToken({
    userId: '018f9e1e-2895-7800-9831-444444444444',
    restaurantId: testRestaurantId,
    username: 'manager_user',
    name: 'Manager',
    role: Roles.MANAGER,
    permissions: ROLE_DEFAULT_PERMISSIONS[Roles.MANAGER],
  });

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Security & RBAC Enforcement', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health-score',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects waiter requests with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health-score',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects kitchen requests with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health-score',
        headers: { authorization: `Bearer ${kitchenToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects manager requests with 403 (strictly owner-only)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health-score',
        headers: { authorization: `Bearer ${managerToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('allows owner to access /health-score (passes RBAC guard)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health-score',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it('allows owner to access /health-score/model (passes RBAC guard)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health-score/model',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it('allows owner to access /health-score/history (passes RBAC guard)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health-score/history',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('Validation & Payload Constraints', () => {
    it('rejects model update if weights do not sum to 100%', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/health-score/model',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          windowDays: 30,
          weights: {
            ...DEFAULT_HEALTH_WEIGHTS,
            sales_performance: 50, // Sum will be 135%
          },
          targets: DEFAULT_HEALTH_TARGETS,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects model update with invalid windowDays', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/health-score/model',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          windowDays: 3, // Min is 7
          weights: DEFAULT_HEALTH_WEIGHTS,
          targets: DEFAULT_HEALTH_TARGETS,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects recompute with invalid date format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/health-score/recompute',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          date: 'invalid-date',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });
});
