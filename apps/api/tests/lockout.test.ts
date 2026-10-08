import { describe, it, expect } from 'vitest';
import { isAccountLocked, recordFailedAttempt, resetLockout } from '../src/auth/lockout.js';

describe('Account Lockout Logic', () => {
  it('does not lock account below max attempts', () => {
    const now = new Date();
    const state = recordFailedAttempt(2, now, 5, 10);
    expect(state.failedAttempts).toBe(3);
    expect(state.lockedUntil).toBeNull();

    expect(isAccountLocked(state, now)).toBe(false);
  });

  it('locks account when max failed attempts reached', () => {
    const now = new Date();
    const state = recordFailedAttempt(4, now, 5, 10);
    expect(state.failedAttempts).toBe(5);
    expect(state.lockedUntil).toBeInstanceOf(Date);
    expect(state.lockedUntil!.getTime()).toBeGreaterThan(now.getTime());

    expect(isAccountLocked(state, now)).toBe(true);
  });

  it('isAccountLocked returns false when lockedUntil is in the past', () => {
    const pastDate = new Date(Date.now() - 1000);
    expect(isAccountLocked({ failedAttempts: 5, lockedUntil: pastDate })).toBe(false);
  });

  it('resetLockout resets failed attempts and clears lockedUntil', () => {
    const reset = resetLockout();
    expect(reset.failedAttempts).toBe(0);
    expect(reset.lockedUntil).toBeNull();
  });
});
