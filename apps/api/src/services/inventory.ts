import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  inventoryItems,
  suppliers,
  purchases,
  purchaseLines,
  stockMovements,
  users,
} from '../db/schema/index.js';
import {
  calculateWeightedAverageCostPaise,
  calculateWasteCostPaise,
  calculateStockCountVariance,
  type CreateInventoryItemInput,
  type UpdateInventoryItemInput,
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type CreatePurchaseInput,
  type UpdatePurchaseInput,
  type RecordUsageInput,
  type RecordWasteInput,
  type RecordStockCountInput,
  type InventoryCsvImportRow,
  type InventoryItemOutput,
  type SupplierOutput,
  type PurchaseOutput,
  type StockMovementOutput,
  type StockCountSummaryOutput,
  AppError,
} from '@restaurant-os/shared';

export class InventoryService {
  /**
   * List inventory items with stock status chips and optional low-stock filter.
   */
  static async listInventoryItems(params: {
    restaurantId: string;
    lowStockOnly?: boolean;
    search?: string;
  }): Promise<InventoryItemOutput[]> {
    const { restaurantId, lowStockOnly, search } = params;

    const items = await db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.restaurantId, restaurantId), eq(inventoryItems.active, true)))
      .orderBy(asc(inventoryItems.name));

    // Get last purchase supplier info for items
    const results: InventoryItemOutput[] = [];

    for (const item of items) {
      const stock = Number(item.currentStock);
      const reorder = Number(item.reorderLevel);

      let status: 'ok' | 'low' | 'out' = 'ok';
      if (stock <= 0) {
        status = 'out';
      } else if (stock <= reorder) {
        status = 'low';
      }

      if (lowStockOnly && status === 'ok') {
        continue;
      }

      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) {
        continue;
      }

      // Find last purchase line to get supplier name and date
      const lastLine = await db
        .select({
          purchaseDate: purchases.purchaseDate,
          supplierName: suppliers.name,
        })
        .from(purchaseLines)
        .innerJoin(purchases, eq(purchaseLines.purchaseId, purchases.id))
        .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
        .where(and(eq(purchaseLines.itemId, item.id), eq(purchases.restaurantId, restaurantId)))
        .orderBy(desc(purchases.purchaseDate), desc(purchaseLines.createdAt))
        .limit(1);

      results.push({
        id: item.id,
        restaurantId: item.restaurantId,
        name: item.name,
        unit: item.unit as any,
        category: item.category,
        currentStock: stock,
        reorderLevel: reorder,
        active: item.active,
        lastPurchasePricePaisePerUnit: item.lastPurchasePricePaisePerUnit,
        avgCostPaisePerUnit: item.avgCostPaisePerUnit,
        status,
        lastSupplierName: lastLine[0]?.supplierName || null,
        lastPurchaseDate: lastLine[0]?.purchaseDate ? String(lastLine[0].purchaseDate) : null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      });
    }

    return results;
  }

  /**
   * Get single inventory item with recent stock movements and purchase history.
   */
  static async getInventoryItemDetail(
    restaurantId: string,
    itemId: string,
  ): Promise<{
    item: InventoryItemOutput;
    recentMovements: StockMovementOutput[];
    purchaseHistory: Array<{
      purchaseId: string;
      purchaseDate: string;
      supplierName: string | null;
      quantity: number;
      unitPricePaise: number;
      lineTotalPaise: number;
    }>;
  }> {
    const [item] = await db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.restaurantId, restaurantId)))
      .limit(1);

    if (!item) {
      throw AppError.notFound('Inventory item not found');
    }

    const stock = Number(item.currentStock);
    const reorder = Number(item.reorderLevel);
    const status = stock <= 0 ? 'out' : stock <= reorder ? 'low' : 'ok';

    // Recent movements
    const movements = await db
      .select({
        id: stockMovements.id,
        restaurantId: stockMovements.restaurantId,
        itemId: stockMovements.itemId,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        reason: stockMovements.reason,
        refPurchaseId: stockMovements.refPurchaseId,
        movementDate: stockMovements.movementDate,
        costSnapshotPaisePerUnit: stockMovements.costSnapshotPaisePerUnit,
        createdBy: stockMovements.createdBy,
        createdByName: users.name,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .leftJoin(users, eq(stockMovements.createdBy, users.id))
      .where(and(eq(stockMovements.itemId, itemId), eq(stockMovements.restaurantId, restaurantId)))
      .orderBy(desc(stockMovements.createdAt))
      .limit(50);

    // Purchase history lines
    const pHistory = await db
      .select({
        purchaseId: purchases.id,
        purchaseDate: purchases.purchaseDate,
        supplierName: suppliers.name,
        quantity: purchaseLines.quantity,
        unitPricePaise: purchaseLines.unitPricePaise,
        lineTotalPaise: purchaseLines.lineTotalPaise,
      })
      .from(purchaseLines)
      .innerJoin(purchases, eq(purchaseLines.purchaseId, purchases.id))
      .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .where(and(eq(purchaseLines.itemId, itemId), eq(purchases.restaurantId, restaurantId)))
      .orderBy(desc(purchases.purchaseDate), desc(purchaseLines.createdAt))
      .limit(20);

    return {
      item: {
        id: item.id,
        restaurantId: item.restaurantId,
        name: item.name,
        unit: item.unit as any,
        category: item.category,
        currentStock: stock,
        reorderLevel: reorder,
        active: item.active,
        lastPurchasePricePaisePerUnit: item.lastPurchasePricePaisePerUnit,
        avgCostPaisePerUnit: item.avgCostPaisePerUnit,
        status,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
      recentMovements: movements.map((m) => ({
        id: m.id,
        restaurantId: m.restaurantId,
        itemId: m.itemId,
        type: m.type as any,
        quantity: Number(m.quantity),
        reason: m.reason,
        refPurchaseId: m.refPurchaseId,
        movementDate: String(m.movementDate),
        costSnapshotPaisePerUnit: m.costSnapshotPaisePerUnit,
        createdBy: m.createdBy,
        createdByName: m.createdByName || null,
        createdAt: m.createdAt.toISOString(),
      })),
      purchaseHistory: pHistory.map((p) => ({
        purchaseId: p.purchaseId,
        purchaseDate: String(p.purchaseDate),
        supplierName: p.supplierName || null,
        quantity: Number(p.quantity),
        unitPricePaise: p.unitPricePaise,
        lineTotalPaise: p.lineTotalPaise,
      })),
    };
  }

  /**
   * Create new inventory item with optional opening stock adjustment movement.
   */
  static async createInventoryItem(
    restaurantId: string,
    userId: string,
    input: CreateInventoryItemInput,
  ): Promise<InventoryItemOutput> {
    const existing = await db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.restaurantId, restaurantId),
          sql`lower(${inventoryItems.name}) = lower(${input.name})`,
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw AppError.badRequest(`An item named "${input.name}" already exists`);
    }

    return await db.transaction(async (tx) => {
      const initialStock = Number(input.currentStock || 0);
      const initialCost = input.initialCostPaisePerUnit || 0;

      const [created] = await tx
        .insert(inventoryItems)
        .values({
          restaurantId,
          name: input.name,
          unit: input.unit,
          category: input.category,
          currentStock: String(initialStock.toFixed(3)),
          reorderLevel: String(Number(input.reorderLevel || 0).toFixed(3)),
          lastPurchasePricePaisePerUnit: initialCost,
          avgCostPaisePerUnit: initialCost,
        })
        .returning();

      if (!created) {
        throw AppError.internal('Failed to create inventory item');
      }

      // Record opening stock movement if initialStock > 0
      if (initialStock > 0) {
        await tx.insert(stockMovements).values({
          restaurantId,
          itemId: created.id,
          type: 'adjustment',
          quantity: String(initialStock.toFixed(3)),
          reason: 'Initial opening stock',
          costSnapshotPaisePerUnit: initialCost,
          createdBy: userId,
        });
      }

      return {
        id: created.id,
        restaurantId: created.restaurantId,
        name: created.name,
        unit: created.unit as any,
        category: created.category,
        currentStock: initialStock,
        reorderLevel: Number(created.reorderLevel),
        active: created.active,
        lastPurchasePricePaisePerUnit: created.lastPurchasePricePaisePerUnit,
        avgCostPaisePerUnit: created.avgCostPaisePerUnit,
        status:
          initialStock <= 0 ? 'out' : initialStock <= Number(created.reorderLevel) ? 'low' : 'ok',
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Update an existing inventory item.
   */
  static async updateInventoryItem(
    restaurantId: string,
    itemId: string,
    input: UpdateInventoryItemInput,
  ): Promise<InventoryItemOutput> {
    const [existing] = await db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.restaurantId, restaurantId)))
      .limit(1);

    if (!existing) {
      throw AppError.notFound('Inventory item not found');
    }

    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      const dup = await db
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.restaurantId, restaurantId),
            sql`lower(${inventoryItems.name}) = lower(${input.name})`,
          ),
        )
        .limit(1);

      if (dup.length > 0) {
        throw AppError.badRequest(`An item named "${input.name}" already exists`);
      }
    }

    const [updated] = await db
      .update(inventoryItems)
      .set({
        name: input.name ?? existing.name,
        unit: input.unit ?? existing.unit,
        category: input.category ?? existing.category,
        reorderLevel:
          input.reorderLevel !== undefined
            ? String(input.reorderLevel.toFixed(3))
            : existing.reorderLevel,
        active: input.active !== undefined ? input.active : existing.active,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, itemId))
      .returning();

    const stock = Number(updated!.currentStock);
    const reorder = Number(updated!.reorderLevel);

    return {
      id: updated!.id,
      restaurantId: updated!.restaurantId,
      name: updated!.name,
      unit: updated!.unit as any,
      category: updated!.category,
      currentStock: stock,
      reorderLevel: reorder,
      active: updated!.active,
      lastPurchasePricePaisePerUnit: updated!.lastPurchasePricePaisePerUnit,
      avgCostPaisePerUnit: updated!.avgCostPaisePerUnit,
      status: stock <= 0 ? 'out' : stock <= reorder ? 'low' : 'ok',
      createdAt: updated!.createdAt.toISOString(),
      updatedAt: updated!.updatedAt.toISOString(),
    };
  }

  // ===================== SUPPLIERS =====================

  static async listSuppliers(restaurantId: string): Promise<SupplierOutput[]> {
    const list = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.restaurantId, restaurantId), eq(suppliers.active, true)))
      .orderBy(asc(suppliers.name));

    const results: SupplierOutput[] = [];
    for (const sup of list) {
      // Calculate supplier lifetime stats
      const stats = await db
        .select({
          count: sql<number>`count(${purchases.id})`,
          totalPaise: sql<number>`coalesce(sum(${purchases.totalPaise}), 0)`,
        })
        .from(purchases)
        .where(and(eq(purchases.supplierId, sup.id), eq(purchases.restaurantId, restaurantId)));

      results.push({
        id: sup.id,
        restaurantId: sup.restaurantId,
        name: sup.name,
        phone: sup.phone,
        notes: sup.notes,
        active: sup.active,
        totalPurchasesCount: Number(stats[0]?.count || 0),
        totalSpendPaise: Number(stats[0]?.totalPaise || 0),
        createdAt: sup.createdAt.toISOString(),
        updatedAt: sup.updatedAt.toISOString(),
      });
    }

    return results;
  }

  static async createSupplier(
    restaurantId: string,
    input: CreateSupplierInput,
  ): Promise<SupplierOutput> {
    const [existing] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.restaurantId, restaurantId),
          sql`lower(${suppliers.name}) = lower(${input.name})`,
        ),
      )
      .limit(1);

    if (existing) {
      throw AppError.badRequest(`Supplier "${input.name}" already exists`);
    }

    const [created] = await db
      .insert(suppliers)
      .values({
        restaurantId,
        name: input.name,
        phone: input.phone || null,
        notes: input.notes || null,
        active: input.active !== undefined ? input.active : true,
      })
      .returning();

    return {
      id: created!.id,
      restaurantId: created!.restaurantId,
      name: created!.name,
      phone: created!.phone,
      notes: created!.notes,
      active: created!.active,
      totalPurchasesCount: 0,
      totalSpendPaise: 0,
      createdAt: created!.createdAt.toISOString(),
      updatedAt: created!.updatedAt.toISOString(),
    };
  }

  // ===================== PURCHASES & RESTOCK =====================

  /**
   * Records a new purchase, adding stock, updating weighted-average cost,
   * setting last purchase price, and recording stock_movement entries.
   */
  static async createPurchase(
    restaurantId: string,
    userId: string,
    input: CreatePurchaseInput,
  ): Promise<PurchaseOutput> {
    return await db.transaction(async (tx) => {
      let totalPurchasePaise = 0;
      for (const line of input.lines) {
        totalPurchasePaise += line.lineTotalPaise;
      }

      const [purchase] = await tx
        .insert(purchases)
        .values({
          restaurantId,
          supplierId: input.supplierId || null,
          purchaseDate: input.purchaseDate as any,
          invoiceRef: input.invoiceRef || null,
          totalPaise: totalPurchasePaise,
          paidStatus: input.paidStatus,
          note: input.note || null,
          createdBy: userId,
        })
        .returning();

      if (!purchase) {
        throw AppError.internal('Failed to create purchase header');
      }

      const lineOutputs = [];

      for (const line of input.lines) {
        // Fetch current item state with lock
        const [item] = await tx
          .select()
          .from(inventoryItems)
          .where(
            and(eq(inventoryItems.id, line.itemId), eq(inventoryItems.restaurantId, restaurantId)),
          )
          .for('update');

        if (!item) {
          throw AppError.notFound(`Inventory item ${line.itemId} not found`);
        }

        const currentStock = Number(item.currentStock);
        const currentAvgCost = item.avgCostPaisePerUnit;
        const lineQty = Number(line.quantity);

        // Compute new weighted average cost
        const newAvgCost = calculateWeightedAverageCostPaise({
          currentStock,
          currentAvgCostPaisePerUnit: currentAvgCost,
          purchaseQuantity: lineQty,
          purchaseTotalPaise: line.lineTotalPaise,
        });

        const newStock = Number((currentStock + lineQty).toFixed(3));

        // Update item stock, last purchase price, and weighted avg cost
        await tx
          .update(inventoryItems)
          .set({
            currentStock: String(newStock.toFixed(3)),
            lastPurchasePricePaisePerUnit: line.unitPricePaise,
            avgCostPaisePerUnit: newAvgCost,
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, item.id));

        // Insert purchase line
        const [pLine] = await tx
          .insert(purchaseLines)
          .values({
            purchaseId: purchase.id,
            itemId: item.id,
            quantity: String(lineQty.toFixed(3)),
            unitPricePaise: line.unitPricePaise,
            lineTotalPaise: line.lineTotalPaise,
          })
          .returning();

        // Record stock movement (purchase)
        await tx.insert(stockMovements).values({
          restaurantId,
          itemId: item.id,
          type: 'purchase',
          quantity: String(lineQty.toFixed(3)),
          reason: `Purchase Invoice ${input.invoiceRef || `#${purchase.id.slice(0, 8)}`}`,
          refPurchaseId: purchase.id,
          movementDate: input.purchaseDate as any,
          costSnapshotPaisePerUnit: line.unitPricePaise,
          createdBy: userId,
        });

        lineOutputs.push({
          id: pLine!.id,
          purchaseId: purchase.id,
          itemId: item.id,
          itemName: item.name,
          itemUnit: item.unit,
          quantity: lineQty,
          unitPricePaise: line.unitPricePaise,
          lineTotalPaise: line.lineTotalPaise,
        });
      }

      // Fetch supplier name if present
      let supplierName: string | null = null;
      if (purchase.supplierId) {
        const [sup] = await tx
          .select({ name: suppliers.name })
          .from(suppliers)
          .where(eq(suppliers.id, purchase.supplierId))
          .limit(1);
        supplierName = sup?.name || null;
      }

      return {
        id: purchase.id,
        restaurantId: purchase.restaurantId,
        supplierId: purchase.supplierId,
        supplierName,
        purchaseDate: String(purchase.purchaseDate),
        invoiceRef: purchase.invoiceRef,
        totalPaise: purchase.totalPaise,
        paidStatus: purchase.paidStatus as any,
        note: purchase.note,
        createdBy: purchase.createdBy,
        lines: lineOutputs,
        createdAt: purchase.createdAt.toISOString(),
        updatedAt: purchase.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Edit purchase with compensating stock movements and cost adjustment.
   * Movements are never silently deleted.
   */
  static async updatePurchase(
    restaurantId: string,
    purchaseId: string,
    userId: string,
    input: UpdatePurchaseInput,
  ): Promise<PurchaseOutput> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(purchases)
        .where(and(eq(purchases.id, purchaseId), eq(purchases.restaurantId, restaurantId)))
        .limit(1);

      if (!existing) {
        throw AppError.notFound('Purchase record not found');
      }

      // If updating lines, handle compensating stock movements
      if (input.lines && input.lines.length > 0) {
        // Fetch existing purchase lines
        const oldLines = await tx
          .select()
          .from(purchaseLines)
          .where(eq(purchaseLines.purchaseId, purchaseId));

        // Revert old lines stock via compensating movement
        for (const oldLine of oldLines) {
          const oldQty = Number(oldLine.quantity);
          await tx
            .update(inventoryItems)
            .set({
              currentStock: sql`${inventoryItems.currentStock} - ${oldQty}`,
              updatedAt: new Date(),
            })
            .where(eq(inventoryItems.id, oldLine.itemId));

          await tx.insert(stockMovements).values({
            restaurantId,
            itemId: oldLine.itemId,
            type: 'adjustment',
            quantity: String((-oldQty).toFixed(3)),
            reason: `Reversal before edit of Purchase #${purchaseId.slice(0, 8)}`,
            refPurchaseId: purchaseId,
            movementDate: existing.purchaseDate as any,
            costSnapshotPaisePerUnit: oldLine.unitPricePaise,
            createdBy: userId,
          });
        }

        // Delete old lines
        await tx.delete(purchaseLines).where(eq(purchaseLines.purchaseId, purchaseId));

        let newTotalPaise = 0;
        // Insert new lines and add new stock
        for (const newLine of input.lines) {
          newTotalPaise += newLine.lineTotalPaise;
          const newQty = Number(newLine.quantity);

          await tx
            .update(inventoryItems)
            .set({
              currentStock: sql`${inventoryItems.currentStock} + ${newQty}`,
              lastPurchasePricePaisePerUnit: newLine.unitPricePaise,
              updatedAt: new Date(),
            })
            .where(eq(inventoryItems.id, newLine.itemId));

          await tx.insert(purchaseLines).values({
            purchaseId,
            itemId: newLine.itemId,
            quantity: String(newQty.toFixed(3)),
            unitPricePaise: newLine.unitPricePaise,
            lineTotalPaise: newLine.lineTotalPaise,
          });

          await tx.insert(stockMovements).values({
            restaurantId,
            itemId: newLine.itemId,
            type: 'purchase',
            quantity: String(newQty.toFixed(3)),
            reason: `Edited Purchase #${purchaseId.slice(0, 8)}`,
            refPurchaseId: purchaseId,
            movementDate: (input.purchaseDate || existing.purchaseDate) as any,
            costSnapshotPaisePerUnit: newLine.unitPricePaise,
            createdBy: userId,
          });
        }

        // Update purchase header
        await tx
          .update(purchases)
          .set({
            supplierId: input.supplierId !== undefined ? input.supplierId : existing.supplierId,
            purchaseDate: (input.purchaseDate || existing.purchaseDate) as any,
            invoiceRef: input.invoiceRef !== undefined ? input.invoiceRef : existing.invoiceRef,
            totalPaise: newTotalPaise,
            paidStatus: input.paidStatus || existing.paidStatus,
            note: input.note !== undefined ? input.note : existing.note,
            updatedAt: new Date(),
          })
          .where(eq(purchases.id, purchaseId));
      } else {
        // Just header fields updated
        await tx
          .update(purchases)
          .set({
            supplierId: input.supplierId !== undefined ? input.supplierId : existing.supplierId,
            purchaseDate: (input.purchaseDate || existing.purchaseDate) as any,
            invoiceRef: input.invoiceRef !== undefined ? input.invoiceRef : existing.invoiceRef,
            paidStatus: input.paidStatus || existing.paidStatus,
            note: input.note !== undefined ? input.note : existing.note,
            updatedAt: new Date(),
          })
          .where(eq(purchases.id, purchaseId));
      }

      // Fetch fresh purchase details
      const [updatedPurchase] = await tx
        .select()
        .from(purchases)
        .where(eq(purchases.id, purchaseId))
        .limit(1);

      const lines = await tx
        .select({
          id: purchaseLines.id,
          purchaseId: purchaseLines.purchaseId,
          itemId: purchaseLines.itemId,
          itemName: inventoryItems.name,
          itemUnit: inventoryItems.unit,
          quantity: purchaseLines.quantity,
          unitPricePaise: purchaseLines.unitPricePaise,
          lineTotalPaise: purchaseLines.lineTotalPaise,
        })
        .from(purchaseLines)
        .innerJoin(inventoryItems, eq(purchaseLines.itemId, inventoryItems.id))
        .where(eq(purchaseLines.purchaseId, purchaseId));

      return {
        id: updatedPurchase!.id,
        restaurantId: updatedPurchase!.restaurantId,
        supplierId: updatedPurchase!.supplierId,
        purchaseDate: String(updatedPurchase!.purchaseDate),
        invoiceRef: updatedPurchase!.invoiceRef,
        totalPaise: updatedPurchase!.totalPaise,
        paidStatus: updatedPurchase!.paidStatus as any,
        note: updatedPurchase!.note,
        createdBy: updatedPurchase!.createdBy,
        lines: lines.map((l) => ({
          ...l,
          quantity: Number(l.quantity),
        })),
        createdAt: updatedPurchase!.createdAt.toISOString(),
        updatedAt: updatedPurchase!.updatedAt.toISOString(),
      };
    });
  }

  /**
   * List purchases with optional supplier or date range filter.
   */
  static async listPurchases(params: {
    restaurantId: string;
    supplierId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<PurchaseOutput[]> {
    const { restaurantId, supplierId, startDate, endDate, limit = 50 } = params;

    const list = await db
      .select({
        id: purchases.id,
        restaurantId: purchases.restaurantId,
        supplierId: purchases.supplierId,
        supplierName: suppliers.name,
        purchaseDate: purchases.purchaseDate,
        invoiceRef: purchases.invoiceRef,
        totalPaise: purchases.totalPaise,
        paidStatus: purchases.paidStatus,
        note: purchases.note,
        createdBy: purchases.createdBy,
        createdByName: users.name,
        createdAt: purchases.createdAt,
        updatedAt: purchases.updatedAt,
      })
      .from(purchases)
      .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .leftJoin(users, eq(purchases.createdBy, users.id))
      .where(
        and(
          eq(purchases.restaurantId, restaurantId),
          supplierId ? eq(purchases.supplierId, supplierId) : undefined,
          startDate ? sql`${purchases.purchaseDate} >= ${startDate}::date` : undefined,
          endDate ? sql`${purchases.purchaseDate} <= ${endDate}::date` : undefined,
        ),
      )
      .orderBy(desc(purchases.purchaseDate), desc(purchases.createdAt))
      .limit(limit);

    const results: PurchaseOutput[] = [];

    for (const p of list) {
      const lines = await db
        .select({
          id: purchaseLines.id,
          purchaseId: purchaseLines.purchaseId,
          itemId: purchaseLines.itemId,
          itemName: inventoryItems.name,
          itemUnit: inventoryItems.unit,
          quantity: purchaseLines.quantity,
          unitPricePaise: purchaseLines.unitPricePaise,
          lineTotalPaise: purchaseLines.lineTotalPaise,
        })
        .from(purchaseLines)
        .innerJoin(inventoryItems, eq(purchaseLines.itemId, inventoryItems.id))
        .where(eq(purchaseLines.purchaseId, p.id));

      results.push({
        id: p.id,
        restaurantId: p.restaurantId,
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        purchaseDate: String(p.purchaseDate),
        invoiceRef: p.invoiceRef,
        totalPaise: p.totalPaise,
        paidStatus: p.paidStatus as any,
        note: p.note,
        createdBy: p.createdBy,
        createdByName: p.createdByName,
        lines: lines.map((l) => ({ ...l, quantity: Number(l.quantity) })),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      });
    }

    return results;
  }

  // ===================== USAGE & WASTE =====================

  static async recordUsage(
    restaurantId: string,
    userId: string,
    input: RecordUsageInput,
  ): Promise<StockMovementOutput> {
    return await db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(inventoryItems)
        .where(
          and(eq(inventoryItems.id, input.itemId), eq(inventoryItems.restaurantId, restaurantId)),
        )
        .for('update');

      if (!item) throw AppError.notFound('Inventory item not found');

      const currentStock = Number(item.currentStock);
      if (currentStock < input.quantity) {
        throw AppError.badRequest(
          `Usage quantity (${input.quantity} ${item.unit}) exceeds current stock (${currentStock} ${item.unit})`,
        );
      }

      const newStock = Number((currentStock - input.quantity).toFixed(3));

      await tx
        .update(inventoryItems)
        .set({
          currentStock: String(newStock.toFixed(3)),
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, item.id));

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          restaurantId,
          itemId: item.id,
          type: 'usage',
          quantity: String((-input.quantity).toFixed(3)),
          reason: input.reason || 'Kitchen consumption',
          movementDate: (input.movementDate || new Date().toISOString().split('T')[0]) as any,
          costSnapshotPaisePerUnit: item.avgCostPaisePerUnit,
          createdBy: userId,
        })
        .returning();

      return {
        id: movement!.id,
        restaurantId: movement!.restaurantId,
        itemId: movement!.itemId,
        itemName: item.name,
        itemUnit: item.unit,
        type: 'usage',
        quantity: -input.quantity,
        reason: movement!.reason,
        refPurchaseId: null,
        movementDate: String(movement!.movementDate),
        costSnapshotPaisePerUnit: movement!.costSnapshotPaisePerUnit,
        createdBy: userId,
        createdAt: movement!.createdAt.toISOString(),
      };
    });
  }

  static async recordWaste(
    restaurantId: string,
    userId: string,
    input: RecordWasteInput,
  ): Promise<StockMovementOutput> {
    return await db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(inventoryItems)
        .where(
          and(eq(inventoryItems.id, input.itemId), eq(inventoryItems.restaurantId, restaurantId)),
        )
        .for('update');

      if (!item) throw AppError.notFound('Inventory item not found');

      const currentStock = Number(item.currentStock);
      if (currentStock < input.quantity) {
        throw AppError.badRequest(
          `Waste quantity (${input.quantity} ${item.unit}) exceeds current stock (${currentStock} ${item.unit})`,
        );
      }

      const newStock = Number((currentStock - input.quantity).toFixed(3));
      const wasteCost = calculateWasteCostPaise(input.quantity, item.avgCostPaisePerUnit);

      await tx
        .update(inventoryItems)
        .set({
          currentStock: String(newStock.toFixed(3)),
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, item.id));

      const reasonText = input.note
        ? `Waste (${input.reason}): ${input.note}`
        : `Waste (${input.reason})`;

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          restaurantId,
          itemId: item.id,
          type: 'waste',
          quantity: String((-input.quantity).toFixed(3)),
          reason: reasonText,
          movementDate: (input.movementDate || new Date().toISOString().split('T')[0]) as any,
          costSnapshotPaisePerUnit: item.avgCostPaisePerUnit,
          createdBy: userId,
        })
        .returning();

      return {
        id: movement!.id,
        restaurantId: movement!.restaurantId,
        itemId: movement!.itemId,
        itemName: item.name,
        itemUnit: item.unit,
        type: 'waste',
        quantity: -input.quantity,
        reason: movement!.reason,
        refPurchaseId: null,
        movementDate: String(movement!.movementDate),
        costSnapshotPaisePerUnit: movement!.costSnapshotPaisePerUnit,
        createdBy: userId,
        createdAt: movement!.createdAt.toISOString(),
      };
    });
  }

  // ===================== STOCK COUNT & RECONCILIATION =====================

  /**
   * Records a physical stock count. Implied usage is derived:
   * variance = counted - previousStock.
   * If variance < 0, records implied usage/count movement to bring stock to counted.
   */
  static async recordStockCount(
    restaurantId: string,
    userId: string,
    input: RecordStockCountInput,
  ): Promise<StockCountSummaryOutput[]> {
    return await db.transaction(async (tx) => {
      const summaries: StockCountSummaryOutput[] = [];
      const mDate = input.movementDate || new Date().toISOString().split('T')[0];

      for (const countLine of input.counts) {
        const [item] = await tx
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.id, countLine.itemId),
              eq(inventoryItems.restaurantId, restaurantId),
            ),
          )
          .for('update');

        if (!item) continue;

        const previousStock = Number(item.currentStock);
        const countedStock = Number(countLine.countedStock);
        const { variance } = calculateStockCountVariance({
          previousStock,
          countedStock,
        });

        // Set item stock directly to counted stock
        await tx
          .update(inventoryItems)
          .set({
            currentStock: String(countedStock.toFixed(3)),
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, item.id));

        // Record stock_count movement with the variance quantity
        await tx.insert(stockMovements).values({
          restaurantId,
          itemId: item.id,
          type: 'stock_count',
          quantity: String(variance.toFixed(3)),
          reason: input.note ? `Stock Count: ${input.note}` : 'Physical Stock Count',
          movementDate: mDate as any,
          costSnapshotPaisePerUnit: item.avgCostPaisePerUnit,
          createdBy: userId,
        });

        summaries.push({
          itemId: item.id,
          itemName: item.name,
          unit: item.unit,
          previousStock,
          countedStock,
          variance,
          impliedUsage: variance < 0 ? Math.abs(variance) : 0,
          costImpactPaise: Math.round(Math.abs(variance) * item.avgCostPaisePerUnit),
        });
      }

      return summaries;
    });
  }

  // ===================== REORDER LIST =====================

  /**
   * Returns items at or below their reorder level with last supplier and price.
   */
  static async getReorderList(restaurantId: string): Promise<InventoryItemOutput[]> {
    const items = await this.listInventoryItems({
      restaurantId,
      lowStockOnly: true,
    });
    return items;
  }

  // ===================== CSV IMPORT =====================

  /**
   * Commits validated CSV import rows, creating new items or updating opening stocks.
   */
  static async commitCsvImport(
    restaurantId: string,
    userId: string,
    rows: InventoryCsvImportRow[],
  ): Promise<{ importedCount: number; errors: string[] }> {
    let importedCount = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        await this.createInventoryItem(restaurantId, userId, {
          name: row.name,
          unit: row.unit,
          category: row.category,
          currentStock: row.currentStock,
          reorderLevel: row.reorderLevel,
          initialCostPaisePerUnit: Math.round(row.costPricePerUnit * 100),
        });
        importedCount++;
      } catch (err: any) {
        errors.push(`Row "${row.name}": ${err.message}`);
      }
    }

    return { importedCount, errors };
  }

  // ===================== CONSISTENCY CHECK =====================

  /**
   * Verifies transactional invariant:
   * current_stock == sum(stock_movements.quantity) for every item.
   */
  static async verifyStockConsistency(restaurantId: string): Promise<{
    isConsistent: boolean;
    mismatches: Array<{ itemId: string; name: string; currentStock: number; movementSum: number }>;
  }> {
    const items = await db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        currentStock: inventoryItems.currentStock,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.restaurantId, restaurantId));

    const mismatches = [];

    for (const item of items) {
      const sumResult = await db
        .select({
          total: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)`,
        })
        .from(stockMovements)
        .where(eq(stockMovements.itemId, item.id));

      const currentStock = Number(Number(item.currentStock).toFixed(3));
      const movementSum = Number(Number(sumResult[0]?.total || 0).toFixed(3));

      if (Math.abs(currentStock - movementSum) > 0.001) {
        mismatches.push({
          itemId: item.id,
          name: item.name,
          currentStock,
          movementSum,
        });
      }
    }

    return {
      isConsistent: mismatches.length === 0,
      mismatches,
    };
  }
}
