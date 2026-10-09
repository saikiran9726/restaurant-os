import { z } from 'zod';

export const syncCommandBatchItemSchema = z.object({
  id: z.string().min(1, 'Command ID required'),
  idempotencyKey: z.string().min(1, 'Idempotency key required'),
  deviceId: z.string().min(1, 'Device ID required'),
  claimedAt: z.string().nullable().optional(),
  baseVersion: z.number().int().nonnegative().nullable().optional(),
  type: z.string().min(1, 'Command type required'),
  payload: z.record(z.any()),
});

export const syncPushBatchSchema = z.object({
  restaurantId: z.string().uuid('Valid restaurant ID required'),
  deviceId: z.string().min(1, 'Device ID required'),
  batchId: z.string().min(1, 'Batch ID required'),
  commands: z.array(syncCommandBatchItemSchema).min(1, 'At least one command required'),
});
export type SyncPushBatchInput = z.infer<typeof syncPushBatchSchema>;

export const registerHubSchema = z.object({
  deviceId: z.string().min(1, 'Device ID required'),
  name: z.string().min(1, 'Hub name required').default('Restaurant Local Hub'),
  hostAddress: z.string().min(1, 'Host address required'),
  apiKey: z.string().min(8, 'API key must be at least 8 chars'),
});
export type RegisterHubInput = z.infer<typeof registerHubSchema>;

export const discardDeadLetterSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Explanatory reason for discarding poison command is required (min 3 chars)'),
});
export type DiscardDeadLetterInput = z.infer<typeof discardDeadLetterSchema>;

export const resolveConflictSchema = z.object({
  resolutionNote: z.string().trim().min(3, 'Resolution note is required (min 3 chars)'),
});
export type ResolveConflictInput = z.infer<typeof resolveConflictSchema>;
