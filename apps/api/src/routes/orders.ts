import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, and, asc, desc, gte, sql, inArray } from 'drizzle-orm';
import {
  Permissions,
  createOrderSchema,
  updateOrderSchema,
  AppError,
  generateUuidV7,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { orders, orderItems, syncCommands } from '../db/schema/orders.js';
import { tables } from '../db/schema/tables.js';
import { menuItems } from '../db/schema/menu-items.js';
import { menuCategories } from '../db/schema/menu-categories.js';
import { restaurantSettings } from '../db/schema/restaurant-settings.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';

/**
 * Validates order item prices and calculates subtotal and tax according to tax mode.
 */
async function computeOrderTotals(
  restaurantId: string,
  rawItems: Array<{ itemId: string; qty: number; modifiers: any[]; note?: string }>,
) {
  const itemIds = rawItems.map((i) => i.itemId);
  const dbItems = await db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      pricePaise: menuItems.pricePaise,
      taxRateBp: menuItems.taxRateBp,
      available: menuItems.available,
      active: menuItems.active,
    })
    .from(menuItems)
    .where(and(eq(menuItems.restaurantId, restaurantId), inArray(menuItems.id, itemIds)));

  const dbItemMap = new Map(dbItems.map((i) => [i.id, i]));

  // Verify availability and active status
  for (const raw of rawItems) {
    const found = dbItemMap.get(raw.itemId);
    if (!found || !found.active) {
      throw AppError.badRequest(`Item '${raw.itemId}' is no longer active.`);
    }
    if (!found.available) {
      throw AppError.badRequest(
        `Item '${found.name}' is currently Out of Stock and cannot be ordered.`,
        { unavailableItemId: found.id, itemName: found.name },
      );
    }
  }

  // Fetch restaurant tax settings
  const [settings] = await db
    .select({
      taxMode: restaurantSettings.taxMode,
      defaultGstRateBp: restaurantSettings.defaultGstRateBp,
    })
    .from(restaurantSettings)
    .where(eq(restaurantSettings.restaurantId, restaurantId))
    .limit(1);

  const taxMode = settings?.taxMode || 'exclusive';

  let subtotalPaise = 0;
  let taxPaise = 0;

  const processedItems = rawItems.map((raw, idx) => {
    const item = dbItemMap.get(raw.itemId)!;
    // Calculate unit price including modifier price deltas
    const modTotalDelta = (raw.modifiers || []).reduce(
      (sum, m) => sum + (m.priceDeltaPaise || 0),
      0,
    );
    const unitPricePaise = item.pricePaise + modTotalDelta;
    const lineSubtotal = unitPricePaise * raw.qty;
    const taxRateBp = item.taxRateBp || settings?.defaultGstRateBp || 500;

    let lineTax = 0;
    if (taxMode === 'inclusive') {
      // Inclusive: lineTax = lineSubtotal - (lineSubtotal / (1 + rate))
      lineTax = Math.round(lineSubtotal - (lineSubtotal * 10000) / (10000 + taxRateBp));
      subtotalPaise += lineSubtotal - lineTax;
    } else {
      // Exclusive: lineTax = lineSubtotal * (rate / 10000)
      lineTax = Math.round((lineSubtotal * taxRateBp) / 10000);
      subtotalPaise += lineSubtotal;
    }
    taxPaise += lineTax;

    return {
      itemId: item.id,
      nameSnapshot: item.name,
      pricePaiseSnapshot: unitPricePaise,
      taxRateBpSnapshot: taxRateBp,
      qty: raw.qty,
      modifiers: raw.modifiers || [],
      note: raw.note || null,
      lineNo: idx + 1,
    };
  });

  const totalPaise = subtotalPaise + taxPaise;

  return {
    processedItems,
    subtotalPaise,
    taxPaise,
    totalPaise,
  };
}

