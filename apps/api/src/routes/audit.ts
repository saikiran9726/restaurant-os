import type { FastifyInstance } from 'fastify';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { Permissions, auditLogQuerySchema } from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { auditLogs } from '../db/schema/audit-logs.js';
import { users } from '../db/schema/users.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  registerRouteGuard({
    method: 'GET',
    url: '/audit-logs',
    isPublic: false,
    permission: Permissions.AUDIT_READ,
  });

  /**
   * GET /audit-logs - Query audit trail with filters (date range, user, action)
   */
  app.get(
    '/audit-logs',
    { preHandler: [requirePermission(Permissions.AUDIT_READ)] },
    async (request, reply) => {
      const authUser = request.user!;
      const query = auditLogQuerySchema.parse(request.query);

      const conditions = [eq(auditLogs.restaurantId, authUser.restaurantId)];

      if (query.userId) {
        conditions.push(eq(auditLogs.userId, query.userId));
      }

      if (query.action) {
        conditions.push(eq(auditLogs.action, query.action));
      }

      if (query.startDate) {
        conditions.push(gte(auditLogs.createdAt, new Date(query.startDate)));
      }

      if (query.endDate) {
        conditions.push(lte(auditLogs.createdAt, new Date(query.endDate)));
      }

      const rows = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entity: auditLogs.entity,
          entityId: auditLogs.entityId,
          before: auditLogs.before,
          after: auditLogs.after,
          ip: auditLogs.ip,
          device: auditLogs.device,
          createdAt: auditLogs.createdAt,
          userId: auditLogs.userId,
          userName: users.name,
          userUsername: users.username,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(query.limit)
        .offset(query.offset);

      return reply.status(200).send({
        items: rows.map((r) => ({
          id: r.id,
          action: r.action,
          entity: r.entity,
          entityId: r.entityId,
          before: r.before,
          after: r.after,
          ip: r.ip,
          device: r.device,
          createdAt: r.createdAt,
          user: r.userId
            ? {
                id: r.userId,
                name: r.userName,
                username: r.userUsername,
              }
            : null,
        })),
        limit: query.limit,
        offset: query.offset,
      });
    },
  );
}
