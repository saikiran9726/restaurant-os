import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  db: z.enum(['connected', 'disconnected']),
  timestamp: z.string().datetime(),
  uptime: z.number(),
  error: z.string().optional(),
});

export const versionResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  environment: z.string(),
  uptime: z.number(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type VersionResponse = z.infer<typeof versionResponseSchema>;
