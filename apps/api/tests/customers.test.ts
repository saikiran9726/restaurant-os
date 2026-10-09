import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { generateUuidV7, Roles, ROLE_DEFAULT_PERMISSIONS } from '@restaurant-os/shared';

describe('Customer Identification & Segmentation Security Tests', () => {
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

  describe('RBAC Route Isolation', () => {
    it('blocks kitchen staff from customer lookup', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/customers/lookup?phone=9876543210',
        headers: { authorization: `Bearer ${kitchenToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('blocks kitchen staff from creating customers', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/customers',
        headers: { authorization: `Bearer ${kitchenToken}` },
        payload: {
          phone: '9876543210',
          name: 'Test Customer',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('blocks waiter from viewing owner customer analytics list (requires customer.manage)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/customers',
        headers: { authorization: `Bearer ${waiterToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('blocks waiter from viewing customer full detail profile (requires customer.manage)', async () => {
      const customerId = generateUuidV7();
      const res = await app.inject({
        method: 'GET',
        url: `/customers/${customerId}`,
        headers: { authorization: `Bearer ${waiterToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('blocks waiter from deleting/anonymizing customer (requires customer.manage)', async () => {
      const customerId = generateUuidV7();
      const res = await app.inject({
        method: 'DELETE',
        url: `/customers/${customerId}`,
        headers: { authorization: `Bearer ${waiterToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('allows waiter to lookup customer and attach to order (passes RBAC guard)', async () => {
      const resLookup = await app.inject({
        method: 'GET',
        url: '/customers/lookup?phone=9876543210',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(resLookup.statusCode).not.toBe(401);
      expect(resLookup.statusCode).not.toBe(403);

      const orderId = generateUuidV7();
      const resAttach = await app.inject({
        method: 'PATCH',
        url: `/orders/${orderId}/customer`,
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: { customerId: null },
      });
      expect(resAttach.statusCode).not.toBe(401);
      expect(resAttach.statusCode).not.toBe(403);
    });

    it('allows owner to access customer analytics list (passes RBAC guard)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/customers',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('Validation & Payload Constraints', () => {
    it('rejects customer creation with invalid phone number format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/customers',
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          phone: '12345', // Invalid
          name: 'Short Phone',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects order customer attach with invalid UUID format', async () => {
      const orderId = generateUuidV7();
      const res = await app.inject({
        method: 'PATCH',
        url: `/orders/${orderId}/customer`,
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          customerId: 'not-a-valid-uuid',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });
});
