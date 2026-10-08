import { db } from '../db/client.js';
import { auditLogs } from '../db/schema/audit-logs.js';
import type { FastifyRequest } from 'fastify';

export interface RecordAuditParams {
  restaurantId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  request?: FastifyRequest;
}

/**
 * Persists an audit log entry with device & IP metadata.
 */
export async function recordAuditLog(params: RecordAuditParams): Promise<void> {
  const { restaurantId, userId, action, entity, entityId, before, after, request } = params;

  let device: string | undefined;
  let ip: string | undefined;

  if (request) {
    device =
      (request.headers['user-agent'] as string) || (request.headers['x-device-label'] as string);
    ip =
      request.ip || (request.headers['x-forwarded-for'] as string) || request.socket.remoteAddress;
  }

  try {
    await db.insert(auditLogs).values({
      restaurantId,
      userId: userId || null,
      action,
      entity,
      entityId,
      before: before || null,
      after: after || null,
      device: device || null,
      ip: ip || null,
    });
  } catch (err) {
    // Non-blocking: log audit failures so transaction doesn't abruptly halt
    console.error('[audit] Failed to write audit log:', err);
  }
}
