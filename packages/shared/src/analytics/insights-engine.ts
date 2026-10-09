/**
 * Plain-English Deterministic Analytics Insights Engine (No LLM).
 *
 * Generates verified, reproducible, mathematical observations comparing
 * current metrics against historical baselines and peer periods.
 */

import { formatPaiseToRupeeString } from '../money/index.js';

export interface InsightCardData {
  id: string;
  type: 'weekday_comparison' | 'period_trend' | 'payment_mix' | 'category_lead' | 'peak_hour';
  tone: 'positive' | 'negative' | 'neutral' | 'highlight';
  headline: string;
  detail: string;
  hasEnoughData: boolean;
  sampleSize: number;
  changePercent?: number;
  underlyingNumbers: {
    current: number;
    baseline: number;
    unit: 'currency' | 'percent' | 'count';
    details: Record<string, any>;
  };
}

export interface DaySalesComparisonPoint {
  businessDate: string;
  weekday: string;
  netSalesPaise: number;
  ordersCount: number;
}

export interface HourlySalesPoint {
  hour: number; // 0-23
  netSalesPaise: number;
  ordersCount: number;
}

export interface PaymentBreakupPoint {
  method: string;
  amountPaise: number;
  count: number;
}

export interface CategoryBreakupPoint {
  name: string;
  revenuePaise: number;
  quantity: number;
}

/**
 * Generates deterministic insights from sales analytics data.
 *
 * Enforces strict sample-size guards: requires minimum 4 data points for historical
 * comparisons. When data is insufficient, emits an explicit "Not enough data yet"
 * state without guessing.
 */
