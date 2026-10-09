import type { FastifyInstance, FastifyRequest } from 'fastify';
import { InventoryService } from '../services/inventory.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';
import {
  Permissions,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  createSupplierSchema,
  updateSupplierSchema,
  createPurchaseSchema,
  updatePurchaseSchema,
  recordUsageSchema,
  recordWasteSchema,
  recordStockCountSchema,
  commitInventoryCsvImportSchema,
} from '@restaurant-os/shared';

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  // Register permissions in central route registry for automated audits
  registerRouteGuard({
    method: 'GET',
    url: '/inventory/items',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/inventory/items',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/inventory/items/:id',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/inventory/items/:id',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/inventory/suppliers',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/inventory/suppliers',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/inventory/purchases',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/inventory/purchases',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/inventory/purchases/:id',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/inventory/usage',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/inventory/waste',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/inventory/stock-count',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/inventory/reorder',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/inventory/import-csv',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/inventory/verify-consistency',
    isPublic: false,
    permission: Permissions.INVENTORY_MANAGE,
  });

  /**
   * GET /inventory/items
   * Lists inventory items with current stock, status chips, and filters.
   */
  app.get(
    '/inventory/items',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const query = request.query as { lowStockOnly?: string; search?: string };

      const items = await InventoryService.listInventoryItems({
        restaurantId,
        lowStockOnly: query.lowStockOnly === 'true',
        search: query.search,
      });

      return { items };
    },
  );

  /**
   * GET /inventory/items/:id
   * Item detail view with recent movement ledger and purchase history.
   */
  app.get(
    '/inventory/items/:id',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const { id } = request.params as { id: string };

      const detail = await InventoryService.getInventoryItemDetail(restaurantId, id);
      return detail;
    },
  );

  /**
   * POST /inventory/items
   * Creates a new inventory item with optional opening stock.
   */
  app.post(
    '/inventory/items',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const { restaurantId, userId } = request.user!;
      const body = createInventoryItemSchema.parse(request.body);

      const item = await InventoryService.createInventoryItem(restaurantId, userId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'inventory.item_created',
        entity: 'inventory_item',
        entityId: item.id,
        after: item as any,
        request,
      });

      return reply.status(201).send({ item });
    },
  );

  /**
   * PATCH /inventory/items/:id
   * Updates an existing inventory item.
   */
  app.patch(
    '/inventory/items/:id',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId, userId } = request.user!;
      const { id } = request.params as { id: string };
      const body = updateInventoryItemSchema.parse(request.body);

      const updated = await InventoryService.updateInventoryItem(restaurantId, id, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'inventory.item_updated',
        entity: 'inventory_item',
        entityId: id,
        after: updated as any,
        request,
      });

      return { item: updated };
    },
  );

  // ===================== SUPPLIERS =====================

  /**
   * GET /inventory/suppliers
   */
  app.get(
    '/inventory/suppliers',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const suppliers = await InventoryService.listSuppliers(restaurantId);
      return { suppliers };
    },
  );

  /**
   * POST /inventory/suppliers
   */
  app.post(
    '/inventory/suppliers',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const { restaurantId, userId } = request.user!;
      const body = createSupplierSchema.parse(request.body);

      const supplier = await InventoryService.createSupplier(restaurantId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'inventory.supplier_created',
        entity: 'supplier',
        entityId: supplier.id,
        after: supplier as any,
        request,
      });

      return reply.status(201).send({ supplier });
    },
  );

  // ===================== PURCHASES =====================

  /**
   * GET /inventory/purchases
   */
  app.get(
    '/inventory/purchases',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const query = request.query as {
        supplierId?: string;
        startDate?: string;
        endDate?: string;
        limit?: string;
      };

      const purchases = await InventoryService.listPurchases({
        restaurantId,
        supplierId: query.supplierId,
        startDate: query.startDate,
        endDate: query.endDate,
        limit: query.limit ? parseInt(query.limit, 10) : 50,
      });

      return { purchases };
    },
  );

  /**
   * POST /inventory/purchases
   * Adds purchase, increments stock, and updates weighted average cost.
   */
  app.post(
    '/inventory/purchases',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const { restaurantId, userId } = request.user!;
      const body = createPurchaseSchema.parse(request.body);

      const purchase = await InventoryService.createPurchase(restaurantId, userId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'inventory.purchase_recorded',
        entity: 'purchase',
        entityId: purchase.id,
        after: purchase as any,
        request,
      });

      return reply.status(201).send({ purchase });
    },
  );

  /**
   * PATCH /inventory/purchases/:id
   * Edit purchase with compensating stock movements and audit tracking.
   */
  app.patch(
    '/inventory/purchases/:id',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId, userId } = request.user!;
      const { id } = request.params as { id: string };
      const body = updatePurchaseSchema.parse(request.body);

      const updated = await InventoryService.updatePurchase(restaurantId, id, userId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'inventory.purchase_updated',
        entity: 'purchase',
        entityId: id,
        after: updated as any,
        request,
      });

      return { purchase: updated };
    },
  );

  // ===================== USAGE & WASTE =====================

  /**
   * POST /inventory/usage
   */
  app.post(
    '/inventory/usage',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const { restaurantId, userId } = request.user!;
      const body = recordUsageSchema.parse(request.body);

      const movement = await InventoryService.recordUsage(restaurantId, userId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'inventory.usage_recorded',
        entity: 'stock_movement',
        entityId: movement.id,
        after: movement as any,
        request,
      });

      return reply.status(201).send({ movement });
    },
  );

  /**
   * POST /inventory/waste
   */
  app.post(
    '/inventory/waste',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest, reply) => {
      const { restaurantId, userId } = request.user!;
      const body = recordWasteSchema.parse(request.body);

      const movement = await InventoryService.recordWaste(restaurantId, userId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'inventory.waste_recorded',
        entity: 'stock_movement',
        entityId: movement.id,
        after: movement as any,
        request,
      });

      return reply.status(201).send({ movement });
    },
  );

  // ===================== STOCK COUNT & REORDER =====================

  /**
   * POST /inventory/stock-count
   */
  app.post(
    '/inventory/stock-count',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId, userId } = request.user!;
      const body = recordStockCountSchema.parse(request.body);

      const summary = await InventoryService.recordStockCount(restaurantId, userId, body);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'inventory.stock_count_recorded',
        entity: 'stock_count',
        entityId: restaurantId,
        after: { counts: summary } as any,
        request,
      });

      return { summary };
    },
  );

  /**
   * GET /inventory/reorder
   */
  app.get(
    '/inventory/reorder',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const reorderItems = await InventoryService.getReorderList(restaurantId);
      return { reorderItems };
    },
  );

  /**
   * POST /inventory/import-csv
   */
  app.post(
    '/inventory/import-csv',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId, userId } = request.user!;
      const body = commitInventoryCsvImportSchema.parse(request.body);

      const result = await InventoryService.commitCsvImport(restaurantId, userId, body.rows);

      await recordAuditLog({
        restaurantId,
        userId,
        action: 'inventory.csv_imported',
        entity: 'inventory_import',
        entityId: restaurantId,
        after: result as any,
        request,
      });

      return result;
    },
  );

  /**
   * GET /inventory/verify-consistency
   * Diagnostic check verifying current_stock == sum(movements)
   */
  app.get(
    '/inventory/verify-consistency',
    { preHandler: [requirePermission(Permissions.INVENTORY_MANAGE)] },
    async (request: FastifyRequest) => {
      const { restaurantId } = request.user!;
      const check = await InventoryService.verifyStockConsistency(restaurantId);
      return check;
    },
  );
}
