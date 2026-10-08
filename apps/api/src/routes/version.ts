import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';

export async function registerVersionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/version', async (_req, reply) => {
    return reply.status(200).send({
      name: '@restaurant-os/api',
      version: '0.1.0',
      environment: env.NODE_ENV,
      uptime: process.uptime(),
    });
  });
}
