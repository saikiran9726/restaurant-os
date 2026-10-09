import type { FastifyInstance } from 'fastify';
import { eq, and, asc } from 'drizzle-orm';
import {
  Permissions,
  createModifierGroupSchema,
  updateModifierGroupSchema,
  AppError,
  generateUuidV7,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { modifierGroups, modifiers } from '../db/schema/modifiers.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';

export async function registerModifiersRoutes(app: FastifyInstance): Promise<void> {
  registerRouteGuard({
    method: 'GET',
    url: '/modifier-groups',
    isPublic: false,
    permission: Permissions.MENU_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/modifier-groups',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/modifier-groups/:id',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'DELETE',
    url: '/modifier-groups/:id',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });

  /**
   * GET /modifier-groups - List modifier groups with nested options
   */
  app.get(
    '/modifier-groups',
    { preHandler: [requirePermission(Permissions.MENU_READ)] },
    async (request, reply) => {
      const authUser = request.user!;

      const groups = await db
        .select()
        .from(modifierGroups)
        .where(eq(modifierGroups.restaurantId, authUser.restaurantId))
        .orderBy(asc(modifierGroups.sortOrder), asc(modifierGroups.name));

      const result = await Promise.all(
        groups.map(async (g) => {
          const options = await db
            .select()
            .from(modifiers)
            .where(eq(modifiers.modifierGroupId, g.id))
            .orderBy(asc(modifiers.sortOrder), asc(modifiers.name));
          return {
            ...g,
            options,
          };
        }),
      );

      return reply.status(200).send(result);
    },
  );

  /**
   * POST /modifier-groups - Create modifier group with options
   */
  app.post(
    '/modifier-groups',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = createModifierGroupSchema.parse(request.body);

      const groupId = generateUuidV7();
      const [createdGroup] = await db
        .insert(modifierGroups)
        .values({
          id: groupId,
          restaurantId: authUser.restaurantId,
          name: body.name,
          description: body.description,
          minSelections: body.minSelections,
          maxSelections: body.maxSelections,
          sortOrder: body.sortOrder,
          active: true,
        })
        .returning();

      // Insert options
      const insertedOptions = [];
      if (body.options && body.options.length > 0) {
        for (let i = 0; i < body.options.length; i++) {
          const opt = body.options[i]!;
          const optId = generateUuidV7();
          const [createdOpt] = await db
            .insert(modifiers)
            .values({
              id: optId,
              modifierGroupId: groupId,
              name: opt.name,
              priceDeltaPaise: opt.priceDeltaPaise,
              sortOrder: opt.sortOrder ?? i,
            })
            .returning();
          insertedOptions.push(createdOpt!);
        }
      }

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'modifier_group.create',
        entity: 'modifier_group',
        entityId: groupId,
        after: body,
        request,
      });

      return reply.status(201).send({
        ...createdGroup,
        options: insertedOptions,
      });
    },
  );

  /**
   * PATCH /modifier-groups/:id - Update group and replace options
   */
  app.patch<{ Params: { id: string } }>(
    '/modifier-groups/:id',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;
      const body = updateModifierGroupSchema.parse(request.body);

      const [target] = await db
        .select()
        .from(modifierGroups)
        .where(
          and(eq(modifierGroups.id, id), eq(modifierGroups.restaurantId, authUser.restaurantId)),
        )
        .limit(1);

      if (!target) {
        throw AppError.notFound('Modifier group not found');
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.minSelections !== undefined) updateData.minSelections = body.minSelections;
      if (body.maxSelections !== undefined) updateData.maxSelections = body.maxSelections;
      if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

      const [updatedGroup] = await db
        .update(modifierGroups)
        .set(updateData)
        .where(eq(modifierGroups.id, target.id))
        .returning();

      // If options passed, replace options
      if (body.options !== undefined) {
        await db.delete(modifiers).where(eq(modifiers.modifierGroupId, target.id));
        for (let i = 0; i < body.options.length; i++) {
          const opt = body.options[i]!;
          await db.insert(modifiers).values({
            id: generateUuidV7(),
            modifierGroupId: target.id,
            name: opt.name,
            priceDeltaPaise: opt.priceDeltaPaise,
            sortOrder: opt.sortOrder ?? i,
          });
        }
      }

      const currentOptions = await db
        .select()
        .from(modifiers)
        .where(eq(modifiers.modifierGroupId, target.id))
        .orderBy(asc(modifiers.sortOrder));

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'modifier_group.update',
        entity: 'modifier_group',
        entityId: target.id,
        before: { name: target.name },
        after: body,
        request,
      });

      return reply.status(200).send({
        ...updatedGroup,
        options: currentOptions,
      });
    },
  );

  /**
   * DELETE /modifier-groups/:id - Deactivate group
   */
  app.delete<{ Params: { id: string } }>(
    '/modifier-groups/:id',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;

      const [target] = await db
        .select()
        .from(modifierGroups)
        .where(
          and(eq(modifierGroups.id, id), eq(modifierGroups.restaurantId, authUser.restaurantId)),
        )
        .limit(1);

      if (!target) {
        throw AppError.notFound('Modifier group not found');
      }

      await db
        .update(modifierGroups)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(modifierGroups.id, target.id));

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'modifier_group.deactivate',
        entity: 'modifier_group',
        entityId: target.id,
        request,
      });

      return reply.status(200).send({ success: true });
    },
  );
}
