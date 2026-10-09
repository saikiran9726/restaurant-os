export interface KitchenStateItemView {
  id: string; // kot_item id
  orderItemId: string;
  name: string;
  qty: number;
  action: string;
  status: string;
  noteSnapshot?: string | null;
  modifiers?: Array<{ name: string }>;
  doneAt?: string | null;
}

export interface KitchenStateKotView {
  id: string; // kot id
  orderId: string;
  tableLabel?: string | null;
  kotNumber: number;
  type: string;
  status: string;
  createdAt: string;
  seenAt?: string | null;
  readyAt?: string | null;
  items: KitchenStateItemView[];
}

export interface KitchenStateView {
  activeKots: KitchenStateKotView[];
}

/**
 * Sanitizes KOT state for kitchen: removes any customer profiling or price details.
 */
export function serializeKitchenState(rawKots: any[]): KitchenStateView {
  return {
    activeKots: rawKots.map((k) => ({
      id: k.id,
      orderId: k.orderId,
      tableLabel: k.tableLabel || null,
      kotNumber: k.kotNumber,
      type: k.type,
      status: k.status,
      createdAt: typeof k.createdAt === 'string' ? k.createdAt : k.createdAt.toISOString(),
      seenAt: k.seenAt ? (typeof k.seenAt === 'string' ? k.seenAt : k.seenAt.toISOString()) : null,
      readyAt: k.readyAt
        ? typeof k.readyAt === 'string'
          ? k.readyAt
          : k.readyAt.toISOString()
        : null,
      items: (k.items || []).map((i: any) => ({
        id: i.id,
        orderItemId: i.orderItemId,
        name: i.nameSnapshot || i.name || '',
        qty: i.qty,
        action: i.action,
        status: i.status,
        noteSnapshot: i.noteSnapshot || null,
        modifiers: (i.modifiers || []).map((m: any) => ({ name: m.name })),
        doneAt: i.doneAt
          ? typeof i.doneAt === 'string'
            ? i.doneAt
            : i.doneAt.toISOString()
          : null,
      })),
    })),
  };
}
