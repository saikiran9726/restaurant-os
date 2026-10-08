export type Locale = 'en' | 'te' | 'hi';

export const enTranslations = {
  // Common
  'common.appName': 'Restaurant OS',
  'common.online': 'Online',
  'common.offline': 'Offline (Changes will queue locally)',
  'common.syncing': 'Syncing changes...',
  'common.retry': 'Retry',
  'common.close': 'Close',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.back': 'Back',
  'common.loading': 'Loading...',
  'common.noData': 'No data available',
  'common.devTools': 'Component Library',

  // Portals
  'portal.waiter': 'Waiter Portal',
  'portal.kitchen': 'Kitchen Display System',
  'portal.owner': 'Owner Dashboard',

  // Kitchen specific
  'kitchen.rushMode': 'Rush Mode',
  'kitchen.rushModeActive': 'Rush Mode Active',
  'kitchen.clock': 'Kitchen Clock',
  'kitchen.liveOrders': 'Live Orders',
  'kitchen.completed': 'Completed',
  'kitchen.allStations': 'All Stations',

  // Waiter specific
  'waiter.tables': 'Tables',
  'waiter.activeOrders': 'Active Orders',
  'waiter.quickBill': 'Quick Bill',
  'waiter.notifications': 'Alerts',

  // Owner specific
  'owner.overview': 'Overview',
  'owner.liveSales': 'Live Sales',
  'owner.menuAnalytics': 'Menu Performance',
  'owner.staff': 'Staff & Tables',
  'owner.settings': 'Settings',

  // Statuses
  'status.new': 'New Order',
  'status.preparing': 'Preparing',
  'status.ready': 'Ready to Serve',
  'status.late': 'Delayed',
  'status.overdue': 'Overdue',

  // Auth & Placeholders
  'auth.signInRequired': 'Sign In Required',
  'auth.notAvailableYet': 'Authentication is disabled in Phase 1 skeleton.',
  'auth.login': 'Log In',
  'auth.username': 'Username or Email',
  'auth.password': 'Password',
} as const;

export type TranslationKey = keyof typeof enTranslations;

export const translations: Record<Locale, Partial<Record<TranslationKey, string>>> = {
  en: enTranslations,
  te: {},
  hi: {},
};

let currentLocale: Locale = 'en';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Universal translation helper.
 * Replaces placeholders like {name} with param values.
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = translations[currentLocale] || translations.en;
  let text = dict[key] || translations.en[key] || key;

  if (params) {
    for (const [paramKey, val] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
    }
  }

  return text;
}
