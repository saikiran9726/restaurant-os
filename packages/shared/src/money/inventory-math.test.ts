import { describe, it, expect } from 'vitest';
import {
  calculateWeightedAverageCostPaise,
  calculateLinePricing,
  calculateWasteCostPaise,
  calculateStockCountVariance,
} from './inventory-math.js';

describe('Inventory Mathematics & Costing Calculations', () => {
  describe('Weighted-Average Cost Calculation', () => {
    it('sets average cost to purchase unit price when previous stock is zero', () => {
      // Rice: 0 kg existing, buys 50 kg for ₹2,500 (₹50/kg = 5,000 paise)
      const avgCost = calculateWeightedAverageCostPaise({
        currentStock: 0,
        currentAvgCostPaisePerUnit: 0,
        purchaseQuantity: 50,
        purchaseTotalPaise: 250000,
      });

      expect(avgCost).toBe(5000); // 5000 paise = ₹50.00
    });

    it('computes weighted-average cost correctly across multiple restocks', () => {
      // Existing: 50 kg at ₹50/kg (5,000 paise) -> Value = 250,000 paise
      // New purchase: 50 kg at ₹60/kg (6,000 paise) -> Value = 300,000 paise
      // Total stock = 100 kg, Total value = 550,000 paise
      // Expected new avg cost = 5,500 paise (₹55/kg)
      const avgCost = calculateWeightedAverageCostPaise({
        currentStock: 50,
        currentAvgCostPaisePerUnit: 5000,
        purchaseQuantity: 50,
        purchaseTotalPaise: 300000,
      });

      expect(avgCost).toBe(5500);
    });

    it('handles decimal quantities accurately', () => {
      // 12.5 kg at ₹100/kg (10,000 paise) = 125,000 paise
      // Purchases 7.5 kg for ₹600 (60,000 paise)
      // Total: 20 kg for 185,000 paise -> Avg cost = 9,250 paise (₹92.50/kg)
      const avgCost = calculateWeightedAverageCostPaise({
        currentStock: 12.5,
        currentAvgCostPaisePerUnit: 10000,
        purchaseQuantity: 7.5,
        purchaseTotalPaise: 60000,
      });

      expect(avgCost).toBe(9250);
    });
  });

  describe('Line Pricing Bidirectional Calculation', () => {
    it('computes unit price from quantity and total price', () => {
      // 50 kg for ₹2,500 (250,000 paise)
      const pricing = calculateLinePricing({
        quantity: 50,
        lineTotalPaise: 250000,
      });

      expect(pricing.unitPricePaise).toBe(5000);
      expect(pricing.lineTotalPaise).toBe(250000);
    });

    it('computes total price from quantity and unit price', () => {
      // 25 kg at ₹45/kg (4,500 paise)
      const pricing = calculateLinePricing({
        quantity: 25,
        unitPricePaise: 4500,
      });

      expect(pricing.lineTotalPaise).toBe(112500); // ₹1,125
      expect(pricing.unitPricePaise).toBe(4500);
    });
  });

  describe('Waste Cost Calculation', () => {
    it('calculates waste cost from average unit cost', () => {
      // 2 kg spoilt at avg cost ₹50/kg (5,000 paise)
      const wasteCost = calculateWasteCostPaise(2, 5000);
      expect(wasteCost).toBe(10000); // ₹100
    });
  });

  describe('Stock Count Variance Calculation', () => {
    it('computes shortage variance correctly', () => {
      // Expected stock was 50 kg, counted is 42 kg -> shortage of 8 kg
      const result = calculateStockCountVariance({
        previousStock: 50,
        countedStock: 42,
      });

      expect(result.variance).toBe(-8);
      expect(result.isShortage).toBe(true);
      expect(result.isSurplus).toBe(false);
    });

    it('computes surplus variance correctly', () => {
      // Expected stock was 10 kg, counted is 12.5 kg -> surplus of 2.5 kg
      const result = calculateStockCountVariance({
        previousStock: 10,
        countedStock: 12.5,
      });

      expect(result.variance).toBe(2.5);
      expect(result.isShortage).toBe(false);
      expect(result.isSurplus).toBe(true);
    });
  });
});
