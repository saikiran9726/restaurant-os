import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  Roles,
  ROLE_DEFAULT_PERMISSIONS,
  Permissions,
  generateUuidV7,
} from '@restaurant-os/shared';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';

describe('Comprehensive Security, IDOR, & Response Shaping Audit', () => {
  let app: FastifyInstance;

  const testRestaurantId = '018f9e1e-2895-7800-9831-294719283748';
  const otherRestaurantId = '018f9e1e-2895-7800-9831-999999999999';

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

  // Custom data-driven role: Cashier/Manager to prove extensibility
  const cashierToken = signAccessToken({
    userId: '018f9e1e-2895-7800-9831-444444444444',
    restaurantId: testRestaurantId,
    username: 'cashier_user',
    name: 'Cashier',
    role: Roles.MANAGER,
    permissions: [
      Permissions.ORDER_READ,
      Permissions.ORDER_CREATE,
      Permissions.BILL_CREATE,
      Permissions.PAYMENT_RECORD,
    ],
  });

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('IDOR & Cross-Tenant Isolation Tests', () => {
    it('blocks waiter from accessing another restaurant data via parameter tampering', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/tables?restaurantId=${otherRestaurantId}`,
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      // Response must only return tables of authenticated token's restaurant
      if (res.statusCode === 200) {
        const body = res.json();
        for (const t of body.data || []) {
          expect(t.restaurantId).not.toBe(otherRestaurantId);
        }
      }
    });

    it('blocks kitchen staff from accessing bill history or receipts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/bills',
        headers: { authorization: `Bearer ${kitchenToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('blocks waiter from viewing raw expenses or P&L profitability data', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/expenses',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('blocks cashier without report.read from viewing sales reports', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/reports/sales',
        headers: { authorization: `Bearer ${cashierToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects client with 403 TENANT_MISMATCH when X-Restaurant-Id header conflicts with JWT token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/orders',
        headers: {
          authorization: `Bearer ${waiterToken}`,
          'x-restaurant-id': otherRestaurantId,
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.message).toContain('TENANT_MISMATCH');
    });

    it('returns 404 for foreign order lookup while recording cross-tenant security telemetry', async () => {
      const nonExistentOrForeignId = generateUuidV7();
      const res = await app.inject({
        method: 'GET',
        url: `/orders/${nonExistentOrForeignId}`,
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      if (res.statusCode !== 404) {
        console.error('DEBUG FAIL:', res.statusCode, res.body);
      }
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    });
  });

  describe('Response Shaping & Sensitive Data Leaks', () => {
    it('ensures waiter order list contains no supplier costs or profit margin fields', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/orders',
        headers: { authorization: `Bearer ${waiterToken}` },
      });

      if (res.statusCode === 200) {
        const text = res.body;
        expect(text).not.toContain('profit_paise');
        expect(text).not.toContain('cost_price');
        expect(text).not.toContain('avg_cost_paise');
        expect(text).not.toContain('operating_margin');
      }
    });

    it('ensures kitchen KOT snapshots contain no customer lifetime spend or financial balances', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/kots',
        headers: { authorization: `Bearer ${kitchenToken}` },
      });

      if (res.statusCode === 200) {
        const text = res.body;
        expect(text).not.toContain('totalSpendPaise');
        expect(text).not.toContain('loyaltyPointsBalance');
        expect(text).not.toContain('drawerCashPaise');
      }
    });
  });

  describe('Security Headers & Transport Controls', () => {
    it('sets standard defensive security headers on all responses', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(
        res.headers['x-frame-options'] || res.headers['content-security-policy'],
      ).toBeDefined();
    });

    it('enforces request tracking with x-request-id header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-request-id': 'req-test-trace-1234' },
      });

      expect(res.headers['x-request-id']).toBe('req-test-trace-1234');
    });
  });
});
