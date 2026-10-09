import type { FastifyInstance } from 'fastify';
import { eq, and, asc, sql } from 'drizzle-orm';
import {
  Permissions,
  createMenuCategorySchema,
  updateMenuCategorySchema,
  reorderCategoriesSchema,
  AppError,
  generateUuidV7,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { menuCategories } from '../db/schema/menu-categories.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';

export async function registerCategoryRoutes(app: FastifyInstance): Promise<void> {
  registerRouteGuard({
    method: 'GET',
    url: '/categories',
    isPublic: false,
    permission: Permissions.MENU_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/categories',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/categories/:id',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'PUT',
    url: '/categories/reorder',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'DELETE',
    url: '/categories/:id',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });

  /**
   * GET /categories - List categories
   */
  app.get(
    '/categories',
    { preHandler: [requirePermission(Permissions.MENU_READ)] },
    async (request, reply) => {
      const authUser = request.user!;

      const rows = await db
        .select()
        .from(menuCategories)
        .where(eq(menuCategories.restaurantId, authUser.restaurantId))
        .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));

      return reply.status(200).send(rows);
    },
  );

  /**
   * POST /categories - Add new menu category
   */
  app.post(
    '/categories',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = createMenuCategorySchema.parse(request.body);

      // Check case-insensitive unique category name for active categories
      const [existing] = await db
        .select({ id: menuCategories.id })
        .from(menuCategories)
        .where(
          and(
            eq(menuCategories.restaurantId, authUser.restaurantId),
            sql`lower(${menuCategories.name}) = lower(${body.name})`,
            eq(menuCategories.active, true),
          ),
        )
        .limit(1);

      if (existing) {
        throw AppError.conflict(`Category '${body.name}' already exists.`);
      }

      const id = generateUuidV7();
      const [created] = await db
        .insert(menuCategories)
        .values({
          id,
          restaurantId: authUser.restaurantId,
          name: body.name,
          description: body.description,
          sortOrder: body.sortOrder ?? 0,
          active: body.active ?? true,
        })
        .returning();

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'category.create',
        entity: 'menu_category',
        entityId: created!.id,
        after: body,
        request,
      });

      return reply.status(201).send(created);
    },
  );

  /**
   * PUT /categories/reorder - Batch reorder categories
   */
  app.put(
    '/categories/reorder',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = reorderCategoriesSchema.parse(request.body);

      for (let i = 0; i < body.categoryIds.length; i++) {
        const catId = body.categoryIds[i]!;
        await db
          .update(menuCategories)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(
            and(
              eq(menuCategories.id, catId),
              eq(menuCategories.restaurantId, authUser.restaurantId),
            ),
          );
      }

      return reply.status(200).send({ success: true });
    },
  );

  /**
   * PATCH /categories/:id - Update or hide/rename category
   */
  app.patch<{ Params: { id: string } }>(
    '/categories/:id',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;
      const body = updateMenuCategorySchema.parse(request.body);

      const [target] = await db
        .select()
        .from(menuCategories)
        .where(
          and(eq(menuCategories.id, id), eq(menuCategories.restaurantId, authUser.restaurantId)),
        )
        .limit(1);

      if (!target) {
        throw AppError.notFound('Category not found');
      }

      if (body.name && body.name.toLowerCase() !== target.name.toLowerCase()) {
        const [conflict] = await db
          .select({ id: menuCategories.id })
          .from(menuCategories)
          .where(
            and(
              eq(menuCategories.restaurantId, authUser.restaurantId),
              sql`lower(${menuCategories.name}) = lower(${body.name})`,
              eq(menuCategories.active, true),
            ),
          )
          .limit(1);

        if (conflict && conflict.id !== target.id) {
          throw AppError.conflict(`Category '${body.name}' is already in use.`);
        }
      }

      const [updated] = await db
        .update(menuCategories)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(menuCategories.id, target.id))
        .returning();

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'category.update',
        entity: 'menu_category',
        entityId: target.id,
        before: { name: target.name, active: target.active },
        after: body,
        request,
      });

      return reply.status(200).send(updated);
    },
  );

  /**
   * DELETE /categories/:id - Deactivate category
   */
  app.delete<{ Params: { id: string } }>(
    '/categories/:id',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;

      const [target] = await db
        .select()
        .from(menuCategories)
        .where(
          and(eq(menuCategories.id, id), eq(menuCategories.restaurantId, authUser.restaurantId)),
        )
        .limit(1);

      if (!target) {
        throw AppError.notFound('Category not found');
      }

      await db
        .update(menuCategories)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(menuCategories.id, target.id));

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'category.deactivate',
        entity: 'menu_category',
        entityId: target.id,
        request,
      });

      return reply.status(200).send({ success: true });
    },
  );
}
