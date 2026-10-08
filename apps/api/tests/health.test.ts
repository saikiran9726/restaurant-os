import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import * as dbModule from '../src/db/client.js';

describe('API Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('returns 200 with status ok and db connected when DB is reachable', async () => {
      vi.spyOn(dbModule, 'checkDatabaseConnection').mockResolvedValueOnce(true);

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.status).toBe('ok');
      expect(json.db).toBe('connected');
      expect(json.timestamp).toBeDefined();
      expect(typeof json.uptime).toBe('number');
    });

    it('returns 503 when DB connection fails', async () => {
      vi.spyOn(dbModule, 'checkDatabaseConnection').mockResolvedValueOnce(false);

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(503);
      const json = response.json();
      expect(json.status).toBe('error');
      expect(json.db).toBe('disconnected');
    });
  });

  describe('GET /version', () => {
    it('returns version and environment details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/version',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.name).toBe('@restaurant-os/api');
      expect(json.version).toBe('0.1.0');
      expect(json.environment).toBeDefined();
    });
  });

  describe('Request ID & Central Error Handler', () => {
    it('generates a request id header if not provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/version',
      });

      const reqId = response.headers['x-request-id'];
      expect(reqId).toBeDefined();
      expect(typeof reqId).toBe('string');
    });

    it('propagates custom X-Request-ID header', async () => {
      const customId = 'custom-req-id-12345';
      const response = await app.inject({
        method: 'GET',
        url: '/version',
        headers: {
          'x-request-id': customId,
        },
      });

      expect(response.headers['x-request-id']).toBe(customId);
    });

    it('formats unhandled not found route through error response structure', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent-endpoint',
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.error).toBeDefined();
      expect(json.error.requestId).toBeDefined();
    });
  });
});
