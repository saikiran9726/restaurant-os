import { describe, it, expect } from 'vitest';
import { getBusinessDate, shiftBusinessDays, getBusinessDateRange } from './business-date.js';
import {
  calculateExpectedCash,
  reconcileCash,
  calculateDenominationsTotalPaise,
} from './eod-math.js';
import { generateSalesInsights } from '../analytics/insights-engine.js';

describe('Business Date Logic', () => {
  it('correctly maps timestamps across the 05:00 AM boundary to business dates', () => {
    // In Asia/Kolkata (UTC +5:30):
    // 2026-10-09 04:59:00 IST is 2026-10-08 23:29:00 UTC
    const beforeCutoff = new Date('2026-10-08T23:29:00.000Z');
    expect(getBusinessDate(beforeCutoff, 5, 'Asia/Kolkata')).toBe('2026-10-08');

    // 2026-10-09 05:00:00 IST is 2026-10-08 23:30:00 UTC
    const atCutoff = new Date('2026-10-08T23:30:00.000Z');
    expect(getBusinessDate(atCutoff, 5, 'Asia/Kolkata')).toBe('2026-10-09');

    // 2026-10-09 23:59:00 IST is 2026-10-09 18:29:00 UTC
    const lateNight = new Date('2026-10-09T18:29:00.000Z');
    expect(getBusinessDate(lateNight, 5, 'Asia/Kolkata')).toBe('2026-10-09');

    // 2026-10-10 02:30:00 IST is 2026-10-09 21:00:00 UTC
    const postMidnight = new Date('2026-10-09T21:00:00.000Z');
    expect(getBusinessDate(postMidnight, 5, 'Asia/Kolkata')).toBe('2026-10-09');
  });

  it('correctly shifts business dates', () => {
    expect(shiftBusinessDays('2026-10-09', -1)).toBe('2026-10-08');
    expect(shiftBusinessDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftBusinessDays('2026-10-09', 7)).toBe('2026-10-16');
  });

  it('resolves date ranges correctly', () => {
    const fixedNow = new Date('2026-10-09T08:00:00.000Z'); // 13:30 IST on Oct 9
    const todayRange = getBusinessDateRange('today', { now: fixedNow });
    expect(todayRange.startDate).toBe('2026-10-09');
    expect(todayRange.endDate).toBe('2026-10-09');
    expect(todayRange.isSingleDay).toBe(true);

    const weeklyRange = getBusinessDateRange('weekly', { now: fixedNow });
    expect(weeklyRange.endDate).toBe('2026-10-09');
    expect(weeklyRange.startDate).toBe('2026-10-03');
    expect(weeklyRange.daysCount).toBe(7);
  });
});

describe('Cash Reconciliation Engine', () => {
  it('reproduces user acceptance criteria: opening ₹5,000, cash sales ₹18,400, cash expenses ₹2,000 -> expected ₹21,400; actual ₹20,900 -> mismatch ₹500', () => {
    const openingCashPaise = 500000; // ₹5,000
    const cashSalesPaise = 1840000; // ₹18,400
    const cashExpensesPaise = 200000; // ₹2,000
    const actualCashPaise = 2090000; // ₹20,900

    const expected = calculateExpectedCash({
      openingCashPaise,
      cashSalesPaise,
      cashExpensesPaise,
    });
    expect(expected).toBe(2140000); // ₹21,400

    const result = reconcileCash({
      openingCashPaise,
      cashSalesPaise,
      cashExpensesPaise,
      actualCashPaise,
      tolerancePaise: 0,
    });

    expect(result.expectedCashPaise).toBe(2140000);
    expect(result.actualCashPaise).toBe(2090000);
    expect(result.differencePaise).toBe(-50000); // -₹500 shortage
    expect(result.isShortage).toBe(true);
    expect(result.isSurplus).toBe(false);
    expect(result.hasMismatchWarning).toBe(true);
    expect(result.isExactMatch).toBe(false);
  });

  it('tolerates small discrepancies when within configured tolerance', () => {
    const result = reconcileCash({
      openingCashPaise: 500000,
      cashSalesPaise: 100000,
      cashExpensesPaise: 0,
      actualCashPaise: 599000, // ₹10 difference (1000 paise)
      tolerancePaise: 1500, // ₹15 tolerance
    });

    expect(result.differencePaise).toBe(-1000);
    expect(result.isWithinTolerance).toBe(true);
    expect(result.hasMismatchWarning).toBe(false);
  });

  it('accurately counts denomination totals', () => {
    const totalPaise = calculateDenominationsTotalPaise({
      500: 20, // 10,000
      200: 10, // 2,000
      100: 15, // 1,500
      50: 8, // 400
      20: 5, // 100
      10: 10, // 100
    });
    // 10000 + 2000 + 1500 + 400 + 100 + 100 = ₹14,100 = 1,410,000 paise
    expect(totalPaise).toBe(1410000);
  });
});

