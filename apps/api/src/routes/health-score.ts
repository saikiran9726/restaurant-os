import type { FastifyInstance, FastifyRequest } from 'fastify';
import { HealthService } from '../services/health.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';
import {
  Permissions,
  Roles,
  AppError,
  updateHealthModelSchema,
  recomputeHealthScoreSchema,
} from '@restaurant-os/shared';

export async function healthScoreRoutes(app: FastifyInstance): Promise<void> {
  // Register permissions in central route registry for automated audits
  registerRouteGuard({
    method: 'GET',
    url: '/health-score',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/health-score/history',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/health-score/model',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'PUT',
    url: '/health-score/model',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/health-score/recompute',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });

  // Middleware ensuring user has the OWNER role
  const requireOwnerOnly = async (request: FastifyRequest) => {
    if (request.user?.role !== Roles.OWNER) {
      throw AppError.forbidden('Only restaurant owners can access the Restaurant Health Score');
    }
  };

  /**
   * GET /health-score
   * Returns current health score, factors breakdown, reasons for change, and suggestions.
   */
  app.get(
    '/health-score',
    { preHandler: [requirePermission(Permissions.REPORT_READ), requireOwnerOnly] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const health = await HealthService.getLatestScore(restaurantId);
      return health;
    },
  );

  /**
   * GET /health-score/history
   * Returns chronological health score snapshots (last 12).
   */
  app.get(
    '/health-score/history',
    { preHandler: [requirePermission(Permissions.REPORT_READ), requireOwnerOnly] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 12;

      const history = await HealthService.getHistory(restaurantId, limit);
      return { history };
    },
  );

  /**
   * GET /health-score/model
   * Returns current active scoring model (version, weights, targets, windowDays).
   */
  app.get(
    '/health-score/model',
    { preHandler: [requirePermission(Permissions.REPORT_READ), requireOwnerOnly] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const model = await HealthService.getModel(restaurantId);
      return { model };
    },
  );

  /**
   * PUT /health-score/model
   * Updates scoring model weights and targets (creates new incremented model version).
   */
  app.put(
    '/health-score/model',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE), requireOwnerOnly] },
    async (request: FastifyRequest) => {
      const { restaurantId, userId } = request.user!;
      const body = updateHealthModelSchema.parse(request.body);

      const updatedModel = await HealthService.updateModel(restaurantId, userId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'health_model.updated',
        entity: 'health_model',
        entityId: updatedModel.id,
        after: updatedModel as any,
        request,
      });

      return { model: updatedModel };
    },
  );

  /**
   * POST /health-score/recompute
   * Recomputes the health score on demand and saves a new snapshot.
   */
  app.post(
    '/health-score/recompute',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE), requireOwnerOnly] },
    async (request: FastifyRequest) => {
      const { restaurantId, userId } = request.user!;
      const body = recomputeHealthScoreSchema.parse(request.body || {});

      const result = await HealthService.recomputeScore(restaurantId, body.date);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'health_score.recomputed',
        entity: 'health_snapshot',
        entityId: result.snapshotId,
        after: {
          overallScore: result.overallScore,
          scoreBand: result.scoreBand,
          confidence: result.confidence,
        } as any,
        request,
      });

      return result;
    },
  );
}
