import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import {
  Permissions,
  createPrinterSchema,
  updatePrinterSchema,
  buildReceiptEscPos,
  formatReceiptPlainText,
  AppError,
  generateUuidV7,
  type ReceiptData,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { printerConfigurations, printEvents } from '../db/schema/printers.js';
import { restaurantSettings } from '../db/schema/restaurant-settings.js';
import { restaurants } from '../db/schema/restaurants.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';

export async function registerPrinterRoutes(app: FastifyInstance): Promise<void> {
  // Route Guards
  registerRouteGuard({
    method: 'GET',
    url: '/printers',
    isPublic: false,
    permission: Permissions.BILL_READ, // Staff can read available printers to assign device printer
  });
  registerRouteGuard({
    method: 'POST',
    url: '/printers',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/printers/:id',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'DELETE',
    url: '/printers/:id',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/printers/:id/test',
    isPublic: false,
    permission: Permissions.SETTINGS_MANAGE,
  });

  /**
   * GET /printers - List active printers for the restaurant
   */
  app.get(
    '/printers',
    { preHandler: [requirePermission(Permissions.BILL_READ)] },
    async (request, reply) => {
      const authUser = request.user!;

      const list = await db
        .select()
        .from(printerConfigurations)
        .where(
          and(
            eq(printerConfigurations.restaurantId, authUser.restaurantId),
            eq(printerConfigurations.active, true),
          ),
        );

      return reply.status(200).send(list);
    },
  );

  /**
   * POST /printers - Create new printer configuration
   */
  app.post(
    '/printers',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = createPrinterSchema.parse(request.body);

      const id = generateUuidV7();

      // If set as default, unset other defaults in the restaurant
      if (body.isDefault) {
        await db
          .update(printerConfigurations)
          .set({ isDefault: false })
          .where(eq(printerConfigurations.restaurantId, authUser.restaurantId));
      }

      const [created] = await db
        .insert(printerConfigurations)
        .values({
          id,
          restaurantId: authUser.restaurantId,
          name: body.name,
          transport: body.transport,
          address: body.address || '',
          widthMm: body.widthMm,
          codepage: body.codepage,
          charsPerLine: body.charsPerLine ?? (body.widthMm === 58 ? 32 : 48),
          autoCut: body.autoCut,
          drawerPulse: body.drawerPulse,
          isDefault: body.isDefault,
          active: body.active,
        })
        .returning();

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'printer.create',
        entity: 'printer_configurations',
        entityId: id,
        before: null,
        after: created,
        request,
      });

      return reply.status(201).send(created);
    },
  );

  /**
   * PATCH /printers/:id - Update printer configuration
   */
  app.patch(
    '/printers/:id',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params as { id: string };
      const body = updatePrinterSchema.parse(request.body);

      const [existing] = await db
        .select()
        .from(printerConfigurations)
        .where(
          and(
            eq(printerConfigurations.id, id),
            eq(printerConfigurations.restaurantId, authUser.restaurantId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw AppError.notFound('Printer configuration not found');
      }

      if (body.isDefault) {
        await db
          .update(printerConfigurations)
          .set({ isDefault: false })
          .where(eq(printerConfigurations.restaurantId, authUser.restaurantId));
      }

      const updateData: Partial<typeof printerConfigurations.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.transport !== undefined) updateData.transport = body.transport;
      if (body.address !== undefined) updateData.address = body.address;
      if (body.widthMm !== undefined) updateData.widthMm = body.widthMm;
      if (body.codepage !== undefined) updateData.codepage = body.codepage;
      if (body.charsPerLine !== undefined) updateData.charsPerLine = body.charsPerLine;
      if (body.autoCut !== undefined) updateData.autoCut = body.autoCut;
      if (body.drawerPulse !== undefined) updateData.drawerPulse = body.drawerPulse;
      if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
      if (body.active !== undefined) updateData.active = body.active;

      const [updated] = await db
        .update(printerConfigurations)
        .set(updateData)
        .where(eq(printerConfigurations.id, id))
        .returning();

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'printer.update',
        entity: 'printer_configurations',
        entityId: id,
        before: existing,
        after: updated,
        request,
      });

      return reply.status(200).send(updated);
    },
  );

  /**
   * DELETE /printers/:id - Deactivate printer
   */
  app.delete(
    '/printers/:id',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params as { id: string };

      const [existing] = await db
        .select()
        .from(printerConfigurations)
        .where(
          and(
            eq(printerConfigurations.id, id),
            eq(printerConfigurations.restaurantId, authUser.restaurantId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw AppError.notFound('Printer configuration not found');
      }

      const [updated] = await db
        .update(printerConfigurations)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(printerConfigurations.id, id))
        .returning();

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'printer.delete',
        entity: 'printer_configurations',
        entityId: id,
        before: existing,
        after: updated,
        request,
      });

      return reply.status(200).send({ success: true, message: 'Printer deactivated' });
    },
  );

  /**
   * POST /printers/:id/test - Generate sample receipt and ESC/POS payload for testing printer
   */
  app.post(
    '/printers/:id/test',
    { preHandler: [requirePermission(Permissions.SETTINGS_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params as { id: string };

      const [printer] = await db
        .select()
        .from(printerConfigurations)
        .where(
          and(
            eq(printerConfigurations.id, id),
            eq(printerConfigurations.restaurantId, authUser.restaurantId),
          ),
        )
        .limit(1);

      if (!printer) {
        throw AppError.notFound('Printer configuration not found');
      }

      const [restaurant] = await db
        .select()
        .from(restaurants)
        .where(eq(restaurants.id, authUser.restaurantId))
        .limit(1);

      const [settings] = await db
        .select()
        .from(restaurantSettings)
        .where(eq(restaurantSettings.restaurantId, authUser.restaurantId))
        .limit(1);

      const testReceipt: ReceiptData = {
        restaurantName: settings?.name || restaurant?.name || 'Restaurant OS',
        restaurantAddress: settings?.address || '123 Market Street',
        restaurantPhone: settings?.phone || '9999999999',
        restaurantGstin: settings?.gstin || '29ABCDE1234F1Z5',
        billNumber: 'TEST-001',
        orderType: 'dine_in',
        tableName: 'TEST TABLE',
        waiterName: 'Admin',
        date: new Date(),
        lines: [
          {
            name: 'Test Filter Coffee',
            qty: 1,
            pricePaise: 4000,
            totalPaise: 4000,
          },
          {
            name: 'Test Masala Dosa',
            qty: 1,
            pricePaise: 9000,
            totalPaise: 9000,
          },
        ],
        subtotalPaise: 13000,
        discountPaise: 0,
        serviceChargePaise: 0,
        cgstPaise: 325,
        sgstPaise: 325,
        roundOffPaise: -50,
        totalPaise: 13600,
        paidPaise: 0,
        balanceDuePaise: 13600,
        upiQrPayload: settings?.upiVpa
          ? `upi://pay?pa=${encodeURIComponent(settings.upiVpa)}&pn=${encodeURIComponent(settings.upiPayeeName || settings.name)}&am=136.00&cu=INR&tn=TEST-001`
          : undefined,
      };

      const plainText = formatReceiptPlainText(testReceipt, {
        widthMm: printer.widthMm as 58 | 80,
        charsPerLine: printer.charsPerLine,
        rupeeMode: (settings?.rupeeSymbolMode as 'text_rs' | 'symbol' | 'image') || 'text_rs',
      });

      const escposBytes = buildReceiptEscPos(testReceipt, {
        widthMm: printer.widthMm as 58 | 80,
        charsPerLine: printer.charsPerLine,
        autoCut: printer.autoCut,
        drawerPulse: printer.drawerPulse,
        rupeeMode: (settings?.rupeeSymbolMode as 'text_rs' | 'symbol' | 'image') || 'text_rs',
      });

      // Convert Uint8Array to base64
      let binary = '';
      for (let i = 0; i < escposBytes.byteLength; i++) {
        binary += String.fromCharCode(escposBytes[i]!);
      }
      const escposBase64 = Buffer.from(escposBytes).toString('base64');

      return reply.status(200).send({
        printer,
        plainText,
        escposBase64,
        byteCount: escposBytes.length,
      });
    },
  );
}
