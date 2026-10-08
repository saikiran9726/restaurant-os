/**
 * RBAC Permissions and Roles for Restaurant OS.
 */

export const Permissions = {
  // Order lifecycle
  ORDER_CREATE: 'order.create',
  ORDER_READ: 'order.read',
  ORDER_UPDATE: 'order.update',

  // KOT (Kitchen Order Ticket) lifecycle
  KOT_CREATE: 'kot.create',
  KOT_READ: 'kot.read',
  KOT_UPDATE_STATUS: 'kot.update_status',

  // Kitchen item completion
  ITEM_COMPLETE: 'item.complete',

  // Menu operations
  MENU_READ: 'menu.read',
  MENU_MANAGE: 'menu.manage',
  MENU_MARK_OOS: 'menu.mark_oos', // Mark item Out-Of-Stock

  // Floor & Table operations
  TABLE_READ: 'table.read',
  TABLE_MANAGE: 'table.manage',

  // Billing & Settlements
  BILL_CREATE: 'bill.create',
  BILL_READ: 'bill.read',
  PAYMENT_TAKE: 'payment.take',
  DISCOUNT_APPLY: 'discount.apply', // Governed by per-role cap
  BILL_REFUND: 'bill.refund',

  // Business Reports & Intelligence
  REPORT_READ: 'report.read',

  // CRM & Guests
  CUSTOMER_READ: 'customer.read',
  CUSTOMER_MANAGE: 'customer.manage',

  // Inventory & Operations
  INVENTORY_MANAGE: 'inventory.manage',
  EXPENSE_MANAGE: 'expense.manage',

  // System Administration
  STAFF_MANAGE: 'staff.manage',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_READ: 'audit.read',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

export const Roles = {
  OWNER: 'OWNER',
  WAITER: 'WAITER',
  KITCHEN: 'KITCHEN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
} as const;

export type RoleName = (typeof Roles)[keyof typeof Roles];

/**
 * Standard default permissions matrix per role.
 * In database, permissions are stored in role_permissions table allowing
 * runtime dynamic customization and new role introduction (e.g. MANAGER, CASHIER).
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  OWNER: Object.values(Permissions),

  WAITER: [
    Permissions.ORDER_CREATE,
    Permissions.ORDER_READ,
    Permissions.ORDER_UPDATE,
    Permissions.KOT_CREATE,
    Permissions.KOT_READ,
    Permissions.MENU_READ,
    Permissions.TABLE_READ,
    Permissions.BILL_CREATE,
    Permissions.BILL_READ,
    Permissions.PAYMENT_TAKE,
    Permissions.CUSTOMER_READ,
  ],

  KITCHEN: [
    Permissions.KOT_READ,
    Permissions.KOT_UPDATE_STATUS,
    Permissions.ITEM_COMPLETE,
    Permissions.MENU_READ,
    Permissions.MENU_MARK_OOS,
  ],

  MANAGER: [
    Permissions.ORDER_CREATE,
    Permissions.ORDER_READ,
    Permissions.ORDER_UPDATE,
    Permissions.KOT_CREATE,
    Permissions.KOT_READ,
    Permissions.KOT_UPDATE_STATUS,
    Permissions.ITEM_COMPLETE,
    Permissions.MENU_READ,
    Permissions.MENU_MANAGE,
    Permissions.MENU_MARK_OOS,
    Permissions.TABLE_READ,
    Permissions.TABLE_MANAGE,
    Permissions.BILL_CREATE,
    Permissions.BILL_READ,
    Permissions.PAYMENT_TAKE,
    Permissions.DISCOUNT_APPLY,
    Permissions.BILL_REFUND,
    Permissions.REPORT_READ,
    Permissions.CUSTOMER_READ,
    Permissions.CUSTOMER_MANAGE,
    Permissions.INVENTORY_MANAGE,
    Permissions.EXPENSE_MANAGE,
    Permissions.STAFF_MANAGE,
    Permissions.AUDIT_READ,
  ],

  CASHIER: [
    Permissions.ORDER_READ,
    Permissions.MENU_READ,
    Permissions.TABLE_READ,
    Permissions.BILL_CREATE,
    Permissions.BILL_READ,
    Permissions.PAYMENT_TAKE,
    Permissions.DISCOUNT_APPLY,
    Permissions.REPORT_READ,
    Permissions.CUSTOMER_READ,
  ],
};
