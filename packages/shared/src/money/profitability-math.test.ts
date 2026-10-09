import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyProfitability,
  calculateCostOfSupplies,
  explainMonthComparison,
} from './profitability-math.js';

describe('Monthly Profitability & Financial Math Engine', () => {
  it('reproduces exact user acceptance criteria: Revenue ₹6,20,000, supplies ₹2,10,000, expenses ₹1,43,000 -> ₹2,67,000', () => {
    // 6,20,000 INR = 62,000,000 paise
    // 2,10,000 INR = 21,000,000 paise
    // 1,43,000 INR = 14,300,000 paise
    // Expected Profit = 26,700,000 paise (₹2,67,000)
    const result = calculateMonthlyProfitability({
      netSalesPaise: 62000000,
      monthPurchasesPaise: 21000000,
      operatingExpensesPaise: 14300000,
      hasOpeningAndClosingCounts: false,
    });

    expect(result.revenuePaise).toBe(62000000);
    expect(result.suppliesCostPaise).toBe(21000000);
    expect(result.operatingExpensesPaise).toBe(14300000);
    expect(result.estimatedProfitPaise).toBe(26700000); // Exactly ₹2,67,000
    // Margin: 26,700,000 / 62,000,000 = 43.1%
    expect(result.profitMarginPercent).toBe(43.1);
    expect(result.suppliesPercentOfRevenue).toBe(33.9);
    expect(result.expensesPercentOfRevenue).toBe(23.1);
  });

  describe('Cost of Supplies Methods', () => {
    it('uses consumption-based method when opening and closing counts exist', () => {
      // Opening stock: ₹50,000, Purchases: ₹2,10,000, Closing stock: ₹40,000
      // Consumption = 50,000 + 2,10,000 - 40,000 = ₹2,20,000
      const calc = calculateCostOfSupplies({
        method: 'consumption',
        openingStockValuePaise: 5000000,
        monthPurchasesPaise: 21000000,
        closingStockValuePaise: 4000000,
        hasOpeningAndClosingCounts: true,
      });

      expect(calc.method).toBe('consumption');
      expect(calc.suppliesCostPaise).toBe(22000000);
      expect(calc.reason).toContain('Consumption-based');
    });

    it('falls back to purchase-based method when boundaries are missing', () => {
      const calc = calculateCostOfSupplies({
        method: 'purchases',
        monthPurchasesPaise: 21000000,
        hasOpeningAndClosingCounts: false,
      });

      expect(calc.method).toBe('purchases');
      expect(calc.suppliesCostPaise).toBe(21000000);
      expect(calc.reason).toContain('Purchase-based');
    });
  });

  describe('Edge Cases & Division by Zero', () => {
    it('handles zero revenue safely without NaN or division by zero', () => {
      const result = calculateMonthlyProfitability({
        netSalesPaise: 0,
        monthPurchasesPaise: 500000,
        operatingExpensesPaise: 100000,
        hasOpeningAndClosingCounts: false,
      });

      expect(result.revenuePaise).toBe(0);
      expect(result.estimatedProfitPaise).toBe(-600000);
      expect(result.profitMarginPercent).toBeNull();
      expect(result.suppliesPercentOfRevenue).toBeNull();
    });
  });

  describe('Plain-English Comparison Explanation', () => {
    it('explains margin drop due to rising supply costs', () => {
      const explanation = explainMonthComparison({
        currentProfitPaise: 20000000,
        currentMarginPercent: 30.9,
        currentSuppliesPercent: 34.0,
        currentExpensesPercent: 25.0,
        prevProfitPaise: 25000000,
        prevMarginPercent: 34.0,
        prevSuppliesPercent: 31.0,
        prevExpensesPercent: 25.0,
      });

      expect(explanation).toContain('Margin fell 3.1 points');
      expect(explanation).toContain('supply cost rose from 31% to 34% of revenue');
    });
  });
});
