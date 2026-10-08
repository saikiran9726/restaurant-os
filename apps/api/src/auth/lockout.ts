import { env } from '../config/env.js';

export interface LockoutState {
  failedAttempts: number;
  lockedUntil: Date | null;
}

/**
 * Checks whether an account is currently locked due to failed login attempts.
 */
export function isAccountLocked(
  user: { failedAttempts: number; lockedUntil: Date | null },
  now = new Date(),
): boolean {
  if (!user.lockedUntil) {
    return false;
  }
  return user.lockedUntil.getTime() > now.getTime();
}

/**
 * Calculates updated failed attempts and optional lockout timestamp.
 */
export function recordFailedAttempt(
  currentAttempts: number,
  now = new Date(),
  maxAttempts = env.MAX_FAILED_LOGIN_ATTEMPTS,
  lockoutMinutes = env.LOCKOUT_DURATION_MINUTES,
): LockoutState {
  const newAttempts = currentAttempts + 1;

  if (newAttempts >= maxAttempts) {
    const lockedUntil = new Date(now.getTime() + lockoutMinutes * 60 * 1000);
    return {
      failedAttempts: newAttempts,
      lockedUntil,
    };
  }

  return {
    failedAttempts: newAttempts,
    lockedUntil: null,
  };
}

/**
 * Resets failed attempts after a successful login.
 */
export function resetLockout(): LockoutState {
  return {
    failedAttempts: 0,
    lockedUntil: null,
  };
}