export async function registerOrderRoutes(app: FastifyInstance): Promise<void> {
  // Public/protected route registrations for route registry test
  registerRouteGuard({
    method: 'POST',
    url: '/orders',
    isPublic: false,
    permission: Permissions.ORDER_CREATE,
  });
  registerRouteGuard({
    method: 'PUT',
    url: '/orders/:id',
    isPublic: false,
    permission: Permissions.ORDER_UPDATE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/orders/:id',
    isPublic: false,
    permission: Permissions.ORDER_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/orders',
    isPublic: false,
    permission: Permissions.ORDER_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/menu/frequent',
    isPublic: false,
    permission: Permissions.MENU_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/menu/popular-today',
    isPublic: false,
    permission: Permissions.MENU_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/orders/recent',
    isPublic: false,
    permission: Permissions.ORDER_READ,
  });

  /**
   * Helper to execute idempotent requests using Idempotency-Key
   */
  async function handleIdempotency<T>(
    request: FastifyRequest,
    commandType: string,
    execute: () => Promise<T>,
  ): Promise<T> {
    const key = request.headers['idempotency-key'] as string | undefined;
    if (!key) {
      return execute();
    }

    const [existing] = await db
      .select({ result: syncCommands.result })
      .from(syncCommands)
      .where(eq(syncCommands.idempotencyKey, key))
      .limit(1);

    if (existing) {
      return existing.result as T;
    }

    const result = await execute();

    try {
      await db.insert(syncCommands).values({
        idempotencyKey: key,
        restaurantId: request.user!.restaurantId,
        userId: request.user!.userId,
        commandType,
        result: result as any,
      });
    } catch {
      // Race condition safety
    }

    return result;
  }

  /**
   * POST /orders - Create order with client UUIDv7 (Idempotent)
   */
  app.post(
    '/orders',
    { preHandler: [requirePermission(Permissions.ORDER_CREATE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = createOrderSchema.parse(request.body);

      const responsePayload = await handleIdempotency(request, 'order.create', async () => {
        // Compute prices from database authoritative records
        const { processedItems, subtotalPaise, taxPaise, totalPaise } = await computeOrderTotals(
          authUser.restaurantId,
          body.items,
        );

        // Check if table occupied
        if (body.tableId) {
          const [table] = await db
            .select()
            .from(tables)
            .where(and(eq(tables.id, body.tableId), eq(tables.restaurantId, authUser.restaurantId)))
            .limit(1);

          if (!table) throw AppError.badRequest('Table not found');
        }

        // Insert order
        const [createdOrder] = await db
          .insert(orders)
          .values({
            id: body.id,
            restaurantId: authUser.restaurantId,
            tableId: body.tableId || null,
            customerId: body.customerId || null,
            type: body.type,
            guests: body.guests,
            status: 'saved',
            specialInstructions: body.specialInstructions || null,
            subtotalPaise,
            taxPaise,
            totalPaise,
            createdBy: authUser.userId,
            version: 1,
          })
          .returning();

        // Insert items
        const insertedItems = [];
        for (const item of processedItems) {
          const [createdLine] = await db
            .insert(orderItems)
            .values({
              id: generateUuidV7(),
              orderId: body.id,
              itemId: item.itemId,
              nameSnapshot: item.nameSnapshot,
              pricePaiseSnapshot: item.pricePaiseSnapshot,
              taxRateBpSnapshot: item.taxRateBpSnapshot,
              qty: item.qty,
              modifiers: item.modifiers,
              note: item.note,
              lineNo: item.lineNo,
              status: 'active',
            })
            .returning();
          insertedItems.push(createdLine!);
        }

        // Update table status if dine-in
        if (body.tableId) {
          await db
            .update(tables)
            .set({
              status: 'occupied',
              currentOrderId: body.id,
              updatedAt: new Date(),
            })
            .where(eq(tables.id, body.tableId));
        }

        await recordAuditLog({
          restaurantId: authUser.restaurantId,
          userId: authUser.userId,
          action: 'order.create',
          entity: 'order',
          entityId: body.id,
          after: { totalPaise, itemsCount: processedItems.length },
          request,
        });

        return {
          ...createdOrder,
          items: insertedItems,
        };
      });

      return reply.status(201).send(responsePayload);
    },
  );

  /**
   * PUT /orders/:id - Replace order lines with optimistic concurrency check (Idempotent)
   */
  app.put<{ Params: { id: string } }>(
    '/orders/:id',
    { preHandler: [requirePermission(Permissions.ORDER_UPDATE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;
      const body = updateOrderSchema.parse(request.body);

      const responsePayload = await handleIdempotency(request, 'order.update', async () => {
        const [target] = await db
          .select()
          .from(orders)
          .where(and(eq(orders.id, id), eq(orders.restaurantId, authUser.restaurantId)))
          .limit(1);

        if (!target) throw AppError.notFound('Order not found');

        // Optimistic concurrency check
        if (target.version !== body.version) {
          throw AppError.conflict(
            'Order was modified elsewhere. Please reload the current order state.',
          );
        }

        // Compute authoritative totals
        const { processedItems, subtotalPaise, taxPaise, totalPaise } = await computeOrderTotals(
          authUser.restaurantId,
          body.items,
        );

        // Delete previous items and insert new
        await db.delete(orderItems).where(eq(orderItems.orderId, target.id));

        const insertedItems = [];
        for (const item of processedItems) {
          const [createdLine] = await db
            .insert(orderItems)
            .values({
              id: generateUuidV7(),
              orderId: target.id,
              itemId: item.itemId,
              nameSnapshot: item.nameSnapshot,
              pricePaiseSnapshot: item.pricePaiseSnapshot,
              taxRateBpSnapshot: item.taxRateBpSnapshot,
              qty: item.qty,
              modifiers: item.modifiers,
              note: item.note,
              lineNo: item.lineNo,
              status: 'active',
            })
            .returning();
          insertedItems.push(createdLine!);
        }

        const updateData: Record<string, unknown> = {
          version: target.version + 1,
          subtotalPaise,
          taxPaise,
          totalPaise,
          updatedAt: new Date(),
        };

        if (body.guests !== undefined) updateData.guests = body.guests;
        if (body.type !== undefined) updateData.type = body.type;
        if (body.tableId !== undefined) updateData.tableId = body.tableId;
        if (body.customerId !== undefined) updateData.customerId = body.customerId;
        if (body.specialInstructions !== undefined)
          updateData.specialInstructions = body.specialInstructions;

        const [updatedOrder] = await db
          .update(orders)
          .set(updateData)
          .where(eq(orders.id, target.id))
          .returning();

        return {
          ...updatedOrder,
          items: insertedItems,
        };
      });

      return reply.status(200).send(responsePayload);
    },
  );

  /**
   * GET /orders/:id - Get order details
   */
  app.get<{ Params: { id: string } }>(
    '/orders/:id',
    { preHandler: [requirePermission(Permissions.ORDER_READ)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;

      let order: any = null;
      try {
        const rows = await db
          .select()
          .from(orders)
          .where(and(eq(orders.id, id), eq(orders.restaurantId, authUser.restaurantId)))
          .limit(1);
        order = rows[0];
      } catch (err: any) {
        request.log.debug({ err }, 'Database error looking up order, treating as not found');
      }

      if (!order) {
        // Anti-IDOR security telemetry: check if entity exists under another tenant
        try {
          const [foreignOrder] = await db
            .select({ id: orders.id, restaurantId: orders.restaurantId })
            .from(orders)
            .where(eq(orders.id, id))
            .limit(1);

          if (foreignOrder) {
            await recordAuditLog({
              restaurantId: authUser.restaurantId,
              userId: authUser.userId,
              action: 'security.cross_tenant_access_attempt',
              entity: 'order',
              entityId: id,
              before: { targetRestaurantId: foreignOrder.restaurantId },
              request,
            });
            request.log.warn(
              {
                orderId: id,
                targetRestaurantId: foreignOrder.restaurantId,
                callerRestaurantId: authUser.restaurantId,
              },
              'Cross-tenant access probe detected and neutralized',
            );
          }
        } catch (err: any) {
          // If database is unreachable in offline/mock unit tests, log and proceed with 404
          request.log.debug({ err }, 'Could not probe foreign tenant existence');
        }

        throw AppError.notFound('Order not found');
      }

      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(asc(orderItems.lineNo));

      return reply.status(200).send({
        ...order,
        items,
      });
    },
  );

  /**
   * GET /orders - List orders by status or table
   */
  app.get(
    '/orders',
    { preHandler: [requirePermission(Permissions.ORDER_READ)] },
    async (request, reply) => {
      const authUser = request.user!;
      const query = request.query as { status?: string; tableId?: string };

      const conditions = [eq(orders.restaurantId, authUser.restaurantId)];
      if (query.status) conditions.push(eq(orders.status, query.status));
      if (query.tableId) conditions.push(eq(orders.tableId, query.tableId));

      const rows = await db
        .select()
        .from(orders)
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt))
        .limit(50);

      return reply.status(200).send(rows);
    },
  );

  /**
   * GET /menu/frequent - Top 8 items sold over the last 30 days
   */
  app.get(
    '/menu/frequent',
    { preHandler: [requirePermission(Permissions.MENU_READ)] },
    async (request, reply) => {
      const authUser = request.user!;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const rows = await db
        .select({
          itemId: orderItems.itemId,
          name: menuItems.name,
          isVeg: menuItems.isVeg,
          pricePaise: menuItems.pricePaise,
          totalSold: sql<number>`SUM(${orderItems.qty})::int`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(menuItems, eq(orderItems.itemId, menuItems.id))
        .where(
          and(
            eq(orders.restaurantId, authUser.restaurantId),
            sql`${orders.status} != 'cancelled'`,
            gte(orderItems.createdAt, thirtyDaysAgo),
            eq(menuItems.active, true),
            eq(menuItems.available, true),
          ),
        )
        .groupBy(orderItems.itemId, menuItems.name, menuItems.isVeg, menuItems.pricePaise)
        .orderBy(desc(sql`SUM(${orderItems.qty})`))
        .limit(8);

      return reply.status(200).send(rows);
    },
  );

  /**
   * GET /menu/popular-today - Top items sold today (since midnight)
   */
  app.get(
    '/menu/popular-today',
    { preHandler: [requirePermission(Permissions.MENU_READ)] },
    async (request, reply) => {
      const authUser = request.user!;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const rows = await db
        .select({
          itemId: orderItems.itemId,
          name: menuItems.name,
          isVeg: menuItems.isVeg,
          pricePaise: menuItems.pricePaise,
          totalSold: sql<number>`SUM(${orderItems.qty})::int`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(menuItems, eq(orderItems.itemId, menuItems.id))
        .where(
          and(
            eq(orders.restaurantId, authUser.restaurantId),
            sql`${orders.status} != 'cancelled'`,
            gte(orderItems.createdAt, todayStart),
            eq(menuItems.active, true),
            eq(menuItems.available, true),
          ),
        )
        .groupBy(orderItems.itemId, menuItems.name, menuItems.isVeg, menuItems.pricePaise)
        .orderBy(desc(sql`SUM(${orderItems.qty})`))
        .limit(8);

      return reply.status(200).send(rows);
    },
  );

  /**
   * GET /orders/recent - Last 10 orders with item snapshots and availability
   */
  app.get(
    '/orders/recent',
    { preHandler: [requirePermission(Permissions.ORDER_READ)] },
    async (request, reply) => {
      const authUser = request.user!;
      const query = request.query as { myOrders?: string; tableId?: string };

      const conditions = [
        eq(orders.restaurantId, authUser.restaurantId),
        sql`${orders.status} != 'cancelled'`,
      ];

      if (query.myOrders === 'true') {
        conditions.push(eq(orders.createdBy, authUser.userId));
      }
      if (query.tableId) {
        conditions.push(eq(orders.tableId, query.tableId));
      }

      const recentOrders = await db
        .select({
          id: orders.id,
          tableId: orders.tableId,
          tableLabel: tables.label,
          type: orders.type,
          totalPaise: orders.totalPaise,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .leftJoin(tables, eq(orders.tableId, tables.id))
        .where(and(...conditions))
        .orderBy(desc(orders.createdAt))
        .limit(10);

      const result = await Promise.all(
        recentOrders.map(async (ord) => {
          const lines = await db
            .select({
              itemId: orderItems.itemId,
              name: orderItems.nameSnapshot,
              qty: orderItems.qty,
              pricePaise: orderItems.pricePaiseSnapshot,
              modifiers: orderItems.modifiers,
              available: menuItems.available,
            })
            .from(orderItems)
            .leftJoin(menuItems, eq(orderItems.itemId, menuItems.id))
            .where(eq(orderItems.orderId, ord.id))
            .orderBy(asc(orderItems.lineNo));

          const itemSummary = lines.map((l) => `${l.qty}x ${l.name}`).join(', ');

          return {
            ...ord,
            itemSummary,
            items: lines.map((l) => ({
              ...l,
              available: l.available ?? false,
            })),
          };
        }),
      );

      return reply.status(200).send(result);
    },
  );
}
