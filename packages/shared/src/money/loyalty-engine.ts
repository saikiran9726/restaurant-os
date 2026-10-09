import {
  type LoyaltySettings,
  type LoyaltyTier,
  loyaltySettingsSchema,
} from '../schemas/loyalty.js';

export interface EarnCalculationResult {
  eligibleSpendPaise: number;
  basePoints: number;
  tierMultiplier: number;
  earnedPoints: number;
  tierName: string;
}

export interface RedeemCalculationResult {
  pointsToRedeem: number;
  discountPaise: number;
  isValid: boolean;
  error?: string;
}

/**
 * Calculates which tier a customer belongs to based on their lifetime spend in paise.
 */
export function determineCustomerTier(
  lifetimeSpendPaise: number,
  tiers: LoyaltyTier[] = [],
): LoyaltyTier {
  if (!tiers || tiers.length === 0) {
    return { name: 'Member', thresholdSpendPaise: 0, earnMultiplier: 1 };
  }

  // Sort ascending by threshold
  const sorted = [...tiers].sort((a, b) => a.thresholdSpendPaise - b.thresholdSpendPaise);

  let activeTier = sorted[0]!;
  for (const tier of sorted) {
    if (lifetimeSpendPaise >= tier.thresholdSpendPaise) {
      activeTier = tier;
    }
  }

  return activeTier;
}

/**
 * Calculates points earned on a bill payment.
 * Anti-abuse rules:
 * - Spend excluded: any portion paid or discounted via loyalty redemption.
 * - Multiplier: Tier multiplier applied.
 * - Minimum block size check: integer points only (Math.floor).
 */
export function calculateLoyaltyEarn(params: {
  billSubtotalPaise: number;
  netPaidPaise: number;
  loyaltyDiscountPaise: number;
  otherDiscountPaise: number;
  customerLifetimeSpendPaise: number;
  settings: LoyaltySettings;
}): EarnCalculationResult {
  const {
    billSubtotalPaise,
    netPaidPaise,
    loyaltyDiscountPaise,
    otherDiscountPaise,
    customerLifetimeSpendPaise,
    settings,
  } = params;

  if (!settings.enabled) {
    return {
      eligibleSpendPaise: 0,
      basePoints: 0,
      tierMultiplier: 1,
      earnedPoints: 0,
      tierName: 'Standard',
    };
  }

  // Determine eligible spend:
  // If earnOnDiscountedAmount is true: subtotal excluding loyalty discount
  // If false (default): netPaidPaise actually received (strictly excluding loyalty discount)
  let eligibleSpendPaise = 0;
  if (settings.earnOnDiscountedAmount) {
    eligibleSpendPaise = Math.max(0, billSubtotalPaise - loyaltyDiscountPaise);
  } else {
    eligibleSpendPaise = Math.max(0, netPaidPaise);
  }

  const activeTier = determineCustomerTier(customerLifetimeSpendPaise, settings.tiers);

  // E.g. spendPaisePerBlock = 10000 (₹100), pointsPerBlock = 5
  // For ₹1,200 (120000 paise): blocks = 12, basePoints = 12 * 5 = 60
  const blocks = Math.floor(eligibleSpendPaise / settings.spendPaisePerBlock);
  const basePoints = blocks * settings.pointsPerBlock;

  const earnedPoints = Math.floor(basePoints * (activeTier.earnMultiplier || 1));

  return {
    eligibleSpendPaise,
    basePoints,
    tierMultiplier: activeTier.earnMultiplier,
    earnedPoints,
    tierName: activeTier.name,
  };
}

/**
 * Calculates the maximum points and rupee discount a customer can redeem on a bill.
 * Limits:
 * - Customer's available points balance
 * - minRedeemPoints threshold
 * - maxRedeemPercentOfBill cap (e.g. max 50% of bill total)
 * - perDayRedeemCapPoints
 * - Stepped in integer blocks of redeemPointsBlock (e.g. 500 pts)
 */
