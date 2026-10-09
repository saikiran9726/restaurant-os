import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { Roles, ROLE_DEFAULT_PERMISSIONS } from '@restaurant-os/shared';

describe('Sales Analytics & End-of-Day Closing API Integration Tests', () => {
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

  describe('Security & RBAC Protection', () => {
    it('blocks waiters from accessing sales reports, items reports, and customer analytics', async () => {
      const salesRes = await app.inject({
        method: 'GET',
        url: '/reports/sales',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(salesRes.statusCode).toBe(403);

      const itemsRes = await app.inject({
        method: 'GET',
        url: '/reports/items',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(itemsRes.statusCode).toBe(403);

      const custRes = await app.inject({
        method: 'GET',
        url: '/reports/customers',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(custRes.statusCode).toBe(403);
    });

    it('blocks waiters from accessing EOD status, close, reopen, and summaries', async () => {
      const statusRes = await app.inject({
        method: 'GET',
        url: '/day/status',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(statusRes.statusCode).toBe(403);

      const closeRes = await app.inject({
        method: 'POST',
        url: '/day/close',
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          businessDate: '2026-10-09',
          openingCashPaise: 500000,
          actualCashPaise: 500000,
        },
      });
      expect(closeRes.statusCode).toBe(403);

      const reopenRes = await app.inject({
        method: 'POST',
        url: '/day/reopen',
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          businessDate: '2026-10-09',
          ownerPin: '1234',
          reason: 'Unauthorized reopen attempt',
        },
      });
      expect(reopenRes.statusCode).toBe(403);
    });

    it('allows owner to access sales reports and EOD status without 401 or 403', async () => {
      const salesRes = await app.inject({
        method: 'GET',
        url: '/reports/sales',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(salesRes.statusCode).not.toBe(401);
      expect(salesRes.statusCode).not.toBe(403);

      const statusRes = await app.inject({
        method: 'GET',
        url: '/day/status',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(statusRes.statusCode).not.toBe(401);
      expect(statusRes.statusCode).not.toBe(403);
    });
  });

  describe('Validation & Cash Count Guardrails', () => {
    it('rejects adding till cash expense with missing note or invalid amount', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/day/expenses',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          amountPaise: -500,
          category: 'supplies',
          note: '',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects EOD close payload with missing businessDate', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/day/close',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          openingCashPaise: 500000,
          actualCashPaise: 500000,
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects EOD reopen payload with empty reason or missing ownerPin', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/day/reopen',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          businessDate: '2026-10-09',
          ownerPin: '',
          reason: 'Short',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });
});
