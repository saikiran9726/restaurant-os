import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AlertsInsightsService } from '../services/alerts-insights.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';
import {
  Permissions,
  Roles,
  AppError,
  acknowledgeAlertSchema,
  snoozeAlertSchema,
  dismissAlertSchema,
  dismissInsightSchema,
  updateAlertSettingsSchema,
} from '@restaurant-os/shared';

export async function alertsInsightsRoutes(app: FastifyInstance): Promise<void> {
  // Register route permissions in central registry
  registerRouteGuard({
    method: 'GET',
    url: '/alerts',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/alerts/:id/acknowledge',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/alerts/:id/snooze',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/alerts/:id/dismiss',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/insights',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/insights/:id/dismiss',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/alert-settings',
    isPublic: false,
    permission: Permissions.REPORT_READ,
  });
  registerRouteGuard({
    method: 'PUT',
    url: '/alert-settings',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });

  // Strict guard: Only OWNER or MANAGER can view/manage alerts and insights
  const requireOwnerOrManager = async (request: FastifyRequest) => {
    if (request.user?.role !== Roles.OWNER && request.user?.role !== Roles.MANAGER) {
      throw AppError.forbidden(
        'Only restaurant owners or managers can access Attention Required alerts and insights',
      );
    }
  };

  /**
   * GET /alerts
   * Runs active check & sync, then returns alerts list.
   * Query param: status (open | resolved | snoozed | dismissed)
   */
  app.get(
    '/alerts',
    { preHandler: [requirePermission(Permissions.REPORT_READ), requireOwnerOrManager] },
    async (request) => {
      const restaurantId = request.user!.restaurantId;
      const { status } = (request.query || {}) as {
        status?: 'open' | 'resolved' | 'snoozed' | 'dismissed';
      };

      // Deterministically synchronize live alerts
      await AlertsInsightsService.checkAndSyncAlerts(restaurantId);

      const items = await AlertsInsightsService.listAlerts(restaurantId, status);
      return { success: true, data: items };
    },
  );

  /**
   * POST /alerts/:id/acknowledge
   * Acknowledges cash mismatch or alert with resolution note.
   */
  app.post(
    '/alerts/:id/acknowledge',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE), requireOwnerOrManager] },
    async (request) => {
      const restaurantId = request.user!.restaurantId;
      const { id: alertId } = request.params as { id: string };
      const parsed = acknowledgeAlertSchema.parse(request.body);

      const alert = await AlertsInsightsService.acknowledgeAlert(
        restaurantId,
        alertId,
        request.user!.userId,
        parsed,
      );

      await recordAuditLog({
        restaurantId,
        userId: request.user!.userId,
        action: 'ALERT_ACKNOWLEDGED',
        entity: 'alerts',
        entityId: alertId,
        before: null,
        after: alert as any,
      });

      return { success: true, data: alert };
    },
  );

  /**
   * POST /alerts/:id/snooze
   * Snoozes alert for 1 day or 7 days.
   */
  app.post(
    '/alerts/:id/snooze',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE), requireOwnerOrManager] },
    async (request) => {
      const restaurantId = request.user!.restaurantId;
      const { id: alertId } = request.params as { id: string };
      const parsed = snoozeAlertSchema.parse(request.body);

      const alert = await AlertsInsightsService.snoozeAlert(restaurantId, alertId, parsed);

      await recordAuditLog({
        restaurantId,
        userId: request.user!.userId,
        action: 'ALERT_SNOOZED',
        entity: 'alerts',
        entityId: alertId,
        before: null,
        after: alert as any,
      });

      return { success: true, data: alert };
    },
  );

  /**
   * POST /alerts/:id/dismiss
   * Dismisses alert with reason (fails for cash mismatch).
   */
  app.post(
    '/alerts/:id/dismiss',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE), requireOwnerOrManager] },
    async (request) => {
      const restaurantId = request.user!.restaurantId;
      const { id: alertId } = request.params as { id: string };
      const parsed = dismissAlertSchema.parse(request.body);

      const alert = await AlertsInsightsService.dismissAlert(restaurantId, alertId, parsed);

      await recordAuditLog({
        restaurantId,
        userId: request.user!.userId,
        action: 'ALERT_DISMISSED',
        entity: 'alerts',
        entityId: alertId,
        before: null,
        after: alert as any,
      });

      return { success: true, data: alert };
    },
  );

  /**
   * GET /insights
   * Generates latest business insights and returns them.
   */
  app.get(
    '/insights',
    { preHandler: [requirePermission(Permissions.REPORT_READ), requireOwnerOrManager] },
    async (request: FastifyRequest) => {
      const restaurantId = request.user!.restaurantId;
      const items = await AlertsInsightsService.generateInsights(restaurantId);
      return { success: true, data: items };
    },
  );

  /**
   * POST /insights/:id/dismiss
   * Dismisses an insight from display.
   */
  app.post(
    '/insights/:id/dismiss',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE), requireOwnerOrManager] },
    async (request) => {
      const restaurantId = request.user!.restaurantId;
      const { id: insightId } = request.params as { id: string };
      const parsed = dismissInsightSchema.parse(request.body || {});

      const insight = await AlertsInsightsService.dismissInsight(restaurantId, insightId, parsed);

      return { success: true, data: insight };
    },
  );

  /**
   * GET /alert-settings
   * Fetches alert and insight threshold settings.
   */
  app.get(
    '/alert-settings',
    { preHandler: [requirePermission(Permissions.REPORT_READ), requireOwnerOrManager] },
    async (request: FastifyRequest) => {
      const restaurantId = request.user!.restaurantId;
      const settings = await AlertsInsightsService.getSettings(restaurantId);
      return { success: true, data: settings };
    },
  );

  /**
   * PUT /alert-settings
   * Updates alert and insight thresholds and toggles.
   */
  app.put(
    '/alert-settings',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE), requireOwnerOrManager] },
    async (request: FastifyRequest) => {
      const restaurantId = request.user!.restaurantId;
      const parsed = updateAlertSettingsSchema.parse(request.body);

      const settings = await AlertsInsightsService.updateSettings(restaurantId, parsed);

      await recordAuditLog({
        restaurantId,
        userId: request.user!.userId,
        action: 'ALERT_SETTINGS_UPDATED',
        entity: 'alert_settings',
        entityId: settings.id,
        before: null,
        after: settings as any,
      });

      return { success: true, data: settings };
    },
  );
}
