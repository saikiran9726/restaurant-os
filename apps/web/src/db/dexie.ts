import Dexie, { type Table } from 'dexie';
import type { MenuCategory, MenuItem, TableModel } from '@restaurant-os/shared';

export interface OutboxCommand {
  id: string; // client uuid
  key: string; // idempotency key
  type: string; // 'order.create' | 'order.update'
  payload: any;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}

export interface LocalOrder {
  id: string;
  tableId?: string | null;
  tableLabel?: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerPreferences?: { tags: string[]; note: string } | null;
  type: 'dine_in' | 'takeaway';
  guests: number;
  status: 'open' | 'saved' | 'billed' | 'cancelled';
  specialInstructions?: string;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  items: Array<{
    itemId: string;
    name: string;
    isVeg: boolean;
    pricePaise: number;
    qty: number;
    modifiers: Array<{ name: string; priceDeltaPaise: number }>;
    note?: string;
  }>;
  createdAt: number;
  updatedAt: number;
  version: number;
  isSynced: boolean;
}

export interface LocalPrintJob {
  id: string;
  billId: string;
  billNumber: string;
  printerId?: string;
  printerName?: string;
  transport?: string;
  type: 'print' | 'reprint' | 'duplicate' | 'test';
  status: 'queued' | 'printing' | 'printed' | 'failed';
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
  createdAt: number;
  receiptData?: any;
}

export interface CachedCustomer {
  id: string;
  phone: string;
  name: string | null;
  preferences: { tags: string[]; note: string };
  favouriteItems?: any[];
  lastOrder?: any[] | null;
  lastVisitAt?: string | null;
  visitCount?: number;
  updatedAt: number;
}

export class RestaurantDatabase extends Dexie {
  categories!: Table<MenuCategory, string>;
  menu!: Table<MenuItem, string>;
  floorTables!: Table<TableModel & { status?: string }, string>;
  openOrders!: Table<LocalOrder, string>;
  outbox!: Table<OutboxCommand, string>;
  activeKots!: Table<any, string>;
  printJobs!: Table<LocalPrintJob, string>;
  cachedCustomers!: Table<CachedCustomer, string>;

  constructor() {
    super('RestaurantOS_DB');
    this.version(4).stores({
      categories: 'id, sortOrder, active',
      menu: 'id, categoryId, isVeg, available, active, sortOrder',
      floorTables: 'id, label, status, active',
      openOrders: 'id, tableId, status, updatedAt, isSynced',
      outbox: 'id, key, status, createdAt, attempts',
      activeKots: 'id, orderId, status, createdAt',
      printJobs: 'id, billId, status, createdAt, attempts',
      cachedCustomers: 'id, phone, name, updatedAt',
    });
  }
}

export const localDb = new RestaurantDatabase();
