import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { registerRouteGuard } from '../auth/middleware.js';

export async function registerVersionRoutes(app: FastifyInstance): Promise<void> {
  registerRouteGuard({ method: 'GET', url: '/version', isPublic: true });

  app.get('/version', async (_req, reply) => {
    return reply.status(200).send({
      name: '@restaurant-os/api',
      version: '0.1.0',
      environment: env.NODE_ENV,
      uptime: process.uptime(),
    });
  });
}
