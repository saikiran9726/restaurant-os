import { z } from 'zod';
import { HEALTH_FACTOR_IDS } from '../health/health-types.js';

export const healthWeightsSchema = z
  .object({
    sales_performance: z.number().min(0).max(100),
    profitability: z.number().min(0).max(100),
    customer_retention: z.number().min(0).max(100),
    food_cost: z.number().min(0).max(100),
    inventory_efficiency: z.number().min(0).max(100),
    waste: z.number().min(0).max(100),
    kitchen_efficiency: z.number().min(0).max(100),
    payment_reconciliation: z.number().min(0).max(100),
  })
  .refine(
    (weights) => {
      const sum =
        weights.sales_performance +
        weights.profitability +
        weights.customer_retention +
        weights.food_cost +
        weights.inventory_efficiency +
        weights.waste +
        weights.kitchen_efficiency +
        weights.payment_reconciliation;
      return Math.abs(sum - 100) < 0.1;
    },
    {
      message: 'All 8 factor weights must sum exactly to 100%',
    },
  );

export const healthTargetsSchema = z.object({
  salesGrowthPercent: z.number().min(-50).max(100).default(10),
  targetMarginPercent: z.number().min(1).max(80).default(20),
  repeatRatePercent: z.number().min(5).max(100).default(40),
  targetFoodCostPercent: z.number().min(10).max(60).default(32),
  inStockTargetPercent: z.number().min(50).max(100).default(90),
  targetWastePercent: z.number().min(0.5).max(20).default(3),
  kitchenOnTimePercent: z.number().min(50).max(100).default(85),
  paymentCleanPercent: z.number().min(70).max(100).default(95),
});

export const updateHealthModelSchema = z.object({
  windowDays: z.number().int().min(7).max(90).default(30),
  weights: healthWeightsSchema,
  targets: healthTargetsSchema,
});

export type UpdateHealthModelInput = z.infer<typeof updateHealthModelSchema>;

export const recomputeHealthScoreSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
});

export type RecomputeHealthScoreInput = z.infer<typeof recomputeHealthScoreSchema>;
