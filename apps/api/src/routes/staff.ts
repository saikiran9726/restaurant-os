import type { FastifyInstance } from 'fastify';
import { eq, and, ne } from 'drizzle-orm';
import {
  Permissions,
  AppError,
  generateUuidV7,
  staffCreateSchema,
  staffUpdateSchema,
  staffResetCredentialSchema,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { roles } from '../db/schema/roles.js';
import { hashPassword, hashPin } from '../auth/crypto.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';

export async function registerStaffRoutes(app: FastifyInstance): Promise<void> {
  // Register route security guards
  registerRouteGuard({
    method: 'GET',
    url: '/staff',
    isPublic: false,
    permission: Permissions.STAFF_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/staff',
    isPublic: false,
    permission: Permissions.STAFF_MANAGE,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/staff/:id',
    isPublic: false,
    permission: Permissions.STAFF_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/staff/:id/reset-credential',
    isPublic: false,
    permission: Permissions.STAFF_MANAGE,
  });

  /**
   * GET /staff - List all staff in the restaurant
   */
  app.get(
    '/staff',
    { preHandler: [requirePermission(Permissions.STAFF_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;

      const staffList = await db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          roleId: users.roleId,
          roleName: roles.name,
          active: users.active,
          failedAttempts: users.failedAttempts,
          lockedUntil: users.lockedUntil,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.restaurantId, authUser.restaurantId));

      return reply.status(200).send(
        staffList.map((s) => ({
          id: s.id,
          name: s.name,
          username: s.username,
          role: s.roleName ?? 'WAITER',
          active: s.active,
          failedAttempts: s.failedAttempts,
          lockedUntil: s.lockedUntil,
          lastLoginAt: s.lastLoginAt,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
      );
    },
  );

  /**
   * POST /staff - Create new staff member
   */
  app.post(
    '/staff',
    { preHandler: [requirePermission(Permissions.STAFF_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = staffCreateSchema.parse(request.body);

      // Check if username already taken
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, body.username))
        .limit(1);

      if (existing) {
        throw AppError.conflict(`Username '${body.username}' is already taken`);
      }

      // Find role by name
      const [roleRow] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, body.role))
        .limit(1);

      if (!roleRow) {
        throw AppError.badRequest(`Role '${body.role}' not found`);
      }

      // Hash credentials
      let passwordHash: string | null = null;
      let pinHash: string | null = null;

      if (body.credentialType === 'password' && body.password) {
        passwordHash = await hashPassword(body.password);
      } else if (body.credentialType === 'pin' && body.pin) {
        pinHash = await hashPin(body.pin);
      }

      const newUserId = generateUuidV7();

      const [created] = await db
        .insert(users)
        .values({
          id: newUserId,
          restaurantId: authUser.restaurantId,
          roleId: roleRow.id,
          name: body.name,
          username: body.username,
          passwordHash,
          pinHash,
          active: true,
          failedAttempts: 0,
        })
        .returning({
          id: users.id,
          name: users.name,
          username: users.username,
          active: users.active,
          createdAt: users.createdAt,
        });

      if (!created) {
        throw AppError.internal('Failed to create staff member');
      }

      // Audit log
      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'staff.create',
        entity: 'user',
        entityId: created.id,
        after: {
          name: created.name,
          username: created.username,
          role: body.role,
        },
        request,
      });

      return reply.status(201).send({
        id: created.id,
        name: created.name,
        username: created.username,
        role: body.role,
        active: created.active,
        createdAt: created.createdAt,
        // The one-time credential confirmation
        credential: {
          type: body.credentialType,
          value: body.credentialType === 'password' ? body.password : body.pin,
        },
      });
    },
  );

  /**
   * PATCH /staff/:id - Update staff profile, role, or active status
   * Enforces last-owner protection (cannot deactivate or demote the last active owner)
   */
  app.patch<{ Params: { id: string } }>(
    '/staff/:id',
    { preHandler: [requirePermission(Permissions.STAFF_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;
      const body = staffUpdateSchema.parse(request.body);

      // Fetch target user with their current role
      const [targetUser] = await db
        .select({
          id: users.id,
          restaurantId: users.restaurantId,
          roleId: users.roleId,
          name: users.name,
          username: users.username,
          active: users.active,
          roleName: roles.name,
        })
        .from(users)
        .leftJoin(roles, eq(users.roleId, roles.id))
        .where(and(eq(users.id, id), eq(users.restaurantId, authUser.restaurantId)))
        .limit(1);

      if (!targetUser) {
        throw AppError.notFound('Staff member not found');
      }

      // Last-owner check:
      // If target user is an active OWNER, and the update is either deactivating them or changing role away from OWNER
      const isTargetActiveOwner = targetUser.active && targetUser.roleName === 'OWNER';
      const isDeactivating = body.active === false;
      const isChangingRoleAway = body.role && body.role !== 'OWNER';

      if (isTargetActiveOwner && (isDeactivating || isChangingRoleAway)) {
        // Count how many OTHER active owners exist in this restaurant
        const otherActiveOwners = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(roles, eq(users.roleId, roles.id))
          .where(
            and(
              eq(users.restaurantId, authUser.restaurantId),
              eq(roles.name, 'OWNER'),
              eq(users.active, true),
              ne(users.id, targetUser.id),
            ),
          );

        if (otherActiveOwners.length === 0) {
          throw AppError.badRequest(
            'Cannot deactivate or demote the last active owner of the restaurant.',
          );
        }
      }

      // Determine new role ID if role is updating
      let newRoleId = targetUser.roleId;
      if (body.role) {
        const [foundRole] = await db
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.name, body.role))
          .limit(1);

        if (!foundRole) {
          throw AppError.badRequest(`Role '${body.role}' not found`);
        }
        newRoleId = foundRole.id;
      }

      const updateData: {
        name?: string;
        roleId?: string;
        active?: boolean;
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (newRoleId && newRoleId !== targetUser.roleId) updateData.roleId = newRoleId;
      if (body.active !== undefined) updateData.active = body.active;

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, targetUser.id))
        .returning({
          id: users.id,
          name: users.name,
          username: users.username,
          roleId: users.roleId,
          active: users.active,
          updatedAt: users.updatedAt,
        });

      if (!updated) {
        throw AppError.internal('Failed to update staff member');
      }

      // Audit logs
      if (body.active !== undefined && body.active !== targetUser.active) {
        await recordAuditLog({
          restaurantId: authUser.restaurantId,
          userId: authUser.userId,
          action: body.active ? 'staff.reactivate' : 'staff.deactivate',
          entity: 'user',
          entityId: targetUser.id,
          before: { active: targetUser.active },
          after: { active: body.active },
          request,
        });
      }

      if (body.role && body.role !== targetUser.roleName) {
        await recordAuditLog({
          restaurantId: authUser.restaurantId,
          userId: authUser.userId,
          action: 'staff.role_change',
          entity: 'user',
          entityId: targetUser.id,
          before: { role: targetUser.roleName },
          after: { role: body.role },
          request,
        });
      }

      if (body.name && body.name !== targetUser.name) {
        await recordAuditLog({
          restaurantId: authUser.restaurantId,
          userId: authUser.userId,
          action: 'staff.edit',
          entity: 'user',
          entityId: targetUser.id,
          before: { name: targetUser.name },
          after: { name: body.name },
          request,
        });
      }

      return reply.status(200).send({
        id: updated.id,
        name: updated.name,
        username: updated.username,
        role: body.role ?? targetUser.roleName,
        active: updated.active,
        updatedAt: updated.updatedAt,
      });
    },
  );

  /**
   * POST /staff/:id/reset-credential - Reset password or PIN for staff member
   */
  app.post<{ Params: { id: string } }>(
    '/staff/:id/reset-credential',
    { preHandler: [requirePermission(Permissions.STAFF_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;
      const body = staffResetCredentialSchema.parse(request.body);

      const [targetUser] = await db
        .select({
          id: users.id,
          restaurantId: users.restaurantId,
          username: users.username,
        })
        .from(users)
        .where(and(eq(users.id, id), eq(users.restaurantId, authUser.restaurantId)))
        .limit(1);

      if (!targetUser) {
        throw AppError.notFound('Staff member not found');
      }

      // Generate or take credential
      let passwordHash: string | null = null;
      let pinHash: string | null = null;
      let finalCredentialValue = '';

      if (body.credentialType === 'password') {
        finalCredentialValue =
          body.password || `Restro@${Math.floor(100000 + Math.random() * 900000)}`;
        passwordHash = await hashPassword(finalCredentialValue);
      } else {
        finalCredentialValue = body.pin || `${Math.floor(1000 + Math.random() * 9000)}`;
        pinHash = await hashPin(finalCredentialValue);
      }

      await db
        .update(users)
        .set({
          passwordHash: passwordHash ?? undefined,
          pinHash: pinHash ?? undefined,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUser.id));

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'staff.reset_credential',
        entity: 'user',
        entityId: targetUser.id,
        after: { credentialType: body.credentialType },
        request,
      });

      return reply.status(200).send({
        success: true,
        credentialType: body.credentialType,
        credentialValue: finalCredentialValue,
      });
    },
  );
}
