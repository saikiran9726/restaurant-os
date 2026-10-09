import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  Permissions,
  updateRestaurantSettingsSchema,
  AppError,
  generateUuidV7,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { restaurantSettings } from '../db/schema/restaurant-settings.js';
import { restaurants } from '../db/schema/restaurants.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  registerRouteGuard({
    method: 'GET',
    url: '/settings',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'PUT',
    url: '/settings',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });

  /**
   * GET /settings - Fetch current restaurant settings & profile
   */
  app.get(
    '/settings',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;

      let [settings] = await db
        .select()
        .from(restaurantSettings)
        .where(eq(restaurantSettings.restaurantId, authUser.restaurantId))
        .limit(1);

      // If not yet initialized, initialize with defaults
      if (!settings) {
        const [restaurant] = await db
          .select()
          .from(restaurants)
          .where(eq(restaurants.id, authUser.restaurantId))
          .limit(1);

        const newSettingsId = generateUuidV7();
        await db.insert(restaurantSettings).values({
          id: newSettingsId,
          restaurantId: authUser.restaurantId,
          name: restaurant?.name || 'Restaurant OS',
          address: '',
          phone: '',
          gstin: null,
          taxMode: 'exclusive',
          defaultGstRateBp: 500,
          serviceChargePercent: '0.00',
          billFooter: 'Thank you for dining with us!',
          kitchenLateThresholdMinutes: 15,
          kitchenOverdueThresholdMinutes: 30,
          discountCapOwnerPercent: 100,
          discountCapManagerPercent: 25,
          discountCapCashierPercent: 10,
        });

        [settings] = await db
          .select()
          .from(restaurantSettings)
          .where(eq(restaurantSettings.id, newSettingsId))
          .limit(1);
      }

      return reply.status(200).send({
        ...settings,
        serviceChargePercent: parseFloat(settings!.serviceChargePercent),
      });
    },
  );

  /**
   * PUT /settings - Update restaurant profile, tax parameters, and thresholds
   */
  app.put(
    '/settings',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = updateRestaurantSettingsSchema.parse(request.body);

      const [existing] = await db
        .select()
        .from(restaurantSettings)
        .where(eq(restaurantSettings.restaurantId, authUser.restaurantId))
        .limit(1);

      const updateValues = {
        name: body.name,
        address: body.address,
        phone: body.phone,
        gstin: body.gstin || null,
        taxMode: body.taxMode,
        defaultGstRateBp: body.defaultGstRateBp,
        serviceChargePercent: body.serviceChargePercent.toFixed(2),
        billFooter: body.billFooter,
        kitchenLateThresholdMinutes: body.kitchenLateThresholdMinutes,
        kitchenOverdueThresholdMinutes: body.kitchenOverdueThresholdMinutes,
        discountCapOwnerPercent: body.discountCapOwnerPercent,
        discountCapManagerPercent: body.discountCapManagerPercent,
        discountCapCashierPercent: body.discountCapCashierPercent,
        upiVpa: body.upiVpa || null,
        upiPayeeName: body.upiPayeeName || null,
        receiptHeaderLines: body.receiptHeaderLines ?? existing?.receiptHeaderLines ?? [],
        receiptFooterLines: body.receiptFooterLines ?? existing?.receiptFooterLines ?? [],
        receiptShowGstin: body.receiptShowGstin ?? existing?.receiptShowGstin ?? true,
        receiptShowCustomer: body.receiptShowCustomer ?? existing?.receiptShowCustomer ?? true,
        receiptShowItemNotes: body.receiptShowItemNotes ?? existing?.receiptShowItemNotes ?? false,
        receiptShowServiceCharge:
          body.receiptShowServiceCharge ?? existing?.receiptShowServiceCharge ?? true,
        receiptShowQr: body.receiptShowQr ?? existing?.receiptShowQr ?? true,
        rupeeSymbolMode: body.rupeeSymbolMode ?? existing?.rupeeSymbolMode ?? 'text_rs',
        updatedAt: new Date(),
      };

      let updatedId = existing?.id;

      if (!existing) {
        updatedId = generateUuidV7();
        await db.insert(restaurantSettings).values({
          id: updatedId,
          restaurantId: authUser.restaurantId,
          ...updateValues,
        });
      } else {
        await db
          .update(restaurantSettings)
          .set(updateValues)
          .where(eq(restaurantSettings.id, existing.id));
      }

      // Also keep restaurant root table name synchronized
      await db
        .update(restaurants)
        .set({ name: body.name, updatedAt: new Date() })
        .where(eq(restaurants.id, authUser.restaurantId));

      // Audit log for tax, thresholds, profile, and UPI VPA change
      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'settings.update',
        entity: 'restaurant_settings',
        entityId: updatedId!,
        before: existing
          ? {
              name: existing.name,
              taxMode: existing.taxMode,
              defaultGstRateBp: existing.defaultGstRateBp,
              serviceChargePercent: existing.serviceChargePercent,
              upiVpa: existing.upiVpa,
              upiPayeeName: existing.upiPayeeName,
            }
          : null,
        after: {
          name: body.name,
          taxMode: body.taxMode,
          defaultGstRateBp: body.defaultGstRateBp,
          serviceChargePercent: body.serviceChargePercent,
          upiVpa: body.upiVpa || null,
          upiPayeeName: body.upiPayeeName || null,
        },
        request,
      });

      const [final] = await db
        .select()
        .from(restaurantSettings)
        .where(eq(restaurantSettings.id, updatedId!))
        .limit(1);

      return reply.status(200).send({
        ...final,
        serviceChargePercent: parseFloat(final!.serviceChargePercent),
      });
    },
  );
}
