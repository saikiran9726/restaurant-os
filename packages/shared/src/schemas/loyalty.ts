import { z } from 'zod';

export const LoyaltyTransactionTypeEnum = z.enum([
  'earn',
  'redeem',
  'reversal',
  'adjust',
  'expire',
  'bonus',
]);
export type LoyaltyTransactionType = z.infer<typeof LoyaltyTransactionTypeEnum>;

export const loyaltyTierSchema = z.object({
  name: z.string().trim().min(1).max(50),
  thresholdSpendPaise: z.number().int().nonnegative(),
  earnMultiplier: z.number().positive().max(10).default(1),
});
export type LoyaltyTier = z.infer<typeof loyaltyTierSchema>;

export const visitRewardSchema = z.object({
  enabled: z.boolean().default(false),
  everyNVisits: z.number().int().min(1).default(5),
  bonusPoints: z.number().int().nonnegative().default(100),
});
export type VisitRewardConfig = z.infer<typeof visitRewardSchema>;

export const birthdayRewardSchema = z.object({
  enabled: z.boolean().default(false),
  bonusPoints: z.number().int().nonnegative().default(200),
  minDaysRegistered: z.number().int().nonnegative().default(30),
});
export type BirthdayRewardConfig = z.infer<typeof birthdayRewardSchema>;

export const referralRewardSchema = z.object({
  enabled: z.boolean().default(false),
  referrerBonusPoints: z.number().int().nonnegative().default(100),
  refereeBonusPoints: z.number().int().nonnegative().default(50),
  minBillPaiseToQualify: z.number().int().nonnegative().default(20000), // ₹200
  maxReferralsPerReferrer: z.number().int().positive().default(5),
});
export type ReferralRewardConfig = z.infer<typeof referralRewardSchema>;

export const loyaltySettingsSchema = z.object({
  enabled: z.boolean().default(true),
  // Earn Rate: default ₹100 spend -> 5 points
  spendPaisePerBlock: z.number().int().positive().default(10000), // 10000 paise = ₹100
  pointsPerBlock: z.number().int().positive().default(5),
  // Redeem Rate: default 500 points -> ₹50 (5000 paise)
  redeemPointsBlock: z.number().int().positive().default(500),
  redeemValuePaise: z.number().int().positive().default(5000), // 5000 paise = ₹50
  minRedeemPoints: z.number().int().nonnegative().default(500),
  maxRedeemPercentOfBill: z.number().int().min(1).max(100).default(50), // max 50% of bill
  pointsExpiryDays: z.number().int().positive().nullable().optional().default(null),
  earnOnDiscountedAmount: z.boolean().default(false), // if true, earn on gross before non-loyalty discount; if false, earn on actual net bill paid
  newAccountCooldownHours: z.number().int().nonnegative().default(24),
  perDayRedeemCapPoints: z.number().int().positive().default(5000),
  tiers: z
    .array(loyaltyTierSchema)
    .max(3)
    .default([
      { name: 'Silver', thresholdSpendPaise: 0, earnMultiplier: 1 },
      { name: 'Gold', thresholdSpendPaise: 500000, earnMultiplier: 1.25 }, // ₹5,000
      { name: 'Platinum', thresholdSpendPaise: 1500000, earnMultiplier: 1.5 }, // ₹15,000
    ]),
  visitReward: visitRewardSchema.default({
    enabled: false,
    everyNVisits: 5,
    bonusPoints: 100,
  }),
  birthdayReward: birthdayRewardSchema.default({
    enabled: false,
    bonusPoints: 200,
    minDaysRegistered: 30,
  }),
  referralReward: referralRewardSchema.default({
    enabled: false,
    referrerBonusPoints: 100,
    refereeBonusPoints: 50,
    minBillPaiseToQualify: 20000,
    maxReferralsPerReferrer: 5,
  }),
});
export type LoyaltySettings = z.infer<typeof loyaltySettingsSchema>;

export const updateLoyaltySettingsSchema = loyaltySettingsSchema.partial();
export type UpdateLoyaltySettings = z.infer<typeof updateLoyaltySettingsSchema>;

export const redeemPointsSchema = z.object({
  pointsToRedeem: z.number().int().positive('Points to redeem must be greater than 0'),
  idempotencyKey: z.string().trim().min(1).optional(),
});
export type RedeemPointsInput = z.infer<typeof redeemPointsSchema>;

export const manualLoyaltyAdjustSchema = z.object({
  customerId: z.string().uuid(),
  points: z
    .number()
    .int()
    .refine((val) => val !== 0, 'Adjustment points cannot be 0'),
  reason: z.string().trim().min(3, 'Adjustment reason must be at least 3 characters'),
});
export type ManualLoyaltyAdjustInput = z.infer<typeof manualLoyaltyAdjustSchema>;

export interface LoyaltyAccountSummary {
  customerId: string;
  pointsBalance: number;
  tier: string;
  tierMultiplier: number;
  lifetimePoints: number;
  unverifiedBalance?: boolean;
}

export interface LoyaltyTransactionOutput {
  id: string;
  type: LoyaltyTransactionType;
  points: number;
  billId?: string | null;
  billNumber?: string | null;
  reason?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

export interface CustomerLoyaltyDetails {
  account: LoyaltyAccountSummary;
  settings: LoyaltySettings;
  transactions: LoyaltyTransactionOutput[];
  maxRedeemablePointsForBill?: number;
  maxRedeemablePaiseForBill?: number;
}

export interface LoyaltyOverviewSummary {
  totalAccounts: number;
  totalPointsIssued: number;
  totalPointsRedeemed: number;
  totalActivePoints: number;
  estimatedLiabilityPaise: number;
  redemptionRatePercent: number;
  mismatchesDetected: number;
}
