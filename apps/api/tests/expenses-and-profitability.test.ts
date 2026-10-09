import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { Roles, ROLE_DEFAULT_PERMISSIONS } from '@restaurant-os/shared';

describe('Expenses & Month Review API Integration Tests', () => {
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

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Security & RBAC Enforcement', () => {
    it('blocks waiters from accessing expenses list and creating expenses', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: '/expenses',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(listRes.statusCode).toBe(403);

      const createRes = await app.inject({
        method: 'POST',
        url: '/expenses',
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          categoryId: '018f9e1e-2895-7800-9831-000000000001',
          amountPaise: 50000,
          expenseDate: '2026-10-09',
          description: 'Unauthorized expense',
        },
      });
      expect(createRes.statusCode).toBe(403);
    });

    it('blocks waiters from accessing monthly profitability review', async () => {
      const reviewRes = await app.inject({
        method: 'GET',
        url: '/reports/month-review?month=2026-10',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(reviewRes.statusCode).toBe(403);
    });

    it('allows owner to access expenses, categories, and monthly review', async () => {
      const catRes = await app.inject({
        method: 'GET',
        url: '/expense-categories',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(catRes.statusCode).not.toBe(401);
      expect(catRes.statusCode).not.toBe(403);

      const expRes = await app.inject({
        method: 'GET',
        url: '/expenses',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(expRes.statusCode).not.toBe(401);
      expect(expRes.statusCode).not.toBe(403);

      const reviewRes = await app.inject({
        method: 'GET',
        url: '/reports/month-review?month=2026-10',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(reviewRes.statusCode).not.toBe(401);
      expect(reviewRes.statusCode).not.toBe(403);
    });
  });

  describe('Validation Guardrails', () => {
    it('rejects expense creation with negative or zero amount', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/expenses',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          categoryId: '018f9e1e-2895-7800-9831-000000000001',
          amountPaise: -500,
          expenseDate: '2026-10-09',
          description: 'Invalid negative expense',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects recurring expense copy without selecting expenses', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/expenses/copy-recurring',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          sourceMonth: '2026-09',
          targetMonth: '2026-10',
          expenseIds: [],
          targetDate: '2026-10-01',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });
});
