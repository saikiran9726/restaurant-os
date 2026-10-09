/**
 * Cash Reconciliation & End-of-Day Mathematics.
 *
 * All financial quantities are integer paise ($1\text{ INR} = 100\text{ paise}$).
 */

export interface CashReconciliationInput {
  openingCashPaise: number;
  cashSalesPaise: number;
  cashExpensesPaise: number;
  cashRefundsPaise?: number;
  actualCashPaise: number;
  tolerancePaise?: number; // default 0
}

export interface CashReconciliationResult {
  openingCashPaise: number;
  cashSalesPaise: number;
  cashExpensesPaise: number;
  cashRefundsPaise: number;
  expectedCashPaise: number;
  actualCashPaise: number;
  differencePaise: number; // actual - expected
  isExactMatch: boolean;
  isWithinTolerance: boolean;
  isShortage: boolean;
  isSurplus: boolean;
  hasMismatchWarning: boolean;
  tolerancePaise: number;
}

/**
 * Calculates expected closing cash in the till:
 * Expected = Opening Cash + Cash Sales - Cash Expenses - Cash Refunds
 */
export function calculateExpectedCash(params: {
  openingCashPaise: number;
  cashSalesPaise: number;
  cashExpensesPaise: number;
  cashRefundsPaise?: number;
}): number {
  const { openingCashPaise, cashSalesPaise, cashExpensesPaise, cashRefundsPaise = 0 } = params;
  return openingCashPaise + cashSalesPaise - cashExpensesPaise - cashRefundsPaise;
}

/**
 * Reconciles counted physical cash against expected till total.
 */
export function reconcileCash(input: CashReconciliationInput): CashReconciliationResult {
  const {
    openingCashPaise,
    cashSalesPaise,
    cashExpensesPaise,
    cashRefundsPaise = 0,
    actualCashPaise,
    tolerancePaise = 0,
  } = input;

  const expectedCashPaise = calculateExpectedCash({
    openingCashPaise,
    cashSalesPaise,
    cashExpensesPaise,
    cashRefundsPaise,
  });

  const differencePaise = actualCashPaise - expectedCashPaise;
  const isExactMatch = differencePaise === 0;
  const isWithinTolerance = Math.abs(differencePaise) <= tolerancePaise;

  return {
    openingCashPaise,
    cashSalesPaise,
    cashExpensesPaise,
    cashRefundsPaise,
    expectedCashPaise,
    actualCashPaise,
    differencePaise,
    isExactMatch,
    isWithinTolerance,
    isShortage: differencePaise < 0,
    isSurplus: differencePaise > 0,
    hasMismatchWarning: !isWithinTolerance,
    tolerancePaise,
  };
}

export const INDIAN_CURRENCY_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5] as const;
export type IndianDenomination = (typeof INDIAN_CURRENCY_DENOMINATIONS)[number];
export type CashDenominations = Partial<Record<IndianDenomination | string, number>>;

/**
 * Calculates total paise from currency denomination counts.
 * E.g. { "500": 10, "100": 4 } -> (10 * 50000) + (4 * 10000) = 540000 paise (₹5,400)
 */
export function calculateDenominationsTotalPaise(
  denominations: Partial<Record<IndianDenomination | string, number>>,
): number {
  let totalPaise = 0;
  for (const [denomStr, count] of Object.entries(denominations)) {
    const denomVal = parseInt(denomStr, 10);
    const denomCount = count ?? 0;
    if (!isNaN(denomVal) && denomVal > 0 && denomCount > 0) {
      totalPaise += denomVal * 100 * denomCount;
    }
  }
  return totalPaise;
}
