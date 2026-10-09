import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Permissions, salesReportFilterSchema } from '@restaurant-os/shared';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { getSalesReport, getItemsReport, getCustomerAnalyticsReport } from '../services/reports.js';

export async function reportsRoutes(app: FastifyInstance) {
  // Register permissions in central registry
  registerRouteGuard({
    method: 'GET',
    url: '/reports/sales',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/reports/items',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/reports/customers',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/reports/insights',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });

  /**
   * GET /reports/sales
   * Sales KPIs, distributions, and deterministic insights.
   */
  app.get(
    '/reports/sales',
    { preHandler: [requirePermission(Permissions.REPORT_READ)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const filter = salesReportFilterSchema.parse(request.query);
      const report = await getSalesReport(authUser.restaurantId, filter);
      return reply.send(report);
    },
  );

  /**
   * GET /reports/items
   * Best sellers & worst performers with min-days-on-menu guard.
   */
  app.get(
    '/reports/items',
    { preHandler: [requirePermission(Permissions.REPORT_READ)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const query = request.query as { startDate?: string; endDate?: string };
      const report = await getItemsReport(authUser.restaurantId, query.startDate, query.endDate);
      return reply.send(report);
    },
  );

  /**
   * GET /reports/customers
   * Customer retention, new vs returning mix, and loyalty usage metrics.
   */
  app.get(
    '/reports/customers',
    { preHandler: [requirePermission(Permissions.REPORT_READ)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const query = request.query as { startDate?: string; endDate?: string };
      const report = await getCustomerAnalyticsReport(
        authUser.restaurantId,
        query.startDate,
        query.endDate,
      );
      return reply.send(report);
    },
  );

  /**
   * GET /reports/insights
   * Standalone list of plain-English verified insights.
   */
  app.get(
    '/reports/insights',
    { preHandler: [requirePermission(Permissions.REPORT_READ)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const filter = salesReportFilterSchema.parse(request.query);
      const report = await getSalesReport(authUser.restaurantId, filter);
      return reply.send({ insights: report.insights });
    },
  );
}
