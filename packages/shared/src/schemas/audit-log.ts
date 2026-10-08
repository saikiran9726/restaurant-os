import { z } from 'zod';

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  userId: z.string().uuid().nullable().optional(),
  action: z.string().min(1).max(100),
  entity: z.string().min(1).max(100),
  entityId: z.string().min(1).max(100),
  before: z.record(z.unknown()).nullable().optional(),
  after: z.record(z.unknown()).nullable().optional(),
  createdAt: z.coerce.date(),
});

export const createAuditLogSchema = auditLogSchema.omit({
  id: true,
  createdAt: true,
});

export type AuditLog = z.infer<typeof auditLogSchema>;
export type CreateAuditLogInput = z.infer<typeof createAuditLogSchema>;
