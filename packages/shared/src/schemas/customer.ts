import { z } from 'zod';

/**
 * Normalizes Indian phone numbers to E.164 format (+91XXXXXXXXXX).
 * Strips formatting, leading zeros, or national trunk prefixes.
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Phone number is required');
  }

  // Remove spaces, hyphens, brackets, dots
  let cleaned = raw.replace(/[\s\-().]/g, '').trim();

  // Handle +91 prefix
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  // Must be 10 digits starting with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(cleaned)) {
    throw new Error('Invalid mobile number. Must be a 10-digit Indian mobile number.');
  }

  return `+91${cleaned}`;
}

export const customerPreferencesSchema = z.object({
  tags: z.array(z.string().trim()).default([]),
  note: z.string().trim().max(300).default(''),
});

export type CustomerPreferences = z.infer<typeof customerPreferencesSchema>;

export type CustomerSegment =
  'new' | 'returning' | 'regular' | 'high_value' | 'inactive' | 'at_risk';

export interface SegmentSettings {
  regularMinVisits: number; // default: 4 visits in last 60 days
  highValueMinSpentPaise: number; // default: 500000 paise (₹5,000)
  inactiveDays: number; // default: 45 days
}

export interface CustomerStatsInput {
  visitCount: number;
  totalSpentPaise: number;
  lastVisitAt?: Date | string | null;
  recentVisitsLast60Days?: number;
  averageVisitIntervalDays?: number | null;
  daysSinceLastVisit?: number | null;
}

/**
 * Pure, transparent segment classification algorithm with human-readable rationale.
 */
export function computeCustomerSegment(
  stats: CustomerStatsInput,
  settings: SegmentSettings = {
    regularMinVisits: 4,
    highValueMinSpentPaise: 500000,
    inactiveDays: 45,
  },
): { segment: CustomerSegment; reason: string } {
  const { visitCount, totalSpentPaise, lastVisitAt } = stats;

  if (visitCount === 0 || !lastVisitAt) {
    return {
      segment: 'new',
      reason: 'No completed visits recorded yet',
    };
  }

  // Compute days since last visit if not provided
  let daysSinceLast = stats.daysSinceLastVisit;
  if (daysSinceLast === null || daysSinceLast === undefined) {
    const lastDate = new Date(lastVisitAt).getTime();
    const now = Date.now();
    daysSinceLast = Math.max(0, Math.floor((now - lastDate) / (1000 * 60 * 60 * 24)));
  }

  // 1. Inactive check (has visited in the past, but absent >= inactiveDays)
  if (daysSinceLast >= settings.inactiveDays) {
    return {
      segment: 'inactive',
      reason: `No visits in the last ${daysSinceLast} days (threshold: ${settings.inactiveDays} days)`,
    };
  }

  // 2. High-value check
  if (totalSpentPaise >= settings.highValueMinSpentPaise) {
    const spentRupees = (totalSpentPaise / 100).toLocaleString('en-IN');
    return {
      segment: 'high_value',
      reason: `High lifetime spend of ₹${spentRupees} (threshold: ₹${(settings.highValueMinSpentPaise / 100).toLocaleString('en-IN')})`,
    };
  }

  // 3. At-risk check: was regular/frequent (>= 3 visits), but current absence is > 1.5x their usual interval
  const interval = stats.averageVisitIntervalDays;
  if (
    visitCount >= 3 &&
    interval &&
    interval > 0 &&
    daysSinceLast > interval * 1.5 &&
    daysSinceLast > 14
  ) {
    return {
      segment: 'at_risk',
      reason: `Visit gap of ${daysSinceLast} days exceeds 1.5× usual visit cadence of ${Math.round(interval)} days`,
    };
  }

  // 4. Regular check
  const recent60 = stats.recentVisitsLast60Days ?? visitCount;
  if (recent60 >= settings.regularMinVisits) {
    return {
      segment: 'regular',
      reason: `${recent60} visits in the last 60 days (threshold: ${settings.regularMinVisits})`,
    };
  }

  // 5. Returning check
  if (visitCount >= 2) {
    return {
      segment: 'returning',
      reason: `${visitCount} lifetime visits; active within the last ${daysSinceLast} days`,
    };
  }

  // 6. New customer
  return {
    segment: 'new',
    reason: 'First visit recorded',
  };
}

export const createCustomerSchema = z.object({
  phone: z.string().trim().min(10, 'Valid 10-digit phone number is required'),
  name: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birthday must be YYYY-MM-DD')
    .optional()
    .nullable(),
  preferences: customerPreferencesSchema.optional().default({ tags: [], note: '' }),
  notes: z.string().trim().max(500).optional().nullable(),
  consentRecorded: z.boolean().default(true),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerWaiterSchema = z.object({
  name: z.string().trim().max(100).optional().nullable(),
  preferences: customerPreferencesSchema.optional(),
});

export type UpdateCustomerWaiterInput = z.infer<typeof updateCustomerWaiterSchema>;

export const updateCustomerOwnerSchema = z.object({
  name: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().min(10).optional(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  preferences: customerPreferencesSchema.optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  consentRecorded: z.boolean().optional(),
});

export type UpdateCustomerOwnerInput = z.infer<typeof updateCustomerOwnerSchema>;

export const attachCustomerToOrderSchema = z.object({
  customerId: z.string().uuid().nullable(),
});

export type AttachCustomerToOrderInput = z.infer<typeof attachCustomerToOrderSchema>;

/**
 * Shape exposed to Waiter POS: NO financial totals, AOV, or customer segmentation.
 */
export interface CustomerWaiterSummary {
  id: string;
  name: string | null;
  phone: string;
  preferences: CustomerPreferences;
  favouriteItems: Array<{
    itemId: string;
    name: string;
    count: number;
    pricePaise: number;
    isVeg: boolean;
  }>;
  lastOrder: Array<{
    itemId: string;
    name: string;
    qty: number;
    pricePaise: number;
    modifiers: any[];
    note?: string;
  }> | null;
  lastVisitAt: string | null;
  visitCount: number;
}

/**
 * Shape exposed to Owner portal: Full profile, financials, and segment analytics.
 */
export interface CustomerOwnerDetail {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  birthday: string | null;
  preferences: CustomerPreferences;
  notes: string | null;
  consentRecorded: boolean;
  createdAt: string;
  lastVisitAt: string | null;
  visitCount: number;
  totalSpentPaise: number;
  averageOrderValuePaise: number;
  visitFrequencyDays: number | null;
  segment: CustomerSegment;
  segmentReason: string;
  favouriteItems: Array<{
    itemId: string;
    name: string;
    count: number;
  }>;
}
