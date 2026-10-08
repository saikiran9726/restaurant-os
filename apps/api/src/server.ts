import Fastify, { FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { generateUuidV7 } from '@restaurant-os/shared';
import { env } from './config/env.js';
import { registerCors } from './plugins/cors.js';
import { registerHelmet } from './plugins/helmet.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerVersionRoutes } from './routes/version.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerStaffRoutes } from './routes/staff.js';
import { registerAuditRoutes } from './routes/audit.js';

export async function buildServer(): Promise<FastifyInstance> {
  const isDev = env.NODE_ENV === 'development';
  const isTest = env.NODE_ENV === 'test';

  const app = Fastify({
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      if (typeof header === 'string' && header.trim().length > 0) {
        return header.trim();
      }
      return generateUuidV7();
    },
    requestIdHeader: 'x-request-id',
    logger: isTest
      ? false
      : {
          level: env.LOG_LEVEL,
          transport: isDev
            ? {
                target: 'pino-pretty',
                options: {
                  translateTime: 'HH:MM:ss Z',
                  ignore: 'pid,hostname',
                  colorize: true,
                },
              }
            : undefined,
        },
    trustProxy: true,
  });

  // Track all registered routes in app for security auditing
  const allRoutes: { method: string; url: string }[] = [];
  app.addHook('onRoute', (routeOptions) => {
    const methods = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method];
    for (const m of methods) {
      if (m !== 'HEAD' && m !== 'OPTIONS') {
        allRoutes.push({ method: m, url: routeOptions.url });
      }
    }
  });

  app.decorate('registeredRoutes', allRoutes);

  // Ensure every response carries the Request ID header
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Security & Core Middleware
  await registerCors(app);
  await registerHelmet(app);
  await registerRateLimit(app);

  // Cookie Support
  await app.register(fastifyCookie, {
    secret: env.COOKIE_SECRET,
  });

  // Central Error Handler
  registerErrorHandler(app);

  // Application Routes
  await registerHealthRoutes(app);
  await registerVersionRoutes(app);
  await registerAuthRoutes(app);
  await registerStaffRoutes(app);
  await registerAuditRoutes(app);

  return app;
}
