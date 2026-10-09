import type { FastifyInstance } from 'fastify';
import { eq, and, asc } from 'drizzle-orm';
import {
  Permissions,
  createTableSchema,
  updateTableSchema,
  AppError,
  generateUuidV7,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { tables } from '../db/schema/tables.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';

export async function registerTablesRoutes(app: FastifyInstance): Promise<void> {
  // Public / protected registration in route registry
  registerRouteGuard({
    method: 'GET',
    url: '/tables',
    isPublic: false,
    permission: Permissions.TABLE_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/tables',
    isPublic: false,
    permission: Permissions.TABLE_MANAGE,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/tables/:id',
    isPublic: false,
    permission: Permissions.TABLE_MANAGE,
  });
  registerRouteGuard({
    method: 'DELETE',
    url: '/tables/:id',
    isPublic: false,
    permission: Permissions.TABLE_MANAGE,
  });

  /**
   * GET /tables - List all tables (Waiter & Owner accessible)
   */
  app.get(
    '/tables',
    { preHandler: [requirePermission(Permissions.TABLE_READ)] },
    async (request, reply) => {
      const authUser = request.user!;

      const rows = await db
        .select()
        .from(tables)
        .where(eq(tables.restaurantId, authUser.restaurantId))
        .orderBy(asc(tables.sortOrder), asc(tables.label));

      return reply.status(200).send(rows);
    },
  );

  /**
   * POST /tables - Add a new dining table (Owner/Manager only)
   */
  app.post(
    '/tables',
    { preHandler: [requirePermission(Permissions.TABLE_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = createTableSchema.parse(request.body);

      // Check unique label for active tables
      const [existing] = await db
        .select({ id: tables.id })
        .from(tables)
        .where(
          and(
            eq(tables.restaurantId, authUser.restaurantId),
            eq(tables.label, body.label),
            eq(tables.active, true),
          ),
        )
        .limit(1);

      if (existing) {
        throw AppError.conflict(`Table label '${body.label}' already exists.`);
      }

      const id = generateUuidV7();
      const [created] = await db
        .insert(tables)
        .values({
          id,
          restaurantId: authUser.restaurantId,
          label: body.label,
          capacity: body.capacity,
          section: body.section,
          active: body.active ?? true,
          sortOrder: body.sortOrder ?? 0,
        })
        .returning();

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'table.create',
        entity: 'table',
        entityId: created!.id,
        after: body,
        request,
      });

      return reply.status(201).send(created);
    },
  );

  /**
   * PATCH /tables/:id - Update table (label, capacity, section, active, sortOrder)
   */
  app.patch<{ Params: { id: string } }>(
    '/tables/:id',
    { preHandler: [requirePermission(Permissions.TABLE_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;
      const body = updateTableSchema.parse(request.body);

      const [target] = await db
        .select()
        .from(tables)
        .where(and(eq(tables.id, id), eq(tables.restaurantId, authUser.restaurantId)))
        .limit(1);

      if (!target) {
        throw AppError.notFound('Table not found');
      }

      if (body.label && body.label !== target.label) {
        const [conflict] = await db
          .select({ id: tables.id })
          .from(tables)
          .where(
            and(
              eq(tables.restaurantId, authUser.restaurantId),
              eq(tables.label, body.label),
              eq(tables.active, true),
            ),
          )
          .limit(1);

        if (conflict && conflict.id !== target.id) {
          throw AppError.conflict(`Table label '${body.label}' is already in use.`);
        }
      }

      const [updated] = await db
        .update(tables)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(tables.id, target.id))
        .returning();

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'table.update',
        entity: 'table',
        entityId: target.id,
        before: { label: target.label, capacity: target.capacity, active: target.active },
        after: body,
        request,
      });

      return reply.status(200).send(updated);
    },
  );

  /**
   * DELETE /tables/:id - Deactivate table
   */
  app.delete<{ Params: { id: string } }>(
    '/tables/:id',
    { preHandler: [requirePermission(Permissions.TABLE_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;

      const [target] = await db
        .select()
        .from(tables)
        .where(and(eq(tables.id, id), eq(tables.restaurantId, authUser.restaurantId)))
        .limit(1);

      if (!target) {
        throw AppError.notFound('Table not found');
      }

      await db
        .update(tables)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(tables.id, target.id));

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'table.deactivate',
        entity: 'table',
        entityId: target.id,
        request,
      });

      return reply.status(200).send({ success: true });
    },
  );
}
