import type { FastifyInstance } from 'fastify';
import { checkDatabaseConnection } from '../db/client.js';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_req, reply) => {
    const isDbConnected = await checkDatabaseConnection();

    const response = {
      status: isDbConnected ? ('ok' as const) : ('error' as const),
      db: isDbConnected ? ('connected' as const) : ('disconnected' as const),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      ...(isDbConnected ? {} : { error: 'Database connection failed' }),
    };

    if (!isDbConnected) {
      return reply.status(503).send(response);
    }

    return reply.status(200).send(response);
  });
}
