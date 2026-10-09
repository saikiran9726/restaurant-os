import { describe, it, expect } from 'vitest';
import {
  computeSalesScore,
  computeProfitabilityScore,
  computeRetentionScore,
  computeFoodCostScore,
  computeInventoryScore,
  computeWasteScore,
  computeKitchenScore,
  computePaymentScore,
  evaluateHealthScore,
  type RawHealthInputs,
} from './health-engine.js';
import { DEFAULT_HEALTH_WEIGHTS, DEFAULT_HEALTH_TARGETS } from './health-types.js';

describe('Restaurant Health Score Engine', () => {
  describe('Individual Factor Formulas & Boundaries', () => {
    it('Sales performance: 100 at >= +10%, 50 at flat (0%), 0 at <= -20%', () => {
      expect(computeSalesScore(15, 10)).toBe(100);
      expect(computeSalesScore(10, 10)).toBe(100);
      expect(computeSalesScore(5, 10)).toBe(75);
      expect(computeSalesScore(0, 10)).toBe(50);
      expect(computeSalesScore(-10, 10)).toBe(25);
      expect(computeSalesScore(-20, 10)).toBe(0);
      expect(computeSalesScore(-35, 10)).toBe(0);
      expect(computeSalesScore(null, 10)).toBe(0);
    });

    it('Profitability: 100 at >= 20% margin, 0 at <= 0%, linear in between', () => {
      expect(computeProfitabilityScore(25, 20)).toBe(100);
      expect(computeProfitabilityScore(20, 20)).toBe(100);
      expect(computeProfitabilityScore(10, 20)).toBe(50);
      expect(computeProfitabilityScore(15, 20)).toBe(75);
      expect(computeProfitabilityScore(0, 20)).toBe(0);
      expect(computeProfitabilityScore(-5, 20)).toBe(0);
      expect(computeProfitabilityScore(null, 20)).toBe(0);
    });

    it('Customer retention: 100 at >= 40% repeat rate, linear to 0%', () => {
      expect(computeRetentionScore(50, 40)).toBe(100);
      expect(computeRetentionScore(40, 40)).toBe(100);
      expect(computeRetentionScore(20, 40)).toBe(50);
      expect(computeRetentionScore(0, 40)).toBe(0);
      expect(computeRetentionScore(null, 40)).toBe(0);
    });

    it('Food/supply cost: lower is better, 100 at <= 32%, 0 at >= 47%', () => {
      expect(computeFoodCostScore(28, 32)).toBe(100);
      expect(computeFoodCostScore(32, 32)).toBe(100);
      expect(computeFoodCostScore(35, 32)).toBe(80); // 100 - (3/15)*100 = 80
      expect(computeFoodCostScore(39.5, 32)).toBe(50); // 100 - (7.5/15)*100 = 50
      expect(computeFoodCostScore(47, 32)).toBe(0);
      expect(computeFoodCostScore(52, 32)).toBe(0);
      expect(computeFoodCostScore(null, 32)).toBe(0);
    });

    it('Inventory efficiency: 100 at >= 90% in-stock, degrades to 0 at <= 50%', () => {
      expect(computeInventoryScore(95, 90, 0)).toBe(100);
      expect(computeInventoryScore(90, 90, 0)).toBe(100);
      expect(computeInventoryScore(70, 90, 0)).toBe(50); // (20/40)*100 = 50
      expect(computeInventoryScore(50, 90, 0)).toBe(0);
      expect(computeInventoryScore(40, 90, 0)).toBe(0);

      // Audit variance penalty: > 5% variance deducts 2 pts per %
      expect(computeInventoryScore(90, 90, 8)).toBe(94); // 100 - (8-5)*2 = 94
      expect(computeInventoryScore(null, 90, 0)).toBe(0);
    });

    it('Waste: lower is better, 100 at <= 3%, 0 at >= 10%', () => {
      expect(computeWasteScore(2, 3)).toBe(100);
      expect(computeWasteScore(3, 3)).toBe(100);
      expect(computeWasteScore(6.5, 3)).toBe(50); // 100 - (3.5/7)*100 = 50
      expect(computeWasteScore(10, 3)).toBe(0);
      expect(computeWasteScore(14, 3)).toBe(0);
      expect(computeWasteScore(null, 3)).toBe(0);
    });

    it('Kitchen efficiency: 100 at >= 85% on-time, 0 at <= 50%', () => {
      expect(computeKitchenScore(90, 85)).toBe(100);
      expect(computeKitchenScore(85, 85)).toBe(100);
      expect(computeKitchenScore(67.5, 85)).toBe(50); // (17.5/35)*100 = 50
      expect(computeKitchenScore(50, 85)).toBe(0);
      expect(computeKitchenScore(40, 85)).toBe(0);
      expect(computeKitchenScore(null, 85)).toBe(0);
    });

    it('Payment reconciliation: 100 at >= 95% clean, 0 at <= 75%', () => {
      expect(computePaymentScore(98, 95)).toBe(100);
      expect(computePaymentScore(95, 95)).toBe(100);
      expect(computePaymentScore(85, 95)).toBe(50); // (10/20)*100 = 50
      expect(computePaymentScore(75, 95)).toBe(0);
      expect(computePaymentScore(60, 95)).toBe(0);
      expect(computePaymentScore(null, 95)).toBe(0);
    });
  });

  describe('Golden Test: Reproducible Comprehensive Evaluation', () => {
    const goldenInputs: RawHealthInputs = {
      sales: {
        hasData: true,
        currentWindowNetRevenuePaise: 62000000, // ₹6,20,000
        previousWindowNetRevenuePaise: 55000000, // ₹5,50,000 (+12.7% growth -> 100)
        daysWithSalesCount: 28,
      },
      profitability: {
        hasData: true,
        revenuePaise: 62000000,
        operatingExpensesPaise: 14300000,
        suppliesCostPaise: 21000000,
        estimatedMarginPercent: 43.1, // >= 20% -> 100
      },
      retention: {
        hasData: true,
        activeCustomersCount: 100,
        repeatCustomersCount: 30, // 30% / 40% target -> 75 score
        repeatRatePercent: 30,
      },
      foodCost: {
        hasData: true,
        revenuePaise: 62000000,
        suppliesCostPaise: 21000000,
        suppliesPercentOfRevenue: 33.87, // 33.87% vs 32% target -> 88 score
      },
      inventory: {
        hasData: true,
        totalActiveItems: 50,
        lowOrOutOfStockItems: 5, // 45/50 in stock = 90% -> 100 score
        inStockPercent: 90,
        avgAuditVariancePercent: 2,
      },
      waste: {
        hasData: true,
        wasteCostPaise: 420000,
        suppliesCostPaise: 21000000,
        wastePercentOfSupplies: 2.0, // <= 3% -> 100 score
      },
      kitchen: {
        hasData: true,
        totalKotsCount: 200,
        onTimeKotsCount: 160,
        onTimePercent: 80.0, // (80 - 50)/(85 - 50)*100 = 30/35*100 = 86 score
      },
      payment: {
        hasData: true,
        totalBillsCount: 250,
        cleanBillsCount: 245,
        closedDaysCount: 28,
        matchedCashDaysCount: 27,
        reconciliationScorePercent: 97.0, // >= 95% -> 100 score
      },
    };

    it('evaluates all 8 factors cleanly with high confidence', () => {
      const result = evaluateHealthScore({
        inputs: goldenInputs,
        weights: DEFAULT_HEALTH_WEIGHTS,
        targets: DEFAULT_HEALTH_TARGETS,
      });

      expect(result.isSufficientData).toBe(true);
      expect(result.factorsUsedCount).toBe(8);
      expect(result.totalFactorsCount).toBe(8);
      expect(result.confidence).toBe('high');
      expect(result.scoreBand).toBe('strong');
      expect(result.overallScore).toBeGreaterThanOrEqual(80);
      expect(result.overallScore).toBeLessThanOrEqual(100);

      // Verify each factor has correct normalized weight summing to 100
      const totalNormalizedWeight = result.factors.reduce((sum, f) => sum + f.normalizedWeight, 0);
      expect(Math.round(totalNormalizedWeight)).toBe(100);

      // Verify hand-reproducible contribution points sum
      const totalContribution = result.factors.reduce((sum, f) => sum + f.contributionPoints, 0);
      expect(Math.round(totalContribution)).toBe(result.overallScore);
    });
  });

  describe('Missing Data Rule & Weight Renormalisation', () => {
    it('renormalises remaining weights when 2 factors lack data', () => {
      const partialInputs: RawHealthInputs = {
        sales: {
          hasData: true,
          currentWindowNetRevenuePaise: 50000000,
          previousWindowNetRevenuePaise: 50000000, // flat -> 50
          daysWithSalesCount: 15,
        },
        profitability: {
          hasData: true,
          revenuePaise: 50000000,
          operatingExpensesPaise: 15000000,
          suppliesCostPaise: 15000000,
          estimatedMarginPercent: 40, // 100
        },
        retention: {
          hasData: false, // EXCLUDED
          activeCustomersCount: 0,
          repeatCustomersCount: 0,
          repeatRatePercent: null,
        },
        foodCost: {
          hasData: true,
          revenuePaise: 50000000,
          suppliesCostPaise: 15000000,
          suppliesPercentOfRevenue: 30, // 100
        },
        inventory: {
          hasData: false, // EXCLUDED
          totalActiveItems: 0,
          lowOrOutOfStockItems: 0,
          inStockPercent: null,
          avgAuditVariancePercent: 0,
        },
        waste: {
          hasData: true,
          wasteCostPaise: 150000,
          suppliesCostPaise: 15000000,
          wastePercentOfSupplies: 1.0, // 100
        },
        kitchen: {
          hasData: true,
          totalKotsCount: 50,
          onTimeKotsCount: 45,
          onTimePercent: 90, // 100
        },
        payment: {
          hasData: true,
          totalBillsCount: 100,
          cleanBillsCount: 98,
          closedDaysCount: 15,
          matchedCashDaysCount: 15,
          reconciliationScorePercent: 98, // 100
        },
      };

      const result = evaluateHealthScore({
        inputs: partialInputs,
      });

      expect(result.factorsUsedCount).toBe(6);
      expect(result.factors.find((f) => f.id === 'customer_retention')?.isIncluded).toBe(false);
      expect(result.factors.find((f) => f.id === 'inventory_efficiency')?.isIncluded).toBe(false);

      // Remaining weights: 15 (sales) + 20 (profit) + 15 (food) + 8 (waste) + 10 (kitchen) + 12 (payment) = 80
      // Normalization should scale them to sum to 100
      const activeFactors = result.factors.filter((f) => f.isIncluded);
      const totalNormalized = activeFactors.reduce((sum, f) => sum + f.normalizedWeight, 0);
      expect(Math.round(totalNormalized)).toBe(100);

      // Hand-verifiable overall score matches contribution sum
      const contributionSum = activeFactors.reduce((sum, f) => sum + f.contributionPoints, 0);
      expect(Math.round(contributionSum)).toBe(result.overallScore);
    });

    it('returns isSufficientData=false when under minimum data requirements', () => {
      const insufficientInputs: RawHealthInputs = {
        sales: {
          hasData: false,
          currentWindowNetRevenuePaise: 0,
          previousWindowNetRevenuePaise: 0,
          daysWithSalesCount: 0,
        },
        profitability: {
          hasData: false,
          revenuePaise: 0,
          operatingExpensesPaise: 0,
          suppliesCostPaise: 0,
          estimatedMarginPercent: null,
        },
        retention: {
          hasData: false,
          activeCustomersCount: 0,
          repeatCustomersCount: 0,
          repeatRatePercent: null,
        },
        foodCost: {
          hasData: false,
          revenuePaise: 0,
          suppliesCostPaise: 0,
          suppliesPercentOfRevenue: null,
        },
        inventory: {
          hasData: false,
          totalActiveItems: 0,
          lowOrOutOfStockItems: 0,
          inStockPercent: null,
          avgAuditVariancePercent: 0,
        },
        waste: {
          hasData: false,
          wasteCostPaise: 0,
          suppliesCostPaise: 0,
          wastePercentOfSupplies: null,
        },
        kitchen: { hasData: false, totalKotsCount: 0, onTimeKotsCount: 0, onTimePercent: null },
        payment: {
          hasData: false,
          totalBillsCount: 0,
          cleanBillsCount: 0,
          closedDaysCount: 0,
          matchedCashDaysCount: 0,
          reconciliationScorePercent: null,
        },
      };

      const result = evaluateHealthScore({
        inputs: insufficientInputs,
      });

      expect(result.isSufficientData).toBe(false);
      expect(result.overallScore).toBeNull();
      expect(result.scoreBand).toBe('insufficient_data');
      expect(result.insufficientDataReason).toContain('Not enough data yet');
    });
  });

  describe('Delta Attribution vs Previous Snapshot', () => {
    it('accurately attributes score change across factors', () => {
      const inputs1: RawHealthInputs = {
        sales: {
          hasData: true,
          currentWindowNetRevenuePaise: 100000,
          previousWindowNetRevenuePaise: 100000,
          daysWithSalesCount: 15,
        },
        profitability: {
          hasData: true,
          revenuePaise: 100000,
          operatingExpensesPaise: 20000,
          suppliesCostPaise: 30000,
          estimatedMarginPercent: 20,
        },
        retention: {
          hasData: true,
          activeCustomersCount: 50,
          repeatCustomersCount: 20,
          repeatRatePercent: 40,
        },
        foodCost: {
          hasData: true,
          revenuePaise: 100000,
          suppliesCostPaise: 32000,
          suppliesPercentOfRevenue: 32,
        },
        inventory: {
          hasData: true,
          totalActiveItems: 20,
          lowOrOutOfStockItems: 2,
          inStockPercent: 90,
          avgAuditVariancePercent: 0,
        },
        waste: {
          hasData: true,
          wasteCostPaise: 500,
          suppliesCostPaise: 32000,
          wastePercentOfSupplies: 1.5,
        },
        kitchen: { hasData: true, totalKotsCount: 40, onTimeKotsCount: 35, onTimePercent: 87.5 },
        payment: {
          hasData: true,
          totalBillsCount: 60,
          cleanBillsCount: 58,
          closedDaysCount: 15,
          matchedCashDaysCount: 15,
          reconciliationScorePercent: 96,
        },
      };

      const snapshot1 = evaluateHealthScore({ inputs: inputs1 });

      // In snapshot 2, food cost worsens (from 32% to 41%)
      const inputs2: RawHealthInputs = {
        ...inputs1,
        foodCost: {
          hasData: true,
          revenuePaise: 100000,
          suppliesCostPaise: 41000,
          suppliesPercentOfRevenue: 41, // degrades score from 100 to 40 (delta -9 points on 15 weight)
        },
      };

      const snapshot2 = evaluateHealthScore({
        inputs: inputs2,
        previousSnapshotFactorScores: snapshot1.factors,
      });

      expect(snapshot2.overallScore).toBeLessThan(snapshot1.overallScore!);
      expect(snapshot2.reasonsForChange.length).toBeGreaterThan(0);

      const foodCostReason = snapshot2.reasonsForChange.find((r) => r.factorId === 'food_cost');
      expect(foodCostReason).toBeDefined();
      expect(foodCostReason!.deltaPoints).toBeLessThan(0);
      expect(foodCostReason!.explanation).toContain('Food & Supply Cost');

      // Top suggestion points to purchases
      expect(snapshot2.suggestions.some((s) => s.actionUrl === '/owner/purchases')).toBe(true);
    });
  });
});
