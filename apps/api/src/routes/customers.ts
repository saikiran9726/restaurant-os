import type { FastifyInstance, FastifyRequest } from 'fastify';
import { eq, and, desc, sql, or, ilike } from 'drizzle-orm';
import {
  Permissions,
  AppError,
  normalizePhoneNumber,
  createCustomerSchema,
  updateCustomerWaiterSchema,
  updateCustomerOwnerSchema,
  attachCustomerToOrderSchema,
  computeCustomerSegment,
  type CustomerSegment,
  type CustomerWaiterSummary,
  type CustomerOwnerDetail,
  generateUuidV7,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { customers } from '../db/schema/customers.js';
import { orders, orderItems } from '../db/schema/orders.js';
import { menuItems } from '../db/schema/menu-items.js';
import { restaurantSettings } from '../db/schema/restaurant-settings.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';

export async function registerCustomerRoutes(app: FastifyInstance): Promise<void> {
  // Register Route Guards
  registerRouteGuard({
    method: 'GET',
    url: '/customers/lookup',
    isPublic: false,
    permission: Permissions.CUSTOMER_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/customers',
    isPublic: false,
    permission: Permissions.CUSTOMER_READ,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/customers/:id',
    isPublic: false,
    permission: Permissions.CUSTOMER_READ,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/orders/:id/customer',
    isPublic: false,
    permission: Permissions.ORDER_UPDATE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/customers',
    isPublic: false,
    permission: Permissions.CUSTOMER_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/customers/:id',
    isPublic: false,
    permission: Permissions.CUSTOMER_MANAGE,
  });
  registerRouteGuard({
    method: 'DELETE',
    url: '/customers/:id',
    isPublic: false,
    permission: Permissions.CUSTOMER_MANAGE,
  });

  /**
   * Helper to fetch top favourite items and last order for a customer.
   */
  async function getCustomerDiningMemory(restaurantId: string, customerId: string) {
    // 1. Top 3 favourite items by ordered quantity
    const favourites = await db
      .select({
        itemId: orderItems.itemId,
        name: orderItems.nameSnapshot,
        count: sql<number>`SUM(${orderItems.qty})::int`,
        pricePaise: orderItems.pricePaiseSnapshot,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          eq(orders.customerId, customerId),
          eq(orderItems.status, 'active'),
        ),
      )
      .groupBy(orderItems.itemId, orderItems.nameSnapshot, orderItems.pricePaiseSnapshot)
      .orderBy(desc(sql`SUM(${orderItems.qty})`))
      .limit(3);

    // 2. Last order items
    const [lastOrderRow] = await db
      .select({ id: orders.id, createdAt: orders.createdAt })
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, restaurantId),
          eq(orders.customerId, customerId),
          eq(orders.status, 'billed'),
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(1);

    let lastOrderItems: any[] | null = null;
    if (lastOrderRow) {
      const items = await db
        .select({
          itemId: orderItems.itemId,
          name: orderItems.nameSnapshot,
          qty: orderItems.qty,
          pricePaise: orderItems.pricePaiseSnapshot,
          modifiers: orderItems.modifiers,
          note: orderItems.note,
        })
        .from(orderItems)
        .where(and(eq(orderItems.orderId, lastOrderRow.id), eq(orderItems.status, 'active')));
      lastOrderItems = items;
    }

    return {
      favouriteItems: favourites.map((f) => ({
        itemId: f.itemId,
        name: f.name,
        count: Number(f.count),
        pricePaise: f.pricePaise,
        isVeg: true,
      })),
      lastOrder: lastOrderItems,
    };
  }

  /**
   * GET /customers/lookup?phone=...
   * Instant phone lookup for Waiter POS & quick customer attach.
   * Rate limited: 60 lookups/min per session to prevent phone-scraping.
   */
  app.get(
    '/customers/lookup',
    {
      preHandler: [requirePermission(Permissions.CUSTOMER_READ)],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply) => {
      const { phone } = request.query as { phone?: string };
      const authUser = request.user!;
      const { restaurantId, permissions } = authUser;

      if (!phone || phone.trim().length < 6) {
        return reply.status(200).send({ customer: null });
      }

      let normalizedPhone: string;
      try {
        normalizedPhone = normalizePhoneNumber(phone);
      } catch {
        return reply.status(200).send({ customer: null });
      }

      const [customer] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.restaurantId, restaurantId), eq(customers.phone, normalizedPhone)))
        .limit(1);

      if (!customer) {
        return reply.status(200).send({ customer: null });
      }

      const { favouriteItems, lastOrder } = await getCustomerDiningMemory(
        restaurantId,
        customer.id,
      );

      // SECURITY: If user is Waiter (does NOT have customer.manage), return stripped waiter summary!
      const canManage = permissions.includes(Permissions.CUSTOMER_MANAGE);
      if (!canManage) {
        const waiterSummary: CustomerWaiterSummary = {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          preferences: (customer.preferences as any) || { tags: [], note: '' },
          favouriteItems,
          lastOrder,
          lastVisitAt: customer.lastVisitAt?.toISOString() || null,
          visitCount: customer.visitCount,
        };
        return reply.status(200).send({ customer: waiterSummary });
      }

      // Owner/Manager gets full profile with segment
      const [settings] = await db
        .select()
        .from(restaurantSettings)
        .where(eq(restaurantSettings.restaurantId, restaurantId))
        .limit(1);

      const segmentSettings = {
        regularMinVisits: settings?.segmentRegularMinVisits ?? 4,
        highValueMinSpentPaise: settings?.segmentHighValueMinSpentPaise ?? 500000,
        inactiveDays: settings?.segmentInactiveDays ?? 45,
      };

      const { segment, reason: segmentReason } = computeCustomerSegment(
        {
          visitCount: customer.visitCount,
          totalSpentPaise: customer.totalSpentPaise,
          lastVisitAt: customer.lastVisitAt,
        },
        segmentSettings,
      );

      const aovPaise =
        customer.visitCount > 0 ? Math.round(customer.totalSpentPaise / customer.visitCount) : 0;

      const ownerDetail: CustomerOwnerDetail = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        birthday: customer.birthday,
        preferences: (customer.preferences as any) || { tags: [], note: '' },
        notes: customer.notes,
        consentRecorded: customer.consentRecorded,
        createdAt: customer.createdAt.toISOString(),
        lastVisitAt: customer.lastVisitAt?.toISOString() || null,
        visitCount: customer.visitCount,
        totalSpentPaise: customer.totalSpentPaise,
        averageOrderValuePaise: aovPaise,
        visitFrequencyDays: null,
        segment,
        segmentReason,
        favouriteItems,
      };

      return reply.status(200).send({ customer: ownerDetail });
    },
  );

  /**
   * POST /customers - Create new customer or return existing on duplicate phone.
   */
  app.post(
    '/customers',
    { preHandler: [requirePermission(Permissions.CUSTOMER_READ)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const { restaurantId, userId, permissions } = authUser;
      const body = createCustomerSchema.parse(request.body);

      const normalizedPhone = normalizePhoneNumber(body.phone);

      // Check if customer already exists for this restaurant
      const [existing] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.restaurantId, restaurantId), eq(customers.phone, normalizedPhone)))
        .limit(1);

      if (existing) {
        // Update name or preferences if provided
        const updateData: any = { updatedAt: new Date() };
        if (body.name && !existing.name) updateData.name = body.name;
        if (body.preferences && body.preferences.tags.length > 0) {
          updateData.preferences = body.preferences;
        }

        const [updated] = await db
          .update(customers)
          .set(updateData)
          .where(eq(customers.id, existing.id))
          .returning();

        const memory = await getCustomerDiningMemory(restaurantId, updated!.id);
        const canManage = permissions.includes(Permissions.CUSTOMER_MANAGE);

        if (!canManage) {
          const waiterSummary: CustomerWaiterSummary = {
            id: updated!.id,
            name: updated!.name,
            phone: updated!.phone,
            preferences: (updated!.preferences as any) || { tags: [], note: '' },
            favouriteItems: memory.favouriteItems,
            lastOrder: memory.lastOrder,
            lastVisitAt: updated!.lastVisitAt?.toISOString() || null,
            visitCount: updated!.visitCount,
          };
          return reply.status(200).send(waiterSummary);
        }

        return reply.status(200).send(updated);
      }

      // Create new customer
      const newId = generateUuidV7();
      const [created] = await db
        .insert(customers)
        .values({
          id: newId,
          restaurantId,
          name: body.name || null,
          phone: normalizedPhone,
          email: body.email || null,
          birthday: body.birthday || null,
          preferences: body.preferences || { tags: [], note: '' },
          notes: body.notes || null,
          consentRecorded: body.consentRecorded ?? true,
        })
        .returning();

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'customer.create',
        entity: 'customer',
        entityId: newId,
        after: { name: created!.name, phone: created!.phone },
        request,
      });

      const canManage = permissions.includes(Permissions.CUSTOMER_MANAGE);
      if (!canManage) {
        const waiterSummary: CustomerWaiterSummary = {
          id: created!.id,
          name: created!.name,
          phone: created!.phone,
          preferences: (created!.preferences as any) || { tags: [], note: '' },
          favouriteItems: [],
          lastOrder: null,
          lastVisitAt: null,
          visitCount: 0,
        };
        return reply.status(201).send(waiterSummary);
      }

      return reply.status(201).send(created);
    },
  );

  /**
   * PATCH /customers/:id - Update customer preferences or profile
   */
  app.patch(
    '/customers/:id',
    { preHandler: [requirePermission(Permissions.CUSTOMER_READ)] },
    async (request: FastifyRequest, reply) => {
      const { id } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, userId, permissions } = authUser;

      const [existing] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, id), eq(customers.restaurantId, restaurantId)))
        .limit(1);

      if (!existing) {
        throw AppError.notFound('Customer not found');
      }

      const canManage = permissions.includes(Permissions.CUSTOMER_MANAGE);
      const updateValues: any = { updatedAt: new Date() };

      if (!canManage) {
        // Waiter role: only name and preferences
        const waiterBody = updateCustomerWaiterSchema.parse(request.body);
        if (waiterBody.name !== undefined) updateValues.name = waiterBody.name;
        if (waiterBody.preferences !== undefined) updateValues.preferences = waiterBody.preferences;
      } else {
        // Owner role: full profile
        const ownerBody = updateCustomerOwnerSchema.parse(request.body);
        if (ownerBody.name !== undefined) updateValues.name = ownerBody.name;
        if (ownerBody.phone) updateValues.phone = normalizePhoneNumber(ownerBody.phone);
        if (ownerBody.email !== undefined) updateValues.email = ownerBody.email || null;
        if (ownerBody.birthday !== undefined) updateValues.birthday = ownerBody.birthday || null;
        if (ownerBody.preferences !== undefined) updateValues.preferences = ownerBody.preferences;
        if (ownerBody.notes !== undefined) updateValues.notes = ownerBody.notes || null;
        if (ownerBody.consentRecorded !== undefined)
          updateValues.consentRecorded = ownerBody.consentRecorded;
      }

      const [updated] = await db
        .update(customers)
        .set(updateValues)
        .where(eq(customers.id, id))
        .returning();

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'customer.update',
        entity: 'customer',
        entityId: id,
        before: existing,
        after: updated,
        request,
      });

      if (!canManage) {
        const memory = await getCustomerDiningMemory(restaurantId, id);
        const summary: CustomerWaiterSummary = {
          id: updated!.id,
          name: updated!.name,
          phone: updated!.phone,
          preferences: (updated!.preferences as any) || { tags: [], note: '' },
          favouriteItems: memory.favouriteItems,
          lastOrder: memory.lastOrder,
          lastVisitAt: updated!.lastVisitAt?.toISOString() || null,
          visitCount: updated!.visitCount,
        };
        return reply.status(200).send(summary);
      }

      return reply.status(200).send(updated);
    },
  );

  /**
   * PATCH /orders/:id/customer - Attach or detach customer from an order
   */
  app.patch(
    '/orders/:id/customer',
    { preHandler: [requirePermission(Permissions.ORDER_UPDATE)] },
    async (request: FastifyRequest, reply) => {
      const { id: orderId } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId } = authUser;
      const body = attachCustomerToOrderSchema.parse(request.body);

      const [order] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.restaurantId, restaurantId)))
        .limit(1);

      if (!order) {
        throw AppError.notFound('Order not found');
      }

      if (body.customerId) {
        const [customer] = await db
          .select()
          .from(customers)
          .where(and(eq(customers.id, body.customerId), eq(customers.restaurantId, restaurantId)))
          .limit(1);

        if (!customer) {
          throw AppError.notFound('Customer not found');
        }
      }

      const [updatedOrder] = await db
        .update(orders)
        .set({
          customerId: body.customerId,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      return reply.status(200).send(updatedOrder);
    },
  );

  /**
   * GET /customers - Owner list with segments and search filters
   */
  app.get(
    '/customers',
    { preHandler: [requirePermission(Permissions.CUSTOMER_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const authUser = request.user!;
      const { restaurantId } = authUser;
      const {
        search,
        segment: targetSegment,
        limit = 50,
        offset = 0,
      } = request.query as {
        search?: string;
        segment?: string;
        limit?: number;
        offset?: number;
      };

      const [settings] = await db
        .select()
        .from(restaurantSettings)
        .where(eq(restaurantSettings.restaurantId, restaurantId))
        .limit(1);

      const segmentSettings = {
        regularMinVisits: settings?.segmentRegularMinVisits ?? 4,
        highValueMinSpentPaise: settings?.segmentHighValueMinSpentPaise ?? 500000,
        inactiveDays: settings?.segmentInactiveDays ?? 45,
      };

      const conditions: any[] = [eq(customers.restaurantId, restaurantId)];

      if (search && search.trim().length > 0) {
        const term = `%${search.trim()}%`;
        conditions.push(or(ilike(customers.name, term), ilike(customers.phone, term)));
      }

      const allList = await db
        .select()
        .from(customers)
        .where(and(...conditions))
        .orderBy(desc(customers.lastVisitAt), desc(customers.createdAt));

      // Classify segments and tally counts
      const counts: Record<string, number> = {
        all: allList.length,
        new: 0,
        returning: 0,
        regular: 0,
        high_value: 0,
        inactive: 0,
        at_risk: 0,
      };

      const classified = allList.map((c) => {
        const seg = computeCustomerSegment(
          {
            visitCount: c.visitCount,
            totalSpentPaise: c.totalSpentPaise,
            lastVisitAt: c.lastVisitAt,
          },
          segmentSettings,
        );

        counts[seg.segment] = (counts[seg.segment] || 0) + 1;

        const aovPaise = c.visitCount > 0 ? Math.round(c.totalSpentPaise / c.visitCount) : 0;

        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          birthday: c.birthday,
          preferences: (c.preferences as any) || { tags: [], note: '' },
          notes: c.notes,
          consentRecorded: c.consentRecorded,
          createdAt: c.createdAt.toISOString(),
          lastVisitAt: c.lastVisitAt?.toISOString() || null,
          visitCount: c.visitCount,
          totalSpentPaise: c.totalSpentPaise,
          averageOrderValuePaise: aovPaise,
          segment: seg.segment as CustomerSegment,
          segmentReason: seg.reason,
        };
      });

      // Filter by segment if specified
      let filtered = classified;
      if (targetSegment && targetSegment !== 'all') {
        filtered = classified.filter((c) => c.segment === targetSegment);
      }

      const paginated = filtered.slice(Number(offset), Number(offset) + Number(limit));

      return reply.status(200).send({
        customers: paginated,
        total: filtered.length,
        counts,
        preferenceTags: settings?.customerPreferenceTags || [
          'Less spicy',
          'Extra spicy',
          'No onion',
          'No garlic',
          'Jain',
        ],
      });
    },
  );

  /**
   * GET /customers/:id - Owner customer detail view with order history
   */
  app.get(
    '/customers/:id',
    { preHandler: [requirePermission(Permissions.CUSTOMER_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const { id } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId } = authUser;

      const [customer] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, id), eq(customers.restaurantId, restaurantId)))
        .limit(1);

      if (!customer) {
        throw AppError.notFound('Customer not found');
      }

      const { favouriteItems } = await getCustomerDiningMemory(restaurantId, id);

      const [settings] = await db
        .select()
        .from(restaurantSettings)
        .where(eq(restaurantSettings.restaurantId, restaurantId))
        .limit(1);

      const seg = computeCustomerSegment(
        {
          visitCount: customer.visitCount,
          totalSpentPaise: customer.totalSpentPaise,
          lastVisitAt: customer.lastVisitAt,
        },
        {
          regularMinVisits: settings?.segmentRegularMinVisits ?? 4,
          highValueMinSpentPaise: settings?.segmentHighValueMinSpentPaise ?? 500000,
          inactiveDays: settings?.segmentInactiveDays ?? 45,
        },
      );

      const aovPaise =
        customer.visitCount > 0 ? Math.round(customer.totalSpentPaise / customer.visitCount) : 0;

      // Recent orders list
      const customerOrders = await db
        .select({
          id: orders.id,
          createdAt: orders.createdAt,
          type: orders.type,
          status: orders.status,
          totalPaise: orders.totalPaise,
        })
        .from(orders)
        .where(and(eq(orders.restaurantId, restaurantId), eq(orders.customerId, id)))
        .orderBy(desc(orders.createdAt))
        .limit(10);

      const ownerDetail = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        birthday: customer.birthday,
        preferences: (customer.preferences as any) || { tags: [], note: '' },
        notes: customer.notes,
        consentRecorded: customer.consentRecorded,
        createdAt: customer.createdAt.toISOString(),
        lastVisitAt: customer.lastVisitAt?.toISOString() || null,
        visitCount: customer.visitCount,
        totalSpentPaise: customer.totalSpentPaise,
        averageOrderValuePaise: aovPaise,
        segment: seg.segment,
        segmentReason: seg.reason,
        favouriteItems,
        recentOrders: customerOrders,
      };

      return reply.status(200).send(ownerDetail);
    },
  );

  /**
   * DELETE /customers/:id - Anonymize customer (Right to Erasure compliance)
   * Preserves revenue and order history while clearing all identifying data.
   */
  app.delete(
    '/customers/:id',
    { preHandler: [requirePermission(Permissions.CUSTOMER_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const { id } = request.params as { id: string };
      const authUser = request.user!;
      const { restaurantId, userId } = authUser;

      const [existing] = await db
        .select()
        .from(customers)
        .where(and(eq(customers.id, id), eq(customers.restaurantId, restaurantId)))
        .limit(1);

      if (!existing) {
        throw AppError.notFound('Customer not found');
      }

      // Anonymize row
      const anonymizedPhone = `+910000000000_anonymized_${id.slice(0, 8)}`;
      await db
        .update(customers)
        .set({
          name: null,
          phone: anonymizedPhone,
          email: null,
          birthday: null,
          notes: null,
          preferences: { tags: [], note: '' },
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id));

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'customer.anonymize',
        entity: 'customer',
        entityId: id,
        before: { phone: existing.phone, name: existing.name },
        after: { phone: anonymizedPhone, anonymized: true },
        request,
      });

      return reply.status(200).send({
        success: true,
        message: 'Customer anonymized successfully. Identifying details removed.',
      });
    },
  );
}
