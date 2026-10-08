import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '@restaurant-os/shared';
import { verifyAccessToken, type AccessTokenPayload } from './jwt.js';

// Extend FastifyRequest type to hold authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

export interface RouteRegistryEntry {
  method: string;
  url: string;
  permission?: string;
  isPublic: boolean;
}

export const ROUTE_REGISTRY: RouteRegistryEntry[] = [];

/**
 * Registers an endpoint in the central route registry for automated permission audits.
 */
export function registerRouteGuard(entry: RouteRegistryEntry): void {
  // Avoid duplicate entries
  const exists = ROUTE_REGISTRY.some((r) => r.method === entry.method && r.url === entry.url);
  if (!exists) {
    ROUTE_REGISTRY.push(entry);
  }
}

/**
 * Authentication middleware: verifies Bearer JWT token from Authorization header.
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Authentication required: Missing or invalid authorization header');
  }

  const token = authHeader.substring(7).trim();
  try {
    const payload = verifyAccessToken(token);
    request.user = payload;
  } catch (err) {
    request.log.warn({ err }, 'Token verification failed');
    throw AppError.unauthorized('Invalid or expired access token');
  }
}

/**
 * Default-deny Permission Guard Middleware.
 * Enforces that the authenticated user possesses the specific permission.
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // 1. Ensure user is authenticated
    if (!request.user) {
      await authenticate(request, _reply);
    }

    const user = request.user!;

    // 2. Default Deny: check if user possesses the required permission
    if (!user.permissions || !user.permissions.includes(permission)) {
      request.log.warn(
        { userId: user.userId, role: user.role, requiredPermission: permission },
        'Access denied: Insufficient permissions',
      );
      throw AppError.forbidden(`Access denied: Missing '${permission}' permission`);
    }
  };
}
