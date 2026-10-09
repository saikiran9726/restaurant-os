import { z } from 'zod';
import { ALERT_TYPES, INSIGHT_KINDS } from '../alerts-insights/types.js';

export const acknowledgeAlertSchema = z.object({
  note: z.string().trim().min(3, 'A resolution or acknowledgement note (min 3 chars) is required'),
});
export type AcknowledgeAlertInput = z.infer<typeof acknowledgeAlertSchema>;

export const snoozeAlertSchema = z.object({
  duration: z.enum(['1d', '7d'], {
    errorMap: () => ({ message: 'Snooze duration must be either 1d (1 day) or 7d (7 days)' }),
  }),
});
export type SnoozeAlertInput = z.infer<typeof snoozeAlertSchema>;

export const dismissAlertSchema = z.object({
  reason: z.string().trim().optional().nullable(),
});
export type DismissAlertInput = z.infer<typeof dismissAlertSchema>;

export const dismissInsightSchema = z.object({
  dismissed: z.boolean().default(true),
});
export type DismissInsightInput = z.infer<typeof dismissInsightSchema>;

export const updateAlertSettingsSchema = z.object({
  cashMismatchTolerancePaise: z.number().int().min(0).max(500000).default(5000),
  highExpenseMultiplier: z.number().min(1.1).max(5.0).default(1.5),
  highExpenseMinAmountPaise: z.number().int().min(1000).max(50000000).default(500000),
  upiPendingTimeoutHours: z.number().min(0.5).max(48).default(2),
  profitDeclinePointsThreshold: z.number().min(1.0).max(50.0).default(5.0),
  regularCustomerInactiveDays: z.number().int().min(7).max(180).default(30),
  enabledAlerts: z.record(z.enum(ALERT_TYPES), z.boolean()),
  enabledInsights: z.record(z.enum(INSIGHT_KINDS), z.boolean()),
});
export type UpdateAlertSettingsInput = z.infer<typeof updateAlertSettingsSchema>;
