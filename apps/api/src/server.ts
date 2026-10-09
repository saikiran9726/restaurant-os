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
import { registerSettingsRoutes } from './routes/settings.js';
import { registerTablesRoutes } from './routes/tables.js';
import { registerCategoryRoutes } from './routes/categories.js';
import { registerModifiersRoutes } from './routes/modifiers.js';
import { registerMenuRoutes } from './routes/menu.js';
import { registerOrderRoutes } from './routes/orders.js';
import { registerKotRoutes } from './routes/kots.js';
import { billsRoutes } from './routes/bills.js';
import { registerPrinterRoutes } from './routes/printers.js';
import { registerCustomerRoutes } from './routes/customers.js';
import { registerLoyaltyRoutes } from './routes/loyalty.js';
import { reportsRoutes } from './routes/reports.js';
import { eodRoutes } from './routes/eod.js';
import { inventoryRoutes } from './routes/inventory.js';
import { expensesRoutes } from './routes/expenses.js';
import { healthScoreRoutes } from './routes/health-score.js';
import { alertsInsightsRoutes } from './routes/alerts-insights.js';
import { syncRoutes } from './routes/sync.js';
import { initRealtimeServer } from './realtime/socket.js';

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
  await registerSettingsRoutes(app);
  await registerTablesRoutes(app);
  await registerCategoryRoutes(app);
  await registerModifiersRoutes(app);
  await registerMenuRoutes(app);
  await registerOrderRoutes(app);
  await registerKotRoutes(app);
  await billsRoutes(app);
  await registerPrinterRoutes(app);
  await registerCustomerRoutes(app);
  await registerLoyaltyRoutes(app);
  await reportsRoutes(app);
  await eodRoutes(app);
  await inventoryRoutes(app);
  await expensesRoutes(app);
  await healthScoreRoutes(app);
  await alertsInsightsRoutes(app);
  await syncRoutes(app);

  // Initialize Realtime Socket.IO Layer
  initRealtimeServer(app);

  return app;
}