export function calculateMaxRedeemable(params: {
  billTotalPaise: number;
  pointsBalance: number;
  pointsRedeemedToday?: number;
  accountAgeHours?: number;
  settings: LoyaltySettings;
}): {
  maxRedeemablePoints: number;
  maxRedeemablePaise: number;
  isEligible: boolean;
  ineligibleReason?: string;
} {
  const {
    billTotalPaise,
    pointsBalance,
    pointsRedeemedToday = 0,
    accountAgeHours = 999,
    settings,
  } = params;

  if (!settings.enabled) {
    return {
      maxRedeemablePoints: 0,
      maxRedeemablePaise: 0,
      isEligible: false,
      ineligibleReason: 'Loyalty program is currently disabled',
    };
  }

  // New account cooldown anti-abuse check
  if (accountAgeHours < settings.newAccountCooldownHours) {
    return {
      maxRedeemablePoints: 0,
      maxRedeemablePaise: 0,
      isEligible: false,
      ineligibleReason: `New account cooldown active. Redemptions allowed after ${settings.newAccountCooldownHours} hours of enrollment.`,
    };
  }

  // Minimum points check
  if (pointsBalance < settings.minRedeemPoints) {
    return {
      maxRedeemablePoints: 0,
      maxRedeemablePaise: 0,
      isEligible: false,
      ineligibleReason: `Minimum ${settings.minRedeemPoints} points required to redeem. Current balance: ${pointsBalance}`,
    };
  }

  // Max percent cap of bill total in paise
  const maxBillDiscountPaise = Math.floor((billTotalPaise * settings.maxRedeemPercentOfBill) / 100);

  // Available points under daily cap
  const remainingDailyPoints = Math.max(0, settings.perDayRedeemCapPoints - pointsRedeemedToday);
  const eligiblePointsByBalance = Math.min(pointsBalance, remainingDailyPoints);

  if (eligiblePointsByBalance < settings.redeemPointsBlock) {
    return {
      maxRedeemablePoints: 0,
      maxRedeemablePaise: 0,
      isEligible: false,
      ineligibleReason: `Daily redemption limit of ${settings.perDayRedeemCapPoints} points reached or insufficient block size.`,
    };
  }

  // Calculate points permitted by bill percentage cap
  // Each block gives redeemValuePaise (e.g. 500 pts -> 5000 paise = ₹50)
  const maxBlocksByBillCap = Math.floor(maxBillDiscountPaise / settings.redeemValuePaise);
  const maxPointsByBillCap = maxBlocksByBillCap * settings.redeemPointsBlock;

  // Max blocks allowed by customer points
  const maxBlocksByCustomer = Math.floor(eligiblePointsByBalance / settings.redeemPointsBlock);
  const maxPointsByCustomer = maxBlocksByCustomer * settings.redeemPointsBlock;

  const finalMaxPoints = Math.min(maxPointsByCustomer, maxPointsByBillCap);
  const finalMaxPaise = (finalMaxPoints / settings.redeemPointsBlock) * settings.redeemValuePaise;

  if (finalMaxPoints < settings.minRedeemPoints) {
    return {
      maxRedeemablePoints: 0,
      maxRedeemablePaise: 0,
      isEligible: false,
      ineligibleReason: `Bill amount is too low to redeem the minimum ${settings.minRedeemPoints} points block under the ${settings.maxRedeemPercentOfBill}% bill cap.`,
    };
  }

  return {
    maxRedeemablePoints: finalMaxPoints,
    maxRedeemablePaise: finalMaxPaise,
    isEligible: true,
  };
}

/**
 * Validates and converts requested points to rupee paise discount.
 */
export function validateAndConvertRedemption(params: {
  pointsToRedeem: number;
  billTotalPaise: number;
  pointsBalance: number;
  pointsRedeemedToday?: number;
  accountAgeHours?: number;
  settings: LoyaltySettings;
}): RedeemCalculationResult {
  const { pointsToRedeem, settings } = params;

  if (pointsToRedeem <= 0) {
    return {
      pointsToRedeem: 0,
      discountPaise: 0,
      isValid: false,
      error: 'Points must be positive',
    };
  }

  // Must be a multiple of redeemPointsBlock
  if (pointsToRedeem % settings.redeemPointsBlock !== 0) {
    return {
      pointsToRedeem,
      discountPaise: 0,
      isValid: false,
      error: `Points to redeem must be in multiples of ${settings.redeemPointsBlock}`,
    };
  }

  const maxCheck = calculateMaxRedeemable(params);
  if (!maxCheck.isEligible) {
    return {
      pointsToRedeem,
      discountPaise: 0,
      isValid: false,
      error: maxCheck.ineligibleReason || 'Not eligible for redemption',
    };
  }

  if (pointsToRedeem > maxCheck.maxRedeemablePoints) {
    return {
      pointsToRedeem,
      discountPaise: 0,
      isValid: false,
      error: `Requested points (${pointsToRedeem}) exceed maximum allowed (${maxCheck.maxRedeemablePoints})`,
    };
  }

  const blocks = pointsToRedeem / settings.redeemPointsBlock;
  const discountPaise = blocks * settings.redeemValuePaise;

  return {
    pointsToRedeem,
    discountPaise,
    isValid: true,
  };
}
