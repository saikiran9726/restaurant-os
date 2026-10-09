import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  Permissions,
  eodCloseDaySchema,
  eodReopenSchema,
  addCashExpenseSchema,
} from '@restaurant-os/shared';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import {
  getEodPreCheckStatus,
  closeBusinessDay,
  reopenBusinessDay,
  addTillExpense,
  getDailySummariesList,
} from '../services/eod.js';

export async function eodRoutes(app: FastifyInstance) {
  // Register permissions in central registry
  registerRouteGuard({
    method: 'GET',
    url: '/day/status',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/day/close',
    isPublic: false,
    permission: Permissions.DAY_CLOSE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/day/reopen',
    isPublic: false,
    permission: Permissions.DAY_CLOSE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/day/summaries',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/day/expenses',
    isPublic: false,
    permission: Permissions.DAY_CLOSE,
  });

  /**
   * GET /day/status - Pre-checks checklist, financial totals, and cash reconciliation status.
   */
  app.get(
    '/day/status',
    { preHandler: [requirePermission(Permissions.REPORT_READ)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const query = request.query as { businessDate?: string };
      const status = await getEodPreCheckStatus(authUser.restaurantId, query.businessDate);
      return reply.send(status);
    },
  );

  /**
   * POST /day/close - Closes and locks the business day.
   */
  app.post(
    '/day/close',
    { preHandler: [requirePermission(Permissions.DAY_CLOSE)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const body = eodCloseDaySchema.parse(request.body);
      const summary = await closeBusinessDay(authUser.restaurantId, authUser.userId, body, request);
      return reply.status(201).send(summary);
    },
  );

  /**
   * POST /day/reopen - Reopens a locked business day using Owner PIN override.
   */
  app.post(
    '/day/reopen',
    { preHandler: [requirePermission(Permissions.DAY_CLOSE)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const body = eodReopenSchema.parse(request.body);
      const summary = await reopenBusinessDay(
        authUser.restaurantId,
        authUser.userId,
        body,
        request,
      );
      return reply.send(summary);
    },
  );

  /**
   * GET /day/summaries - Lists historical closed day summaries.
   */
  app.get(
    '/day/summaries',
    { preHandler: [requirePermission(Permissions.REPORT_READ)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 30;
      const list = await getDailySummariesList(authUser.restaurantId, limit);
      return reply.send({ summaries: list });
    },
  );

  /**
   * POST /day/expenses - Quick till cash expense entry during the shift.
   */
  app.post(
    '/day/expenses',
    { preHandler: [requirePermission(Permissions.DAY_CLOSE)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const body = addCashExpenseSchema.parse(request.body);
      const expense = await addTillExpense(authUser.restaurantId, authUser.userId, body, request);
      return reply.status(201).send(expense);
    },
  );
}
