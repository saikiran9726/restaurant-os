import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { Roles, ROLE_DEFAULT_PERMISSIONS } from '@restaurant-os/shared';

describe('Inventory & Stock API Integration Tests', () => {
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

  describe('Security & RBAC Protection', () => {
    it('blocks waiters from accessing inventory items, purchases, and reorder list', async () => {
      const itemsRes = await app.inject({
        method: 'GET',
        url: '/inventory/items',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(itemsRes.statusCode).toBe(403);

      const purchasesRes = await app.inject({
        method: 'GET',
        url: '/inventory/purchases',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(purchasesRes.statusCode).toBe(403);

      const reorderRes = await app.inject({
        method: 'GET',
        url: '/inventory/reorder',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(reorderRes.statusCode).toBe(403);
    });

    it('blocks kitchen staff from accessing inventory items and recording usage', async () => {
      const itemsRes = await app.inject({
        method: 'GET',
        url: '/inventory/items',
        headers: { authorization: `Bearer ${kitchenToken}` },
      });
      expect(itemsRes.statusCode).toBe(403);

      const usageRes = await app.inject({
        method: 'POST',
        url: '/inventory/usage',
        headers: { authorization: `Bearer ${kitchenToken}` },
        payload: {
          itemId: '018f9e1e-2895-7800-9831-000000000001',
          quantity: 5,
        },
      });
      expect(usageRes.statusCode).toBe(403);
    });

    it('allows owner to access inventory items, suppliers, and reorder list', async () => {
      const itemsRes = await app.inject({
        method: 'GET',
        url: '/inventory/items',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(itemsRes.statusCode).not.toBe(401);
      expect(itemsRes.statusCode).not.toBe(403);

      const supRes = await app.inject({
        method: 'GET',
        url: '/inventory/suppliers',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(supRes.statusCode).not.toBe(401);
      expect(supRes.statusCode).not.toBe(403);

      const reorderRes = await app.inject({
        method: 'GET',
        url: '/inventory/reorder',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(reorderRes.statusCode).not.toBe(401);
      expect(reorderRes.statusCode).not.toBe(403);
    });
  });

  describe('Validation Guardrails', () => {
    it('rejects inventory item creation with empty name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/inventory/items',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          name: '',
          unit: 'kg',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects purchase creation without purchase lines', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/inventory/purchases',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          purchaseDate: '2026-10-09',
          lines: [],
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects waste recording with negative quantity or invalid reason', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/inventory/waste',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          itemId: '018f9e1e-2895-7800-9831-000000000001',
          quantity: -2,
          reason: 'invalid_reason_here',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });
});
