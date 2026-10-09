import type { FastifyInstance, FastifyRequest } from 'fastify';
import { SyncEngineService } from '../services/sync-engine.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';
import {
  Permissions,
  Roles,
  AppError,
  syncPushBatchSchema,
  registerHubSchema,
  discardDeadLetterSchema,
  resolveConflictSchema,
} from '@restaurant-os/shared';

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  // Register routes with route guards for audits
  registerRouteGuard({
    method: 'POST',
    url: '/sync/push',
    isPublic: false,
    permission: Permissions.ORDER_CREATE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/sync/pull',
    isPublic: false,
    permission: Permissions.ORDER_CREATE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/sync/status',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/sync/hub/register',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/sync/dead-letter',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/sync/dead-letter/:id/discard',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/sync/conflicts',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/sync/conflicts/:id/resolve',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });

  // Guard: Owner or Manager only for dead-letters, hub management, and conflict reviews
  const requireOwnerOrManager = async (request: FastifyRequest) => {
    if (request.user?.role !== Roles.OWNER && request.user?.role !== Roles.MANAGER) {
      throw AppError.forbidden('Only restaurant owners or managers can access sync administration');
    }
  };

  /**
   * POST /sync/push
   * Push a batch of client or Hub commands for execution and sequencing.
   */
  app.post(
    '/sync/push',
    { preHandler: [requirePermission(Permissions.ORDER_CREATE)] },
    async (request: FastifyRequest) => {
      const parsed = syncPushBatchSchema.parse(request.body);
      const res = await SyncEngineService.processPushBatch(parsed);
      return res;
    },
  );

  /**
   * GET /sync/pull
   * Pull event log since a specific sequence number cursor.
   */
  app.get(
    '/sync/pull',
    { preHandler: [requirePermission(Permissions.ORDER_CREATE)] },
    async (request) => {
      const restaurantId = request.user!.restaurantId;
      const query = request.query as { since?: string; limit?: string };
      const sinceSeq = parseInt(query.since || '0', 10);
      const limit = parseInt(query.limit || '100', 10);

      const res = await SyncEngineService.pullEvents(restaurantId, sinceSeq, limit);
      return res;
    },
  );

  /**
   * GET /sync/status
   * Current sync status overview for owner console and connection indicators.
   */
  app.get(
    '/sync/status',
    { preHandler: [requirePermission(Permissions.REPORT_READ), requireOwnerOrManager] },
    async (request: FastifyRequest) => {
      const restaurantId = request.user!.restaurantId;
      const overview = await SyncEngineService.getStatusOverview(restaurantId);
      return { success: true, data: overview };
    },
  );

  /**
   * POST /sync/hub/register
   * Registers a Local Hub for the restaurant.
   */
  app.post(
    '/sync/hub/register',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE), requireOwnerOrManager] },
    async (request: FastifyRequest) => {
      const restaurantId = request.user!.restaurantId;
      const parsed = registerHubSchema.parse(request.body);

      const hub = await SyncEngineService.registerHub(restaurantId, parsed);

      await recordAuditLog({
        restaurantId,
        userId: request.user!.userId,
        action: 'HUB_REGISTERED',
        entity: 'hub_registry',
        entityId: hub.id,
        before: null,
        after: hub as any,
      });

      return { success: true, data: hub };
    },
  );

  /**
   * GET /sync/dead-letter
   * List poison commands in the dead-letter queue.
   */
  app.get(
    '/sync/dead-letter',
    { preHandler: [requirePermission(Permissions.REPORT_READ), requireOwnerOrManager] },
    async (request: FastifyRequest) => {
      const restaurantId = request.user!.restaurantId;
      const items = await SyncEngineService.listDeadLetters(restaurantId);
      return { success: true, data: items };
    },
  );

  /**
   * POST /sync/dead-letter/:id/discard
   * Discards a dead-letter poison command with audited reason.
   */
  app.post(
    '/sync/dead-letter/:id/discard',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE), requireOwnerOrManager] },
    async (request) => {
      const restaurantId = request.user!.restaurantId;
      const { id: deadLetterId } = request.params as { id: string };
      const parsed = discardDeadLetterSchema.parse(request.body);

      const item = await SyncEngineService.discardDeadLetter(
        restaurantId,
        deadLetterId,
        request.user!.userId,
        parsed.reason,
      );

      await recordAuditLog({
        restaurantId,
        userId: request.user!.userId,
        action: 'DEAD_LETTER_DISCARDED',
        entity: 'dead_letter_commands',
        entityId: deadLetterId,
        before: null,
        after: item as any,
      });

      return { success: true, data: item };
    },
  );

  /**
   * GET /sync/conflicts
   * List pending conflict reviews (duplicate payments, table collisions).
   */
  app.get(
    '/sync/conflicts',
    { preHandler: [requirePermission(Permissions.REPORT_READ), requireOwnerOrManager] },
    async (request: FastifyRequest) => {
      const restaurantId = request.user!.restaurantId;
      const items = await SyncEngineService.listConflicts(restaurantId);
      return { success: true, data: items };
    },
  );

  /**
   * POST /sync/conflicts/:id/resolve
   * Resolves a conflict review item with an explanatory note.
   */
  app.post(
    '/sync/conflicts/:id/resolve',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE), requireOwnerOrManager] },
    async (request) => {
      const restaurantId = request.user!.restaurantId;
      const { id: conflictId } = request.params as { id: string };
      const parsed = resolveConflictSchema.parse(request.body);

      const item = await SyncEngineService.resolveConflict(
        restaurantId,
        conflictId,
        request.user!.userId,
        parsed.resolutionNote,
      );

      await recordAuditLog({
        restaurantId,
        userId: request.user!.userId,
        action: 'CONFLICT_RESOLVED',
        entity: 'conflict_reviews',
        entityId: conflictId,
        before: null,
        after: item as any,
      });

      return { success: true, data: item };
    },
  );
}
