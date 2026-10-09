import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { generateUuidV7, Roles, ROLE_DEFAULT_PERMISSIONS } from '@restaurant-os/shared';

describe('Printing & Dynamic UPI Architecture Integration Tests', () => {
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

  describe('RBAC Route Guards for Printers & Printing', () => {
    it('blocks waiter from creating a printer (requires settings.manage)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/printers',
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          name: 'Counter 80mm',
          transport: 'lan',
          address: '192.168.1.100:9100',
          widthMm: 80,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('blocks waiter from deleting a printer configuration', async () => {
      const printerId = generateUuidV7();
      const res = await app.inject({
        method: 'DELETE',
        url: `/printers/${printerId}`,
        headers: { authorization: `Bearer ${waiterToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('allows waiter to list printers (to select local printer on device)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/printers',
        headers: { authorization: `Bearer ${waiterToken}` },
      });

      // RBAC passes: does not return 401 or 403
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it('blocks kitchen from getting bill receipts', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'GET',
        url: `/bills/${billId}/receipt`,
        headers: { authorization: `Bearer ${kitchenToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('blocks kitchen from recording print events', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${billId}/print-events`,
        headers: { authorization: `Bearer ${kitchenToken}` },
        payload: {
          type: 'print',
          result: 'success',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('allows waiter to fetch receipts (passes RBAC guard)', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'GET',
        url: `/bills/${billId}/receipt`,
        headers: { authorization: `Bearer ${waiterToken}` },
      });

      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it('allows waiter to record print events (passes RBAC guard)', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${billId}/print-events`,
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          type: 'print',
          result: 'success',
        },
      });

      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it('allows waiter to create payment requests (passes RBAC guard)', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${billId}/payment-requests`,
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          amountPaise: 5000,
        },
      });

      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('Validation & Payload Constraints', () => {
    it('rejects printer creation with invalid transport', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/printers',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          name: 'Invalid Transport Printer',
          transport: 'infrared',
          widthMm: 80,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects printer creation with invalid width (must be 58 or 80)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/printers',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          name: 'Invalid Width Printer',
          transport: 'lan',
          widthMm: 120,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects print event with invalid event type', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${billId}/print-events`,
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          type: 'fax',
          result: 'success',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects print event with invalid result status', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${billId}/print-events`,
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          type: 'print',
          result: 'uncertain',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });
});