export function generateSalesInsights(params: {
  currentDay: {
    businessDate: string;
    weekday: string;
    netSalesPaise: number;
    grossSalesPaise: number;
    ordersCount: number;
    aovPaise: number;
  };
  previousPeriod?: {
    netSalesPaise: number;
    ordersCount: number;
    aovPaise: number;
  };
  historicalSameWeekdays?: DaySalesComparisonPoint[]; // e.g., last 4 Fridays
  paymentMix?: PaymentBreakupPoint[];
  categories?: CategoryBreakupPoint[];
  hourlyDistribution?: HourlySalesPoint[];
  significanceThresholdPercent?: number; // default 5%
}): InsightCardData[] {
  const {
    currentDay,
    previousPeriod,
    historicalSameWeekdays = [],
    paymentMix = [],
    categories = [],
    hourlyDistribution = [],
    significanceThresholdPercent = 5,
  } = params;

  const insights: InsightCardData[] = [];

  // 1. Same Weekday Historical Baseline Comparison
  // Guard: minimum 4 comparable historical days required (ASSUMPTION)
  const minComparableDays = 4;
  if (historicalSameWeekdays.length < minComparableDays) {
    insights.push({
      id: 'weekday_comparison_insufficient',
      type: 'weekday_comparison',
      tone: 'neutral',
      headline: `Not enough data yet for ${currentDay.weekday} baseline`,
      detail: `Comparing ${currentDay.weekday} trends requires at least ${minComparableDays} past ${currentDay.weekday}s (found ${historicalSameWeekdays.length}).`,
      hasEnoughData: false,
      sampleSize: historicalSameWeekdays.length,
      underlyingNumbers: {
        current: currentDay.netSalesPaise,
        baseline: 0,
        unit: 'currency',
        details: {
          availableDates: historicalSameWeekdays.map((p) => p.businessDate),
          requiredCount: minComparableDays,
        },
      },
    });
  } else {
    const historicalSum = historicalSameWeekdays.reduce((acc, p) => acc + p.netSalesPaise, 0);
    const historicalAvg = Math.round(historicalSum / historicalSameWeekdays.length);

    if (historicalAvg > 0) {
      const diffPaise = currentDay.netSalesPaise - historicalAvg;
      const changePercent = Math.round((diffPaise / historicalAvg) * 100);

      if (Math.abs(changePercent) >= significanceThresholdPercent) {
        const isHigher = changePercent > 0;
        insights.push({
          id: 'weekday_comparison',
          type: 'weekday_comparison',
          tone: isHigher ? 'positive' : 'negative',
          headline: `${currentDay.weekday} sales are ${Math.abs(changePercent)}% ${
            isHigher ? 'higher' : 'lower'
          } than your 4-week ${currentDay.weekday} average.`,
          detail: `Generated ${formatPaiseToRupeeString(
            currentDay.netSalesPaise,
          )} today compared to the 4-week average of ${formatPaiseToRupeeString(historicalAvg)}.`,
          hasEnoughData: true,
          sampleSize: historicalSameWeekdays.length,
          changePercent,
          underlyingNumbers: {
            current: currentDay.netSalesPaise,
            baseline: historicalAvg,
            unit: 'currency',
            details: {
              historicalAveragePaise: historicalAvg,
              todayPaise: currentDay.netSalesPaise,
              comparisonPoints: historicalSameWeekdays.map((p) => ({
                date: p.businessDate,
                sales: p.netSalesPaise,
              })),
            },
          },
        });
      }
    }
  }

  // 2. Average Order Value (AOV) Trend vs Previous Period
  if (previousPeriod && previousPeriod.aovPaise > 0) {
    const aovDiff = currentDay.aovPaise - previousPeriod.aovPaise;
    const aovChangePercent = Math.round((aovDiff / previousPeriod.aovPaise) * 100);

    if (Math.abs(aovChangePercent) >= significanceThresholdPercent) {
      const isUp = aovChangePercent > 0;
      insights.push({
        id: 'aov_trend',
        type: 'period_trend',
        tone: isUp ? 'positive' : 'neutral',
        headline: `Average order value ${isUp ? 'increased' : 'decreased'} by ${Math.abs(
          aovChangePercent,
        )}% vs previous period.`,
        detail: `Guests spent ${formatPaiseToRupeeString(
          currentDay.aovPaise,
        )} per order compared to ${formatPaiseToRupeeString(previousPeriod.aovPaise)} previously.`,
        hasEnoughData: true,
        sampleSize: previousPeriod.ordersCount,
        changePercent: aovChangePercent,
        underlyingNumbers: {
          current: currentDay.aovPaise,
          baseline: previousPeriod.aovPaise,
          unit: 'currency',
          details: {
            currentOrders: currentDay.ordersCount,
            previousOrders: previousPeriod.ordersCount,
          },
        },
      });
    }
  }

  // 3. Payment Method Dominance
  const totalPaymentPaise = paymentMix.reduce((acc, p) => acc + p.amountPaise, 0);
  if (totalPaymentPaise > 0 && paymentMix.length > 0) {
    const sortedPayments = [...paymentMix].sort((a, b) => b.amountPaise - a.amountPaise);
    const topMethod = sortedPayments[0]!;
    const topSharePercent = Math.round((topMethod.amountPaise / totalPaymentPaise) * 100);

    if (topSharePercent >= 40) {
      const methodName = topMethod.method.toUpperCase();
      insights.push({
        id: 'payment_dominance',
        type: 'payment_mix',
        tone: 'highlight',
        headline: `${methodName} accounted for ${topSharePercent}% of total settlements.`,
        detail: `Collected ${formatPaiseToRupeeString(
          topMethod.amountPaise,
        )} via ${methodName} across ${topMethod.count} transactions out of ${formatPaiseToRupeeString(
          totalPaymentPaise,
        )} total.`,
        hasEnoughData: true,
        sampleSize: paymentMix.length,
        changePercent: topSharePercent,
        underlyingNumbers: {
          current: topMethod.amountPaise,
          baseline: totalPaymentPaise,
          unit: 'currency',
          details: {
            method: topMethod.method,
            sharePercent: topSharePercent,
            allMethods: paymentMix,
          },
        },
      });
    }
  }

  // 4. Category Leadership
  const totalCategoryRevenue = categories.reduce((acc, c) => acc + c.revenuePaise, 0);
  if (totalCategoryRevenue > 0 && categories.length > 0) {
    const sortedCategories = [...categories].sort((a, b) => b.revenuePaise - a.revenuePaise);
    const topCategory = sortedCategories[0]!;
    const catShare = Math.round((topCategory.revenuePaise / totalCategoryRevenue) * 100);

    if (catShare >= 25) {
      insights.push({
        id: 'category_lead',
        type: 'category_lead',
        tone: 'highlight',
        headline: `${topCategory.name} drove ${catShare}% of item sales.`,
        detail: `Generated ${formatPaiseToRupeeString(
          topCategory.revenuePaise,
        )} with ${topCategory.quantity} portions served.`,
        hasEnoughData: true,
        sampleSize: categories.length,
        changePercent: catShare,
        underlyingNumbers: {
          current: topCategory.revenuePaise,
          baseline: totalCategoryRevenue,
          unit: 'currency',
          details: {
            categoryName: topCategory.name,
            portions: topCategory.quantity,
            totalRevenue: totalCategoryRevenue,
          },
        },
      });
    }
  }

  // 5. Peak Rush Hour
  if (hourlyDistribution.length > 0) {
    const sortedHours = [...hourlyDistribution].sort((a, b) => b.netSalesPaise - a.netSalesPaise);
    const peakHour = sortedHours[0];

    if (peakHour && peakHour.netSalesPaise > 0) {
      const startHourDisplay = `${peakHour.hour % 12 || 12}:00 ${peakHour.hour >= 12 ? 'PM' : 'AM'}`;
      const endHour = (peakHour.hour + 1) % 24;
      const endHourDisplay = `${endHour % 12 || 12}:00 ${endHour >= 12 ? 'PM' : 'AM'}`;

      insights.push({
        id: 'peak_hour',
        type: 'peak_hour',
        tone: 'neutral',
        headline: `Peak service was between ${startHourDisplay} – ${endHourDisplay}.`,
        detail: `Generated ${formatPaiseToRupeeString(
          peakHour.netSalesPaise,
        )} across ${peakHour.ordersCount} orders during this rush window.`,
        hasEnoughData: true,
        sampleSize: hourlyDistribution.length,
        underlyingNumbers: {
          current: peakHour.netSalesPaise,
          baseline: 0,
          unit: 'currency',
          details: {
            hour: peakHour.hour,
            ordersCount: peakHour.ordersCount,
            salesPaise: peakHour.netSalesPaise,
          },
        },
      });
    }
  }

  return insights;
}
