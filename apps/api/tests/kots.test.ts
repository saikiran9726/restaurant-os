import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { io as ClientIO } from 'socket.io-client';
import {
  generateUuidV7,
  Roles,
  ROLE_DEFAULT_PERMISSIONS,
  serializeKitchenState,
} from '@restaurant-os/shared';

describe('KOT Workflow & Realtime Layer', () => {
  let app: FastifyInstance;
  let serverAddress: string;
  let serverPort: number;
  const testRestaurantId = '018f9e1e-2895-7800-9831-000000000000';

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
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address() as any;
    serverPort = addr.port;
    serverAddress = `http://127.0.0.1:${serverPort}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Kitchen Serializer Sanitization', () => {
    it('never contains price, tax or customer fields', () => {
      const rawKots = [
        {
          id: generateUuidV7(),
          orderId: generateUuidV7(),
          tableLabel: 'T-01',
          kotNumber: 101,
          type: 'new',
          status: 'new',
          createdAt: new Date(),
          items: [
            {
              id: generateUuidV7(),
              orderItemId: generateUuidV7(),
              nameSnapshot: 'Paneer Butter Masala',
              qty: 2,
              action: 'add',
              status: 'pending',
              pricePaiseSnapshot: 32000, // Should be omitted
              taxRateBpSnapshot: 500, // Should be omitted
              customerName: 'Secret Guest', // Should be omitted
            },
          ],
        },
      ];

      const serialized = serializeKitchenState(rawKots);
      const jsonStr = JSON.stringify(serialized);

      expect(jsonStr).not.toContain('32000');
      expect(jsonStr).not.toContain('pricePaiseSnapshot');
      expect(jsonStr).not.toContain('taxRateBpSnapshot');
      expect(jsonStr).not.toContain('Secret Guest');
      expect(serialized.activeKots[0]?.items[0]?.name).toBe('Paneer Butter Masala');
      expect(serialized.activeKots[0]?.items[0]?.qty).toBe(2);
    });
  });

  describe('Role-scoped Socket.IO Authorisation & Realtime Rooms', () => {
    it('allows waiter connection and denies waiter from joining owner room', async () => {
      const waiterSocket = ClientIO(serverAddress, {
        auth: { token: waiterToken },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve, reject) => {
        waiterSocket.on('connect', () => resolve());
        waiterSocket.on('connect_error', (err) => reject(err));
      });

      // Waiter attempts to join owner room
      const res = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
        waiterSocket.emit(
          'join_room',
          `restaurant:${testRestaurantId}:owner`,
          (response: { ok: boolean; error?: string }) => {
            resolve(response);
          },
        );
      });

      expect(res.ok).toBe(false);
      expect(res.error).toContain('Unauthorized');

      waiterSocket.disconnect();
    });

    it('rejects socket handshake without valid token', async () => {
      const invalidSocket = ClientIO(serverAddress, {
        auth: { token: 'invalid.token' },
        transports: ['websocket'],
      });

      const err = await new Promise<Error>((resolve) => {
        invalidSocket.on('connect_error', (error) => resolve(error));
      });

      expect(err.message).toMatch(/authentication/i);
      invalidSocket.disconnect();
    });
  });

  describe('KOT Endpoints Permission Matrix', () => {
    it('WAITER is authorized for GET /kots but KITCHEN receives 403 on POST /orders/:id/kots', async () => {
      const orderId = generateUuidV7();

      // Kitchen tries to create KOT -> 403 Forbidden
      const kitchenCreateRes = await app.inject({
        method: 'POST',
        url: `/orders/${orderId}/kots`,
        headers: { authorization: `Bearer ${kitchenToken}` },
        payload: {},
      });
      expect(kitchenCreateRes.statusCode).toBe(403);

      // Waiter is authorized for GET /kots (not 403, not 401)
      const waiterGetRes = await app.inject({
        method: 'GET',
        url: '/kots',
        headers: { authorization: `Bearer ${waiterToken}` },
      });
      expect(waiterGetRes.statusCode).not.toBe(403);
      expect(waiterGetRes.statusCode).not.toBe(401);
    });

    it('KITCHEN is authorized for PATCH /kot-items/:id/done', async () => {
      const dummyId = generateUuidV7();
      const res = await app.inject({
        method: 'PATCH',
        url: `/kot-items/${dummyId}/done`,
        headers: { authorization: `Bearer ${kitchenToken}` },
      });
      expect(res.statusCode).not.toBe(403);
      expect(res.statusCode).not.toBe(401);
    });

    it('KITCHEN is authorized for POST /menu/:id/oos', async () => {
      const dummyId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/menu/${dummyId}/oos`,
        headers: { authorization: `Bearer ${kitchenToken}` },
        payload: { reason: 'Kitchen out of fresh cream' },
      });
      expect(res.statusCode).not.toBe(403);
      expect(res.statusCode).not.toBe(401);
    });
  });
});
