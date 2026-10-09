import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { generateUuidV7, Roles, ROLE_DEFAULT_PERMISSIONS } from '@restaurant-os/shared';

describe('Orders API & Idempotency', () => {
  let app: FastifyInstance;
  const testRestaurantId = '018f9e1e-2895-7800-9831-000000000000';

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

  it('rejects order creation without required items', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${waiterToken}` },
      payload: {
        id: generateUuidV7(),
        type: 'dine_in',
        guests: 2,
        items: [],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBeDefined();
  });

  it('validates UUIDv7 requirement for order ID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${waiterToken}` },
      payload: {
        id: 'not-a-uuid',
        type: 'takeaway',
        guests: 1,
        items: [{ itemId: generateUuidV7(), qty: 1 }],
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