describe('Deterministic Insights Engine', () => {
  it('suppresses insights and indicates insufficient data when sample size < 4', () => {
    const insights = generateSalesInsights({
      currentDay: {
        businessDate: '2026-10-09',
        weekday: 'Friday',
        netSalesPaise: 4500000,
        grossSalesPaise: 4800000,
        ordersCount: 95,
        aovPaise: 47368,
      },
      historicalSameWeekdays: [
        { businessDate: '2026-10-02', weekday: 'Friday', netSalesPaise: 3800000, ordersCount: 80 },
        { businessDate: '2026-09-25', weekday: 'Friday', netSalesPaise: 3900000, ordersCount: 82 },
      ], // Only 2 past Fridays!
    });

    const weekdayInsight = insights.find((i) => i.type === 'weekday_comparison');
    expect(weekdayInsight).toBeDefined();
    expect(weekdayInsight!.hasEnoughData).toBe(false);
    expect(weekdayInsight!.headline).toContain('Not enough data yet');
  });

  it('emits a plain-English comparison when >= 4 historical data points exist and threshold is exceeded', () => {
    const insights = generateSalesInsights({
      currentDay: {
        businessDate: '2026-10-09',
        weekday: 'Friday',
        netSalesPaise: 4500000, // ₹45,000
        grossSalesPaise: 4800000,
        ordersCount: 95,
        aovPaise: 47368,
      },
      historicalSameWeekdays: [
        { businessDate: '2026-10-02', weekday: 'Friday', netSalesPaise: 3800000, ordersCount: 80 },
        { businessDate: '2026-09-25', weekday: 'Friday', netSalesPaise: 3900000, ordersCount: 82 },
        { businessDate: '2026-09-18', weekday: 'Friday', netSalesPaise: 3750000, ordersCount: 78 },
        { businessDate: '2026-09-11', weekday: 'Friday', netSalesPaise: 3850000, ordersCount: 81 },
      ], // 4 past Fridays, avg = 3,825,000 paise (~₹38,250)
      paymentMix: [
        { method: 'upi', amountPaise: 3000000, count: 65 },
        { method: 'cash', amountPaise: 1500000, count: 30 },
      ],
    });

    const weekdayInsight = insights.find((i) => i.type === 'weekday_comparison');
    expect(weekdayInsight).toBeDefined();
    expect(weekdayInsight!.hasEnoughData).toBe(true);
    expect(weekdayInsight!.headline).toContain(
      'Friday sales are 18% higher than your 4-week Friday average',
    );
    expect(weekdayInsight!.underlyingNumbers.current).toBe(4500000);
    expect(weekdayInsight!.underlyingNumbers.baseline).toBe(3825000);

    const paymentInsight = insights.find((i) => i.type === 'payment_mix');
    expect(paymentInsight).toBeDefined();
    expect(paymentInsight!.headline).toContain('UPI accounted for 67% of total settlements');
  });
});
