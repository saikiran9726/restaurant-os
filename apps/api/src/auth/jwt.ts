import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  userId: string;
  restaurantId: string;
  username: string;
  name: string;
  role: string;
  permissions: string[];
}

/**
 * Signs a short-lived access token (15 minutes).
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '15m',
    algorithm: 'HS256',
  });
}

/**
 * Verifies and decodes an access token.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}
