import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { ROUTE_REGISTRY } from '../src/auth/middleware.js';

describe('Security Route Registry Audit', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('fails CI if any non-public route lacks a registered permission guard', () => {
    // Get all registered routes captured via onRoute hook
    const fastifyRoutes = (
      app as unknown as { registeredRoutes: { method: string; url: string }[] }
    ).registeredRoutes;

    expect(fastifyRoutes.length).toBeGreaterThan(0);

    const unprotectedRoutes: { method: string; url: string }[] = [];

    for (const route of fastifyRoutes) {
      // Find matching entry in ROUTE_REGISTRY
      const registered = ROUTE_REGISTRY.find(
        (entry) =>
          entry.method.toUpperCase() === route.method.toUpperCase() && entry.url === route.url,
      );

      if (!registered) {
        unprotectedRoutes.push(route);
      } else if (!registered.isPublic && !registered.permission) {
        unprotectedRoutes.push(route);
      }
    }

    if (unprotectedRoutes.length > 0) {
      console.error('CRITICAL SECURITY VIOLATION: Unprotected routes found:', unprotectedRoutes);
    }

    expect(
      unprotectedRoutes,
      `Expected all routes to have a registered permission or be explicitly declared public. Unprotected: ${JSON.stringify(
        unprotectedRoutes,
      )}`,
    ).toEqual([]);
  });
});
