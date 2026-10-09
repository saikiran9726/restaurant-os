import type { FastifyInstance } from 'fastify';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  Permissions,
  createMenuItemSchema,
  updateMenuItemSchema,
  bulkVegToggleSchema,
  reorderItemsSchema,
  commitCsvImportSchema,
  csvImportRowSchema,
  serializeMenuForRole,
  AppError,
  generateUuidV7,
  type CsvImportPreviewResponse,
  type CsvImportRowResult,
} from '@restaurant-os/shared';
import { db } from '../db/client.js';
import { menuItems, itemModifierGroups } from '../db/schema/menu-items.js';
import { menuCategories } from '../db/schema/menu-categories.js';
import { modifierGroups } from '../db/schema/modifiers.js';
import { requirePermission, registerRouteGuard } from '../auth/middleware.js';
import { recordAuditLog } from '../services/audit.js';
import { emitRealtimeEvent } from '../realtime/socket.js';

export async function registerMenuRoutes(app: FastifyInstance): Promise<void> {
  // Public/protected route registrations for route-registry audit
  registerRouteGuard({
    method: 'GET',
    url: '/menu',
    isPublic: false,
    permission: Permissions.MENU_READ,
  });
  registerRouteGuard({
    method: 'GET',
    url: '/menu/search',
    isPublic: false,
    permission: Permissions.MENU_READ,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/menu/items',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'PATCH',
    url: '/menu/items/:id',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'DELETE',
    url: '/menu/items/:id',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/menu/items/bulk-veg',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'PUT',
    url: '/menu/items/reorder',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/menu/import',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/menu/seed-sample',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'DELETE',
    url: '/menu/clear-sample',
    isPublic: false,
    permission: Permissions.MENU_MANAGE,
  });
  registerRouteGuard({
    method: 'POST',
    url: '/menu/:itemId/oos',
    isPublic: false,
    permission: Permissions.MENU_MARK_OOS,
  });
  registerRouteGuard({
    method: 'DELETE',
    url: '/menu/:itemId/oos',
    isPublic: false,
    permission: Permissions.MENU_MARK_OOS,
  });

  /**
   * GET /menu - Fetch menu for Waiter / Kitchen / Owner with ETag and role shaping
   */
  app.get(
    '/menu',
    { preHandler: [requirePermission(Permissions.MENU_READ)] },
    async (request, reply) => {
      const authUser = request.user!;

      // Fetch active categories
      const categories = await db
        .select()
        .from(menuCategories)
        .where(
          and(
            eq(menuCategories.restaurantId, authUser.restaurantId),
            eq(menuCategories.active, true),
          ),
        )
        .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));

      // Fetch active items with their category name
      const items = await db
        .select({
          id: menuItems.id,
          categoryId: menuItems.categoryId,
          categoryName: menuCategories.name,
          name: menuItems.name,
          aliases: menuItems.aliases,
          isVeg: menuItems.isVeg,
          pricePaise: menuItems.pricePaise,
          available: menuItems.available,
          oosReason: menuItems.oosReason,
          sortOrder: menuItems.sortOrder,
          version: menuItems.version,
          updatedAt: menuItems.updatedAt,
        })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id))
        .where(
          and(
            eq(menuItems.restaurantId, authUser.restaurantId),
            eq(menuItems.active, true),
            eq(menuCategories.active, true),
          ),
        )
        .orderBy(asc(menuCategories.sortOrder), asc(menuItems.sortOrder), asc(menuItems.name));

      // Fetch item modifier group links
      const itemIds = items.map((i) => i.id);
      const modifierGroupMap = new Map<string, string[]>();
      if (itemIds.length > 0) {
        const joins = await db
          .select({
            itemId: itemModifierGroups.itemId,
            modifierGroupId: itemModifierGroups.modifierGroupId,
          })
          .from(itemModifierGroups)
          .where(sql`${itemModifierGroups.itemId} IN ${itemIds}`);

        for (const j of joins) {
          const list = modifierGroupMap.get(j.itemId) || [];
          list.push(j.modifierGroupId);
          modifierGroupMap.set(j.itemId, list);
        }
      }

      const shapedItems = items.map((i) => ({
        ...i,
        modifierGroupIds: modifierGroupMap.get(i.id) || [],
      }));

      // Apply per-role data shaping (Kitchen role NEVER receives pricePaise)
      const sanitizedItems = serializeMenuForRole(shapedItems, authUser.role);

      const payload = {
        categories,
        items: sanitizedItems,
      };

      // Compute ETag for cheap client revalidation
      const contentHash = crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex');
      const etag = `"${contentHash}"`;

      reply.header('ETag', etag);

      const clientEtag = request.headers['if-none-match'];
      if (clientEtag && clientEtag === etag) {
        return reply.status(304).send();
      }

      return reply.status(200).send(payload);
    },
  );

  /**
   * GET /menu/search?q=&veg=true - High-speed trigram/alias menu search with ranked results
   * Tolerant to spelling variations (e.g. "biriyani", "briyani" -> "Biryani")
   */
  app.get(
    '/menu/search',
    { preHandler: [requirePermission(Permissions.MENU_READ)] },
    async (request, reply) => {
      const authUser = request.user!;
      const query = request.query as { q?: string; veg?: string };
      const q = (query.q || '').trim();
      const vegFilter = query.veg === 'true' ? true : query.veg === 'false' ? false : undefined;

      if (!q) {
        return reply.status(200).send({ items: [] });
      }

      // Ranking SQL:
      // Exact / Prefix match (rank 1)
      // Contains / partial match (rank 2)
      // Trigram similarity match (rank 3)
      const sanitizedQ = q.replace(/[%_]/g, '');

      const searchConditions = [
        eq(menuItems.restaurantId, authUser.restaurantId),
        eq(menuItems.active, true),
        eq(menuCategories.active, true),
      ];

      if (vegFilter !== undefined) {
        searchConditions.push(eq(menuItems.isVeg, vegFilter));
      }

      const rows = await db
        .select({
          id: menuItems.id,
          categoryId: menuItems.categoryId,
          categoryName: menuCategories.name,
          name: menuItems.name,
          aliases: menuItems.aliases,
          isVeg: menuItems.isVeg,
          pricePaise: menuItems.pricePaise,
          available: menuItems.available,
          oosReason: menuItems.oosReason,
          sortOrder: menuItems.sortOrder,
          // Trigram similarity & matching scores
          rank: sql<number>`
            CASE
              WHEN lower(${menuItems.name}) = lower(${sanitizedQ}) THEN 100
              WHEN lower(${menuItems.name}) LIKE lower(${sanitizedQ || ''} || '%') THEN 80
              WHEN ${sanitizedQ} = ANY(lower(${menuItems.aliases}::text)::text[]) THEN 75
              WHEN lower(${menuItems.name}) LIKE lower('%' || ${sanitizedQ || ''} || '%') THEN 60
              WHEN similarity(${menuItems.name}, ${sanitizedQ}) > 0.25 THEN (similarity(${menuItems.name}, ${sanitizedQ}) * 50)::int
              WHEN similarity(array_to_string(${menuItems.aliases}, ' '), ${sanitizedQ}) > 0.25 THEN (similarity(array_to_string(${menuItems.aliases}, ' '), ${sanitizedQ}) * 45)::int
              ELSE 0
            END
          `,
        })
        .from(menuItems)
        .innerJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id))
        .where(
          and(
            ...searchConditions,
            sql`(
              lower(${menuItems.name}) LIKE lower('%' || ${sanitizedQ} || '%')
              OR array_to_string(${menuItems.aliases}, ' ') ILIKE ('%' || ${sanitizedQ} || '%')
              OR similarity(${menuItems.name}, ${sanitizedQ}) > 0.2
              OR similarity(array_to_string(${menuItems.aliases}, ' '), ${sanitizedQ}) > 0.2
            )`,
          ),
        )
        .orderBy(desc(sql`rank`), asc(menuItems.name))
        .limit(50);

      const filtered = rows.filter((r) => r.rank > 0);
      const shaped = serializeMenuForRole(filtered, authUser.role);

      return reply.status(200).send({ items: shaped });
    },
  );

  /**
   * POST /menu/items - Create menu item
   */
  app.post(
    '/menu/items',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = createMenuItemSchema.parse(request.body);

      // Verify category exists and belongs to restaurant
      const [category] = await db
        .select({ id: menuCategories.id })
        .from(menuCategories)
        .where(
          and(
            eq(menuCategories.id, body.categoryId),
            eq(menuCategories.restaurantId, authUser.restaurantId),
          ),
        )
        .limit(1);

      if (!category) {
        throw AppError.badRequest('Invalid category');
      }

      // Check unique item name per category for active items
      const [existing] = await db
        .select({ id: menuItems.id })
        .from(menuItems)
        .where(
          and(
            eq(menuItems.restaurantId, authUser.restaurantId),
            eq(menuItems.categoryId, body.categoryId),
            sql`lower(${menuItems.name}) = lower(${body.name})`,
            eq(menuItems.active, true),
          ),
        )
        .limit(1);

      if (existing) {
        throw AppError.conflict(`An item named '${body.name}' already exists in this category.`);
      }

      const id = generateUuidV7();
      const [created] = await db
        .insert(menuItems)
        .values({
          id,
          restaurantId: authUser.restaurantId,
          categoryId: body.categoryId,
          name: body.name,
          aliases: body.aliases,
          isVeg: body.isVeg,
          pricePaise: body.pricePaise,
          taxRateBp: body.taxRateBp ?? 500,
          available: body.available ?? true,
          oosReason: body.oosReason,
          sortOrder: body.sortOrder ?? 0,
          active: true,
          version: 1,
        })
        .returning();

      // Assign modifier groups
      if (body.modifierGroupIds && body.modifierGroupIds.length > 0) {
        for (let i = 0; i < body.modifierGroupIds.length; i++) {
          await db.insert(itemModifierGroups).values({
            itemId: id,
            modifierGroupId: body.modifierGroupIds[i]!,
            sortOrder: i,
          });
        }
      }

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'menu_item.create',
        entity: 'menu_item',
        entityId: id,
        after: body,
        request,
      });

      return reply.status(201).send({
        ...created,
        modifierGroupIds: body.modifierGroupIds || [],
      });
    },
  );

  /**
   * PATCH /menu/items/:id - Update menu item with optimistic concurrency (version) & price audit
   */
  app.patch<{ Params: { id: string } }>(
    '/menu/items/:id',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;
      const body = updateMenuItemSchema.parse(request.body);

      const [target] = await db
        .select()
        .from(menuItems)
        .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, authUser.restaurantId)))
        .limit(1);

      if (!target) {
        throw AppError.notFound('Menu item not found');
      }

      // Optimistic concurrency check
      if (body.version !== undefined && target.version !== body.version) {
        throw AppError.conflict(
          'This item was modified by another user. Please refresh and try again.',
        );
      }

      // Duplicate name check in category if name or category changed
      const nextCategory = body.categoryId || target.categoryId;
      const nextName = body.name || target.name;
      if (
        (body.name && body.name.toLowerCase() !== target.name.toLowerCase()) ||
        (body.categoryId && body.categoryId !== target.categoryId)
      ) {
        const [conflict] = await db
          .select({ id: menuItems.id })
          .from(menuItems)
          .where(
            and(
              eq(menuItems.restaurantId, authUser.restaurantId),
              eq(menuItems.categoryId, nextCategory),
              sql`lower(${menuItems.name}) = lower(${nextName})`,
              eq(menuItems.active, true),
            ),
          )
          .limit(1);

        if (conflict && conflict.id !== target.id) {
          throw AppError.conflict(`An item named '${nextName}' already exists in this category.`);
        }
      }

      const updateValues: Record<string, unknown> = {
        version: target.version + 1,
        updatedAt: new Date(),
      };

      if (body.name !== undefined) updateValues.name = body.name;
      if (body.categoryId !== undefined) updateValues.categoryId = body.categoryId;
      if (body.aliases !== undefined) updateValues.aliases = body.aliases;
      if (body.isVeg !== undefined) updateValues.isVeg = body.isVeg;
      if (body.pricePaise !== undefined) updateValues.pricePaise = body.pricePaise;
      if (body.taxRateBp !== undefined) updateValues.taxRateBp = body.taxRateBp;
      if (body.available !== undefined) updateValues.available = body.available;
      if (body.oosReason !== undefined) updateValues.oosReason = body.oosReason;
      if (body.sortOrder !== undefined) updateValues.sortOrder = body.sortOrder;
      if (body.active !== undefined) updateValues.active = body.active;

      const [updated] = await db
        .update(menuItems)
        .set(updateValues)
        .where(eq(menuItems.id, target.id))
        .returning();

      // Update modifier groups if provided
      if (body.modifierGroupIds !== undefined) {
        await db.delete(itemModifierGroups).where(eq(itemModifierGroups.itemId, target.id));
        for (let i = 0; i < body.modifierGroupIds.length; i++) {
          await db.insert(itemModifierGroups).values({
            itemId: target.id,
            modifierGroupId: body.modifierGroupIds[i]!,
            sortOrder: i,
          });
        }
      }

      // Audit price change separately if price modified
      if (body.pricePaise !== undefined && body.pricePaise !== target.pricePaise) {
        await recordAuditLog({
          restaurantId: authUser.restaurantId,
          userId: authUser.userId,
          action: 'menu_item.price_change',
          entity: 'menu_item',
          entityId: target.id,
          before: { pricePaise: target.pricePaise },
          after: { pricePaise: body.pricePaise },
          request,
        });
      }

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'menu_item.update',
        entity: 'menu_item',
        entityId: target.id,
        before: { name: target.name, isVeg: target.isVeg, available: target.available },
        after: body,
        request,
      });

      return reply.status(200).send(updated);
    },
  );

  /**
   * DELETE /menu/items/:id - Deactivate item
   */
  app.delete<{ Params: { id: string } }>(
    '/menu/items/:id',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { id } = request.params;

      const [target] = await db
        .select()
        .from(menuItems)
        .where(and(eq(menuItems.id, id), eq(menuItems.restaurantId, authUser.restaurantId)))
        .limit(1);

      if (!target) {
        throw AppError.notFound('Menu item not found');
      }

      await db
        .update(menuItems)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(menuItems.id, target.id));

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'menu_item.deactivate',
        entity: 'menu_item',
        entityId: target.id,
        request,
      });

      return reply.status(200).send({ success: true });
    },
  );

  /**
   * POST /menu/items/bulk-veg - Bulk veg/non-veg toggle
   */
  app.post(
    '/menu/items/bulk-veg',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = bulkVegToggleSchema.parse(request.body);

      await db
        .update(menuItems)
        .set({ isVeg: body.isVeg, updatedAt: new Date() })
        .where(
          and(
            eq(menuItems.restaurantId, authUser.restaurantId),
            sql`${menuItems.id} IN ${body.itemIds}`,
          ),
        );

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'menu_item.bulk_veg_toggle',
        entity: 'menu_item',
        entityId: 'bulk',
        after: body,
        request,
      });

      return reply.status(200).send({ success: true, count: body.itemIds.length });
    },
  );

  /**
   * PUT /menu/items/reorder - Reorder menu items
   */
  app.put(
    '/menu/items/reorder',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = reorderItemsSchema.parse(request.body);

      for (let i = 0; i < body.itemIds.length; i++) {
        await db
          .update(menuItems)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(
            and(
              eq(menuItems.id, body.itemIds[i]!),
              eq(menuItems.restaurantId, authUser.restaurantId),
            ),
          );
      }

      return reply.status(200).send({ success: true });
    },
  );

  /**
   * POST /menu/import - CSV Import (supports dryRun for preview & error reporting)
   */
  app.post(
    '/menu/import',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;
      const body = commitCsvImportSchema.parse(request.body);

      // Parse CSV text into rows
      const rawLines = body.csvContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (rawLines.length < 2) {
        throw AppError.badRequest('CSV must contain a header line and at least one data row.');
      }

      // Check header
      const headers = rawLines[0]!.split(',').map((h) =>
        h
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, ''),
      );
      // Expected headers: category, name, vegnonveg, price, aliases, modifiergroups

      const rowResults: CsvImportRowResult[] = [];
      const validRowsToCommit: Array<{
        category: string;
        name: string;
        isVeg: boolean;
        pricePaise: number;
        aliases: string[];
        modifierGroups: string[];
      }> = [];

      for (let i = 1; i < rawLines.length; i++) {
        const line = rawLines[i]!;
        // Simple comma splitter supporting quoted strings
        const cols = line.split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));

        const category = cols[0] || '';
        const name = cols[1] || '';
        const vegNonVeg = cols[2] || 'veg';
        const price = cols[3] || '0';
        const aliases = cols[4] || '';
        const modGroups = cols[5] || '';

        const errors: string[] = [];
        let parsedData: any = null;

        try {
          parsedData = csvImportRowSchema.parse({
            category,
            name,
            vegNonVeg,
            price,
            aliases,
            modifierGroups: modGroups,
          });
        } catch (err: any) {
          if (err.errors) {
            errors.push(...err.errors.map((e: any) => e.message));
          } else {
            errors.push(err.message);
          }
        }

        const isValid = errors.length === 0 && parsedData !== null;
        rowResults.push({
          rowNumber: i + 1,
          data: {
            category: parsedData?.category || category,
            name: parsedData?.name || name,
            isVeg: parsedData?.vegNonVeg ?? true,
            pricePaise: parsedData?.price || 0,
            aliases: parsedData?.aliases || [],
            modifierGroups: parsedData?.modifierGroups || [],
          },
          errors,
          isValid,
        });

        if (isValid) {
          validRowsToCommit.push({
            category: parsedData.category,
            name: parsedData.name,
            isVeg: parsedData.vegNonVeg,
            pricePaise: parsedData.price,
            aliases: parsedData.aliases,
            modifierGroups: parsedData.modifierGroups,
          });
        }
      }

      const totalRows = rowResults.length;
      const validRows = rowResults.filter((r) => r.isValid).length;
      const invalidRows = totalRows - validRows;

      // If dryRun, return preview without writing to database
      if (body.dryRun) {
        const previewResponse: CsvImportPreviewResponse = {
          totalRows,
          validRows,
          invalidRows,
          preview: rowResults,
        };
        return reply.status(200).send(previewResponse);
      }

      // Commit valid rows
      if (validRowsToCommit.length === 0) {
        throw AppError.badRequest('No valid rows found in CSV import.');
      }

      // Group by category and upsert categories
      const categoryMap = new Map<string, string>();
      const existingCategories = await db
        .select()
        .from(menuCategories)
        .where(eq(menuCategories.restaurantId, authUser.restaurantId));

      for (const cat of existingCategories) {
        categoryMap.set(cat.name.toLowerCase(), cat.id);
      }

      for (const row of validRowsToCommit) {
        const lowerCat = row.category.toLowerCase();
        if (!categoryMap.has(lowerCat)) {
          const newCatId = generateUuidV7();
          await db.insert(menuCategories).values({
            id: newCatId,
            restaurantId: authUser.restaurantId,
            name: row.category,
            sortOrder: categoryMap.size,
          });
          categoryMap.set(lowerCat, newCatId);
        }
      }

      // Insert menu items
      let createdCount = 0;
      for (const row of validRowsToCommit) {
        const categoryId = categoryMap.get(row.category.toLowerCase())!;
        const itemId = generateUuidV7();

        // Deactivate or conflict handling: insert item
        await db.insert(menuItems).values({
          id: itemId,
          restaurantId: authUser.restaurantId,
          categoryId,
          name: row.name,
          isVeg: row.isVeg,
          pricePaise: row.pricePaise,
          aliases: row.aliases,
          taxRateBp: 500,
          active: true,
          available: true,
        });
        createdCount++;
      }

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'menu.import_csv',
        entity: 'menu_items',
        entityId: 'bulk',
        after: { totalImported: createdCount },
        request,
      });

      return reply.status(200).send({
        success: true,
        importedCount: createdCount,
        skippedCount: invalidRows,
      });
    },
  );

  /**
   * POST /menu/seed-sample - Load sample Indian restaurant menu
   * Clearly marked as sample data, editable freely, deletable in one click
   */
  app.post(
    '/menu/seed-sample',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;

      const sampleCategories = [
        { name: 'Biryani (Sample)', desc: 'Fragrant dum biryanis' },
        { name: 'Starters (Sample)', desc: 'Crispy and savory appetizers' },
        { name: 'Kebabs & Tandoor (Sample)', desc: 'Clay oven specials' },
        { name: 'Main Course (Sample)', desc: 'Traditional gravies and curries' },
        { name: 'Breads (Sample)', desc: 'Tandoori rotis and naans' },
        { name: 'Drinks (Sample)', desc: 'Coolers and beverages' },
        { name: 'Desserts (Sample)', desc: 'Sweet treats' },
      ];

      const sampleItems = [
        {
          cat: 'Biryani (Sample)',
          name: 'Hyderabadi Dum Biryani',
          veg: false,
          price: 34000,
          aliases: ['biryani', 'biriyani', 'briyani', 'mutton biryani'],
        },
        {
          cat: 'Biryani (Sample)',
          name: 'Paneer Tikka Biryani',
          veg: true,
          price: 28000,
          aliases: ['veg biryani', 'paneer biryani'],
        },
        {
          cat: 'Starters (Sample)',
          name: 'Crispy Corn Salt & Pepper',
          veg: true,
          price: 21000,
          aliases: ['corn', 'crispy corn'],
        },
        {
          cat: 'Starters (Sample)',
          name: 'Chicken 65',
          veg: false,
          price: 26000,
          aliases: ['chilli chicken', 'chicken sixty five'],
        },
        {
          cat: 'Kebabs & Tandoor (Sample)',
          name: 'Murgh Malai Tikka',
          veg: false,
          price: 32000,
          aliases: ['malai tikka', 'chicken tikka'],
        },
        {
          cat: 'Kebabs & Tandoor (Sample)',
          name: 'Dahi Ke Kebab',
          veg: true,
          price: 24000,
          aliases: ['dahi kabab', 'hung curd kebab'],
        },
        {
          cat: 'Main Course (Sample)',
          name: 'Butter Chicken Masala',
          veg: false,
          price: 36000,
          aliases: ['murgh makhani', 'butter chicken'],
        },
        {
          cat: 'Main Course (Sample)',
          name: 'Paneer Butter Masala',
          veg: true,
          price: 29000,
          aliases: ['pbm', 'paneer makhani'],
        },
        {
          cat: 'Main Course (Sample)',
          name: 'Dal Makhani',
          veg: true,
          price: 23000,
          aliases: ['black dal', 'maa ki dal'],
        },
        {
          cat: 'Breads (Sample)',
          name: 'Butter Naan',
          veg: true,
          price: 6000,
          aliases: ['naan', 'butter roti'],
        },
        {
          cat: 'Breads (Sample)',
          name: 'Garlic Roti',
          veg: true,
          price: 5000,
          aliases: ['lasooni roti'],
        },
        {
          cat: 'Drinks (Sample)',
          name: 'Mango Lassi',
          veg: true,
          price: 12000,
          aliases: ['sweet lassi', 'lassi'],
        },
        {
          cat: 'Drinks (Sample)',
          name: 'Fresh Lime Soda',
          veg: true,
          price: 8000,
          aliases: ['nimbu soda', 'lime water'],
        },
        {
          cat: 'Desserts (Sample)',
          name: 'Gulab Jamun (2 pcs)',
          veg: true,
          price: 11000,
          aliases: ['jamun', 'sweet'],
        },
      ];

      const categoryMap = new Map<string, string>();

      for (let i = 0; i < sampleCategories.length; i++) {
        const c = sampleCategories[i]!;
        const catId = generateUuidV7();
        await db.insert(menuCategories).values({
          id: catId,
          restaurantId: authUser.restaurantId,
          name: c.name,
          description: c.desc,
          sortOrder: i,
          active: true,
        });
        categoryMap.set(c.name, catId);
      }

      for (let j = 0; j < sampleItems.length; j++) {
        const item = sampleItems[j]!;
        const categoryId = categoryMap.get(item.cat)!;
        await db.insert(menuItems).values({
          id: generateUuidV7(),
          restaurantId: authUser.restaurantId,
          categoryId,
          name: item.name,
          aliases: item.aliases,
          isVeg: item.veg,
          pricePaise: item.price,
          taxRateBp: 500,
          sortOrder: j,
          available: true,
          active: true,
        });
      }

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'menu.seed_sample',
        entity: 'menu',
        entityId: 'sample',
        after: { categoriesCount: sampleCategories.length, itemsCount: sampleItems.length },
        request,
      });

      return reply.status(200).send({
        success: true,
        message: 'Sample Indian restaurant menu loaded successfully (Sample data, edit freely).',
      });
    },
  );

  /**
   * DELETE /menu/clear-sample - Clear all sample data in one single action
   */
  app.delete(
    '/menu/clear-sample',
    { preHandler: [requirePermission(Permissions.MENU_MANAGE)] },
    async (request, reply) => {
      const authUser = request.user!;

      // Find categories marked as sample
      const sampleCats = await db
        .select({ id: menuCategories.id })
        .from(menuCategories)
        .where(
          and(
            eq(menuCategories.restaurantId, authUser.restaurantId),
            sql`lower(${menuCategories.name}) LIKE '%(sample)%'`,
          ),
        );

      if (sampleCats.length > 0) {
        const catIds = sampleCats.map((c) => c.id);
        await db.delete(menuItems).where(sql`${menuItems.categoryId} IN ${catIds}`);
        await db.delete(menuCategories).where(sql`${menuCategories.id} IN ${catIds}`);
      }

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'menu.clear_sample',
        entity: 'menu',
        entityId: 'sample',
        request,
      });

      return reply.status(200).send({ success: true, clearedCategoriesCount: sampleCats.length });
    },
  );

  /**
   * POST /menu/:itemId/oos - Mark menu item out-of-stock (Kitchen + Owner)
   */
  app.post(
    '/menu/:itemId/oos',
    { preHandler: [requirePermission(Permissions.MENU_MARK_OOS)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { itemId } = request.params as { itemId: string };
      const body = (request.body as any) || {};
      const reason = body.reason || 'Out of stock';

      const existing = await db
        .select()
        .from(menuItems)
        .where(and(eq(menuItems.id, itemId), eq(menuItems.restaurantId, authUser.restaurantId)))
        .limit(1);

      if (existing.length === 0) {
        throw new AppError('Menu item not found', 'ITEM_NOT_FOUND', 404);
      }

      const [updated] = await db
        .update(menuItems)
        .set({
          available: false,
          oosReason: reason,
          oosSetBy: authUser.userId,
          oosSetAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(menuItems.id, itemId))
        .returning();

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'menu.mark_oos',
        entity: 'menu_item',
        entityId: itemId,
        before: { available: true },
        after: { available: false, oosReason: reason },
        request,
      });

      // Realtime broadcast: menu.availabilityChanged
      emitRealtimeEvent(
        authUser.restaurantId,
        'menu.availabilityChanged',
        {
          itemId,
          available: false,
          oosReason: reason,
        },
        'all',
      );

      return reply.status(200).send({ success: true, item: updated });
    },
  );

  /**
   * DELETE /menu/:itemId/oos - Mark menu item back in stock (Kitchen + Owner)
   */
  app.delete(
    '/menu/:itemId/oos',
    { preHandler: [requirePermission(Permissions.MENU_MARK_OOS)] },
    async (request, reply) => {
      const authUser = request.user!;
      const { itemId } = request.params as { itemId: string };

      const existing = await db
        .select()
        .from(menuItems)
        .where(and(eq(menuItems.id, itemId), eq(menuItems.restaurantId, authUser.restaurantId)))
        .limit(1);

      if (existing.length === 0) {
        throw new AppError('Menu item not found', 'ITEM_NOT_FOUND', 404);
      }

      const [updated] = await db
        .update(menuItems)
        .set({
          available: true,
          oosReason: null,
          oosSetBy: null,
          oosSetAt: null,
          updatedAt: new Date(),
        })
        .where(eq(menuItems.id, itemId))
        .returning();

      await recordAuditLog({
        restaurantId: authUser.restaurantId,
        userId: authUser.userId,
        action: 'menu.unmark_oos',
        entity: 'menu_item',
        entityId: itemId,
        before: { available: false, oosReason: existing[0]?.oosReason },
        after: { available: true },
        request,
      });

      // Realtime broadcast: menu.availabilityChanged
      emitRealtimeEvent(
        authUser.restaurantId,
        'menu.availabilityChanged',
        {
          itemId,
          available: true,
        },
        'all',
      );

      return reply.status(200).send({ success: true, item: updated });
    },
  );
}
