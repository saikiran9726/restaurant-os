import { describe, it, expect } from 'vitest';
import {
  calculateLoyaltyEarn,
  calculateMaxRedeemable,
  validateAndConvertRedemption,
  determineCustomerTier,
} from './loyalty-engine.js';
import { loyaltySettingsSchema } from '../schemas/loyalty.js';

describe('Loyalty Engine', () => {
  const defaultSettings = loyaltySettingsSchema.parse({});

  describe('Earn calculation', () => {
    it('earns 60 points on a ₹1,200 bill at standard base rate (₹100 -> 5 pts)', () => {
      // 120,000 paise = ₹1,200
      const result = calculateLoyaltyEarn({
        billSubtotalPaise: 120000,
        netPaidPaise: 120000,
        loyaltyDiscountPaise: 0,
        otherDiscountPaise: 0,
        customerLifetimeSpendPaise: 0,
        settings: defaultSettings,
      });

      expect(result.eligibleSpendPaise).toBe(120000);
      expect(result.basePoints).toBe(60);
      expect(result.earnedPoints).toBe(60);
      expect(result.tierMultiplier).toBe(1);
    });

    it('does not earn points on the portion paid with loyalty redemption', () => {
      // Subtotal ₹1,200, loyalty discount ₹50 (5,000 paise), net paid ₹1,150 (115,000 paise)
      const result = calculateLoyaltyEarn({
        billSubtotalPaise: 120000,
        netPaidPaise: 115000,
        loyaltyDiscountPaise: 5000,
        otherDiscountPaise: 0,
        customerLifetimeSpendPaise: 0,
        settings: defaultSettings,
      });

      // 115,000 / 10,000 = 11 blocks of ₹100 -> 55 points
      expect(result.eligibleSpendPaise).toBe(115000);
      expect(result.earnedPoints).toBe(55);
    });

    it('applies tier multipliers correctly for Gold and Platinum', () => {
      // Gold tier (lifetime >= ₹5,000) has 1.25x earn multiplier
      const goldResult = calculateLoyaltyEarn({
        billSubtotalPaise: 100000, // ₹1,000
        netPaidPaise: 100000,
        loyaltyDiscountPaise: 0,
        otherDiscountPaise: 0,
        customerLifetimeSpendPaise: 600000, // ₹6,000 -> Gold
        settings: defaultSettings,
      });

      // 10 blocks * 5 pts = 50 base pts * 1.25 = 62.5 -> Math.floor = 62
      expect(goldResult.tierName).toBe('Gold');
      expect(goldResult.basePoints).toBe(50);
      expect(goldResult.tierMultiplier).toBe(1.25);
      expect(goldResult.earnedPoints).toBe(62);
    });
  });

  describe('Redemption calculation', () => {
    it('converts 500 points to ₹50 discount (5000 paise)', () => {
      // Bill: ₹500 (50,000 paise), balance: 1,000 pts
      const result = validateAndConvertRedemption({
        pointsToRedeem: 500,
        billTotalPaise: 50000,
        pointsBalance: 1000,
        settings: defaultSettings,
      });

      expect(result.isValid).toBe(true);
      expect(result.discountPaise).toBe(5000);
    });

    it('rejects redemptions below the minimum points threshold', () => {
      const result = validateAndConvertRedemption({
        pointsToRedeem: 300,
        billTotalPaise: 50000,
        pointsBalance: 400,
        settings: defaultSettings,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('multiples of 500');
    });

    it('enforces maximum percentage cap of bill total', () => {
      // Bill: ₹80 (8,000 paise). Max 50% cap = ₹40 (4,000 paise).
      // 500 points would yield ₹50 (5,000 paise), which exceeds the 50% cap.
      const maxRedeem = calculateMaxRedeemable({
        billTotalPaise: 8000,
        pointsBalance: 1000,
        settings: defaultSettings,
      });

      expect(maxRedeem.isEligible).toBe(false);
      expect(maxRedeem.ineligibleReason).toContain('Bill amount is too low');
    });

    it('enforces new account cooldown hours anti-abuse', () => {
      const cooldownCheck = calculateMaxRedeemable({
        billTotalPaise: 50000,
        pointsBalance: 1000,
        accountAgeHours: 2, // Less than 24h
        settings: defaultSettings,
      });

      expect(cooldownCheck.isEligible).toBe(false);
      expect(cooldownCheck.ineligibleReason).toContain('New account cooldown active');
    });
  });

  describe('Tier determination', () => {
    it('determines tiers ascending according to spend thresholds', () => {
      const tiers = defaultSettings.tiers;
      expect(determineCustomerTier(10000, tiers).name).toBe('Silver');
      expect(determineCustomerTier(500000, tiers).name).toBe('Gold');
      expect(determineCustomerTier(1500000, tiers).name).toBe('Platinum');
    });
  });
});
