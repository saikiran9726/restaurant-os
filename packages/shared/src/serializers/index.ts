/**
 * Per-role response serializers.
 * Security requirement: Kitchen display systems must NEVER include customer PII
 * (phone, name) or financial/price figures (pricePaise, totalPaise, tax, discount).
 */

export interface OrderItemPayload {
  id: string;
  name: string;
  qty: number;
  diet?: 'veg' | 'nonveg';
  notes?: string;
  pricePaise?: number;
}

export interface OrderPayload {
  id: string;
  restaurantId: string;
  tableNumber: string;
  waiterId?: string;
  waiterName?: string;
  status: string;
  customerName?: string;
  customerPhone?: string;
  totalPaise?: number;
  items: OrderItemPayload[];
  createdAt: string | Date;
}

export interface KitchenOrderView {
  id: string;
  restaurantId: string;
  tableNumber: string;
  waiterName?: string;
  status: string;
  items: Array<{
    id: string;
    name: string;
    qty: number;
    diet?: 'veg' | 'nonveg';
    notes?: string;
  }>;
  createdAt: string;
}

/**
 * Sanitizes order payload for Kitchen Display System.
 * Strictly strips all price/monetary fields and customer PII.
 */
export function serializeKitchenOrder(order: OrderPayload): KitchenOrderView {
  return {
    id: order.id,
    restaurantId: order.restaurantId,
    tableNumber: order.tableNumber,
    waiterName: order.waiterName,
    status: order.status,
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      diet: item.diet,
      notes: item.notes,
    })),
    createdAt:
      typeof order.createdAt === 'string' ? order.createdAt : order.createdAt.toISOString(),
  };
}

/**
 * Serializes order payload based on user role.
 */
export function serializeOrderForRole(
  order: OrderPayload,
  role: string,
): KitchenOrderView | OrderPayload {
  if (role === 'KITCHEN') {
    return serializeKitchenOrder(order);
  }
  return order;
}

// ==========================================
// MENU SHAPING PER ROLE
// ==========================================

export interface MenuItemView {
  id: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  aliases: string[];
  isVeg: boolean;
  pricePaise?: number; // Present for OWNER, WAITER, CASHIER; OMITTED for KITCHEN
  available: boolean;
  oosReason?: string | null;
  sortOrder: number;
  modifierGroupIds?: string[];
  version?: number;
}

export interface KitchenMenuItemView {
  id: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  aliases: string[];
  isVeg: boolean;
  available: boolean;
  oosReason?: string | null;
  sortOrder: number;
}

/**
 * Sanitizes a single menu item for the kitchen role (removes pricePaise, taxRateBp).
 */
export function serializeKitchenMenuItem(item: MenuItemView): KitchenMenuItemView {
  return {
    id: item.id,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    name: item.name,
    aliases: item.aliases,
    isVeg: item.isVeg,
    available: item.available,
    oosReason: item.oosReason,
    sortOrder: item.sortOrder,
  };
}

/**
 * Serializes menu items based on caller role.
 * If role is KITCHEN, pricePaise is omitted completely.
 */
export function serializeMenuForRole(
  items: MenuItemView[],
  role: string,
): (KitchenMenuItemView | MenuItemView)[] {
  if (role.toUpperCase() === 'KITCHEN') {
    return items.map(serializeKitchenMenuItem);
  }
  return items;
}

export * from './kitchen-state.js';
