import { describe, it, expect } from 'vitest';
import { decomposeSalesChange } from './decomposition.js';

describe('Sales Decomposition Engine (Orders vs AOV vs Mix)', () => {
  it('mathematically decomposes sales changes where components sum identically to total change', () => {
    // Example: Baseline = 100 orders @ Rs 500 = Rs 50,000 (5,000,000 paise)
    // Current = 111 orders @ Rs 513.51 = Rs 57,000 (5,700,000 paise) (+14% sales)
    const result = decomposeSalesChange({
      baselineSalesPaise: 5000000,
      baselineOrdersCount: 100,
      currentSalesPaise: 5700000,
      currentOrdersCount: 111,
    });

    expect(result.totalChangePaise).toBe(700000);
    expect(result.totalChangePercent).toBe(14);

    // Invariant 1: Sum of paise contributions equals total change paise
    const sumPaise =
      result.ordersContributionPaise + result.aovContributionPaise + result.mixContributionPaise;
    expect(Math.abs(sumPaise - result.totalChangePaise)).toBeLessThanOrEqual(1);

    // Invariant 2: Sum of percent contributions equals total change percent
    const sumPercent =
      result.ordersContributionPercent +
      result.aovContributionPercent +
      result.mixContributionPercent;
    expect(Math.abs(sumPercent - result.totalChangePercent)).toBeLessThanOrEqual(0.2);

    expect(result.plainEnglishExplanation).toContain('Sales up 14.0%');
    expect(result.plainEnglishExplanation).toContain('more orders');
  });

  it('handles decline driven by lower order volume', () => {
    // Baseline = 200 orders @ Rs 800 = Rs 1,60,000
    // Current = 160 orders @ Rs 800 = Rs 1,28,000 (-20% sales)
    const result = decomposeSalesChange({
      baselineSalesPaise: 16000000,
      baselineOrdersCount: 200,
      currentSalesPaise: 12800000,
      currentOrdersCount: 160,
    });

    expect(result.totalChangePercent).toBe(-20);
    expect(result.ordersContributionPercent).toBe(-20);
    expect(result.aovContributionPercent).toBe(0);
    expect(result.mixContributionPercent).toBe(0);
    expect(result.plainEnglishExplanation).toContain('Sales down 20.0%');
    expect(result.plainEnglishExplanation).toContain('fewer orders');
  });

  it('handles insufficient data gracefully without crashing or fabricating', () => {
    const result = decomposeSalesChange({
      baselineSalesPaise: 0,
      baselineOrdersCount: 0,
      currentSalesPaise: 50000,
      currentOrdersCount: 10,
    });

    expect(result.ordersContributionPaise).toBe(0);
    expect(result.plainEnglishExplanation).toContain('Insufficient baseline');
  });
});
