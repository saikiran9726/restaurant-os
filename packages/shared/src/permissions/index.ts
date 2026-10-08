export const Permissions = {
  // Restaurant management
  RESTAURANT_VIEW: 'restaurant:view',
  RESTAURANT_UPDATE: 'restaurant:update',
  RESTAURANT_SETTINGS: 'restaurant:settings',

  // User & Staff management
  USERS_VIEW: 'users:view',
  USERS_MANAGE: 'users:manage',

  // Orders & Billing
  ORDERS_VIEW: 'orders:view',
  ORDERS_CREATE: 'orders:create',
  ORDERS_MANAGE: 'orders:manage',

  // Menu management
  MENU_VIEW: 'menu:view',
  MENU_MANAGE: 'menu:manage',

  // Inventory management
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_MANAGE: 'inventory:manage',

  // Reports & Analytics
  REPORTS_VIEW: 'reports:view',

  // Audit logs
  AUDIT_LOGS_VIEW: 'audit_logs:view',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];
