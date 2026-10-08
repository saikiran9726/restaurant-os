import type { FastifyInstance } from 'fastify';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { loginRequestSchema, AppError } from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { roles } from '../db/schema/roles.js';
import { rolePermissions } from '../db/schema/role-permissions.js';
import { permissions } from '../db/schema/permissions.js';
import { refreshTokens } from '../db/schema/refresh-tokens.js';
import { verifyPassword, verifyPin, generateRandomToken, hashToken } from '../auth/crypto.js';
import { signAccessToken } from '../auth/jwt.js';
import { isAccountLocked, recordFailedAttempt, resetLockout } from '../auth/lockout.js';
import { authenticate, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';
import { env } from '../config/env.js';

const COOKIE_NAME = 'restaurant_os_refresh_token';

export async function getUserPermissions(roleId: string | null): Promise<string[]> {
  if (!roleId) return [];

  const rows = await db
    .select({ name: permissions.name })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId));

  return rows.map((r) => r.name);
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // Register public / protected guards for security registry audits
  registerRouteGuard({ method: 'POST', url: '/auth/login', isPublic: true });
  registerRouteGuard({ method: 'POST', url: '/auth/refresh', isPublic: true });
  registerRouteGuard({ method: 'POST', url: '/auth/logout', isPublic: true });
  registerRouteGuard({ method: 'GET', url: '/me', isPublic: false, permission: 'authenticated' });

  /**
   * POST /auth/login - Authenticate via Password or PIN
   */
  app.post('/auth/login', async (request, reply) => {
    const body = loginRequestSchema.parse(request.body);

    // 1. Fetch user by username
    const [user] = await db
      .select({
        id: users.id,
        restaurantId: users.restaurantId,
        roleId: users.roleId,
        name: users.name,
        username: users.username,
        passwordHash: users.passwordHash,
        pinHash: users.pinHash,
        active: users.active,
        failedAttempts: users.failedAttempts,
        lockedUntil: users.lockedUntil,
      })
      .from(users)
      .where(eq(users.username, body.username))
      .limit(1);

    // Generic error message to prevent user enumeration
    const genericAuthError = () => AppError.unauthorized('Invalid username or credential');

    if (!user || !user.active) {
      // Record failed audit log if user object exists or placeholder
      if (user) {
        await recordAuditLog({
          restaurantId: user.restaurantId,
          userId: user.id,
          action: 'auth.login_failure',
          entity: 'user',
          entityId: user.id,
          request,
        });
      }
      throw genericAuthError();
    }

    // 2. Lockout check
    if (isAccountLocked({ failedAttempts: user.failedAttempts, lockedUntil: user.lockedUntil })) {
      await recordAuditLog({
        restaurantId: user.restaurantId,
        userId: user.id,
        action: 'auth.login_locked',
        entity: 'user',
        entityId: user.id,
        request,
      });
      throw AppError.unauthorized(
        'Account temporarily locked due to too many failed attempts. Please try again later.',
      );
    }

    // 3. Verify credential based on type
    let isValid = false;
    if (body.credentialType === 'password') {
      if (user.passwordHash && body.password) {
        isValid = await verifyPassword(user.passwordHash, body.password);
      }
    } else if (body.credentialType === 'pin') {
      if (user.pinHash && body.pin) {
        isValid = await verifyPin(user.pinHash, body.pin);
      }
    }

    // 4. Handle failure
    if (!isValid) {
      const lockoutState = recordFailedAttempt(user.failedAttempts);
      await db
        .update(users)
        .set({
          failedAttempts: lockoutState.failedAttempts,
          lockedUntil: lockoutState.lockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      await recordAuditLog({
        restaurantId: user.restaurantId,
        userId: user.id,
        action: 'auth.login_failure',
        entity: 'user',
        entityId: user.id,
        request,
      });

      if (lockoutState.lockedUntil) {
        throw AppError.unauthorized(
          'Account temporarily locked due to too many failed attempts. Please try again later.',
        );
      }

      throw genericAuthError();
    }

    // 5. Successful login: reset lockout & record timestamp
    const resetState = resetLockout();
    await db
      .update(users)
      .set({
        failedAttempts: resetState.failedAttempts,
        lockedUntil: resetState.lockedUntil,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // 6. Fetch role and permissions
    let roleName = 'WAITER';
    if (user.roleId) {
      const [roleRow] = await db
        .select({ name: roles.name })
        .from(roles)
        .where(eq(roles.id, user.roleId))
        .limit(1);
      if (roleRow) roleName = roleRow.name;
    }
    const userPermissions = await getUserPermissions(user.roleId);

    // 7. Issue short-lived access token (15 mins)
    const accessToken = signAccessToken({
      userId: user.id,
      restaurantId: user.restaurantId,
      username: user.username,
      name: user.name,
      role: roleName,
      permissions: userPermissions,
    });

    // 8. Issue and rotate refresh token (stored as SHA-256 hash in DB)
    const rawRefreshToken = generateRandomToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash,
      deviceLabel: body.deviceLabel || request.headers['user-agent'] || null,
      expiresAt,
    });

    // Set secure, httpOnly cookie for refresh token
    reply.setCookie(COOKIE_NAME, rawRefreshToken, {
      path: '/auth',
      httpOnly: true,
      secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
    });

    // Record login audit log
    await recordAuditLog({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: 'auth.login_success',
      entity: 'user',
      entityId: user.id,
      request,
    });

    return reply.status(200).send({
      user: {
        id: user.id,
        restaurantId: user.restaurantId,
        name: user.name,
        username: user.username,
        role: roleName,
        active: user.active,
        permissions: userPermissions,
        lastLoginAt: new Date(),
      },
      accessToken,
    });
  });

  /**
   * POST /auth/refresh - Rotate refresh token & issue fresh access token
   */
  app.post('/auth/refresh', async (request, reply) => {
    const rawToken = request.cookies[COOKIE_NAME];
    if (!rawToken) {
      throw AppError.unauthorized('Refresh token missing');
    }

    const hashed = hashToken(rawToken);

    // Find active token
    const [existing] = await db
      .select({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        expiresAt: refreshTokens.expiresAt,
      })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, hashed),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!existing) {
      reply.clearCookie(COOKIE_NAME, { path: '/auth' });
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    // 1. Revoke old refresh token (Token Rotation!)
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, existing.id));

    // 2. Fetch user
    const [user] = await db
      .select({
        id: users.id,
        restaurantId: users.restaurantId,
        roleId: users.roleId,
        name: users.name,
        username: users.username,
        active: users.active,
      })
      .from(users)
      .where(eq(users.id, existing.userId))
      .limit(1);

    if (!user || !user.active) {
      reply.clearCookie(COOKIE_NAME, { path: '/auth' });
      throw AppError.unauthorized('User inactive or not found');
    }

    let roleName = 'WAITER';
    if (user.roleId) {
      const [roleRow] = await db
        .select({ name: roles.name })
        .from(roles)
        .where(eq(roles.id, user.roleId))
        .limit(1);
      if (roleRow) roleName = roleRow.name;
    }
    const userPermissions = await getUserPermissions(user.roleId);

    // 3. Issue new token pair
    const newAccessToken = signAccessToken({
      userId: user.id,
      restaurantId: user.restaurantId,
      username: user.username,
      name: user.name,
      role: roleName,
      permissions: userPermissions,
    });

    const newRawRefreshToken = generateRandomToken();
    const newExpiresAt = new Date(
      Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
    );

    await db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(newRawRefreshToken),
      expiresAt: newExpiresAt,
    });

    reply.setCookie(COOKIE_NAME, newRawRefreshToken, {
      path: '/auth',
      httpOnly: true,
      secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: newExpiresAt,
    });

    return reply.status(200).send({
      accessToken: newAccessToken,
      user: {
        id: user.id,
        restaurantId: user.restaurantId,
        name: user.name,
        username: user.username,
        role: roleName,
        active: user.active,
        permissions: userPermissions,
      },
    });
  });

  /**
   * POST /auth/logout - Revoke refresh token & clear cookie
   */
  app.post('/auth/logout', async (request, reply) => {
    const rawToken = request.cookies[COOKIE_NAME];
    if (rawToken) {
      const hashed = hashToken(rawToken);
      const [tokenRow] = await db
        .select({ id: refreshTokens.id, userId: refreshTokens.userId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hashed))
        .limit(1);

      if (tokenRow) {
        await db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(eq(refreshTokens.id, tokenRow.id));

        const [u] = await db
          .select({ restaurantId: users.restaurantId })
          .from(users)
          .where(eq(users.id, tokenRow.userId))
          .limit(1);

        if (u) {
          await recordAuditLog({
            restaurantId: u.restaurantId,
            userId: tokenRow.userId,
            action: 'auth.logout',
            entity: 'user',
            entityId: tokenRow.userId,
            request,
          });
        }
      }
    }

    reply.clearCookie(COOKIE_NAME, { path: '/auth' });
    return reply.status(200).send({ success: true });
  });

  /**
   * GET /me - Current authenticated user session details
   */
  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    const authUser = request.user!;

    const [user] = await db
      .select({
        id: users.id,
        restaurantId: users.restaurantId,
        name: users.name,
        username: users.username,
        active: users.active,
        roleId: users.roleId,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, authUser.userId))
      .limit(1);

    if (!user || !user.active) {
      throw AppError.unauthorized('User not found or deactivated');
    }

    const currentPermissions = await getUserPermissions(user.roleId);

    return reply.status(200).send({
      id: user.id,
      restaurantId: user.restaurantId,
      name: user.name,
      username: user.username,
      role: authUser.role,
      active: user.active,
      permissions: currentPermissions,
      lastLoginAt: user.lastLoginAt,
    });
  });
}
