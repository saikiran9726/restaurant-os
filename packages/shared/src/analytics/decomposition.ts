export interface SalesDecompositionInput {
  currentSalesPaise: number;
  currentOrdersCount: number;
  baselineSalesPaise: number;
  baselineOrdersCount: number;
}

export interface SalesDecompositionResult {
  currentSalesPaise: number;
  baselineSalesPaise: number;
  currentOrdersCount: number;
  baselineOrdersCount: number;
  currentAovPaise: number;
  baselineAovPaise: number;
  totalChangePaise: number;
  totalChangePercent: number;
  ordersContributionPaise: number;
  ordersContributionPercent: number;
  aovContributionPaise: number;
  aovContributionPercent: number;
  mixContributionPaise: number;
  mixContributionPercent: number;
  plainEnglishExplanation: string;
}

/**
 * Decomposes sales change into Orders volume effect, Average Order Value (AOV) effect,
 * and Item Mix/Interaction effect.
 *
 * Mathematical Invariant:
 * deltaSales = deltaOrdersEffect + deltaAovEffect + deltaMixEffect
 * totalChangePercent = ordersContributionPercent + aovContributionPercent + mixContributionPercent
 */
export function decomposeSalesChange(input: SalesDecompositionInput): SalesDecompositionResult {
  const { currentSalesPaise, currentOrdersCount, baselineSalesPaise, baselineOrdersCount } = input;

  if (baselineSalesPaise <= 0 || baselineOrdersCount <= 0 || currentOrdersCount <= 0) {
    return {
      currentSalesPaise,
      baselineSalesPaise,
      currentOrdersCount,
      baselineOrdersCount,
      currentAovPaise:
        currentOrdersCount > 0 ? Math.round(currentSalesPaise / currentOrdersCount) : 0,
      baselineAovPaise:
        baselineOrdersCount > 0 ? Math.round(baselineSalesPaise / baselineOrdersCount) : 0,
      totalChangePaise: currentSalesPaise - baselineSalesPaise,
      totalChangePercent:
        baselineSalesPaise > 0
          ? ((currentSalesPaise - baselineSalesPaise) / baselineSalesPaise) * 100
          : 0,
      ordersContributionPaise: 0,
      ordersContributionPercent: 0,
      aovContributionPaise: 0,
      aovContributionPercent: 0,
      mixContributionPaise: 0,
      mixContributionPercent: 0,
      plainEnglishExplanation: 'Insufficient baseline order data for statistical decomposition.',
    };
  }

  const baselineAov = baselineSalesPaise / baselineOrdersCount;
  const currentAov = currentSalesPaise / currentOrdersCount;

  const deltaN = currentOrdersCount - baselineOrdersCount;
  const deltaA = currentAov - baselineAov;

  // Exact 3-factor additive decomposition:
  const ordersEffect = deltaN * baselineAov;
  const aovEffect = baselineOrdersCount * deltaA;
  const mixEffect = deltaN * deltaA;

  const totalChangePaise = currentSalesPaise - baselineSalesPaise;
  const totalChangePercent = (totalChangePaise / baselineSalesPaise) * 100;

  const ordersContributionPercent = (ordersEffect / baselineSalesPaise) * 100;
  const aovContributionPercent = (aovEffect / baselineSalesPaise) * 100;
  const mixContributionPercent = (mixEffect / baselineSalesPaise) * 100;

  // Plain English Narrative Construction
  const direction = totalChangePercent >= 0 ? 'up' : 'down';
  const absChange = Math.abs(totalChangePercent).toFixed(1);

  let driver = '';
  const absOrders = Math.abs(ordersContributionPercent);
  const absAov = Math.abs(aovContributionPercent);

  if (absOrders > absAov * 1.5) {
    const orderTrend = ordersContributionPercent > 0 ? 'more' : 'fewer';
    const aovState =
      Math.abs(aovContributionPercent) < 2
        ? 'average order value was flat'
        : `average order value was ${aovContributionPercent > 0 ? 'up' : 'down'} ${Math.abs(aovContributionPercent).toFixed(1)}%`;
    driver = `driven by ${Math.abs(ordersContributionPercent).toFixed(1)}% ${orderTrend} orders; ${aovState}`;
  } else if (absAov > absOrders * 1.5) {
    const aovTrend = aovContributionPercent > 0 ? 'higher' : 'lower';
    const orderState =
      Math.abs(ordersContributionPercent) < 2
        ? 'order volume was steady'
        : `orders were ${ordersContributionPercent > 0 ? 'up' : 'down'} ${Math.abs(ordersContributionPercent).toFixed(1)}%`;
    driver = `driven by ${absAov.toFixed(1)}% ${aovTrend} average spend per order; ${orderState}`;
  } else {
    driver = `supported by both order volume (${ordersContributionPercent >= 0 ? '+' : ''}${ordersContributionPercent.toFixed(1)}%) and average order spend (${aovContributionPercent >= 0 ? '+' : ''}${aovContributionPercent.toFixed(1)}%)`;
  }

  const plainEnglishExplanation = `Sales ${direction} ${absChange}%, ${driver}.`;

  return {
    currentSalesPaise,
    baselineSalesPaise,
    currentOrdersCount,
    baselineOrdersCount,
    currentAovPaise: Math.round(currentAov) || 0,
    baselineAovPaise: Math.round(baselineAov) || 0,
    totalChangePaise: totalChangePaise || 0,
    totalChangePercent: Math.round(totalChangePercent * 10) / 10 || 0,
    ordersContributionPaise: Math.round(ordersEffect) || 0,
    ordersContributionPercent: Math.round(ordersContributionPercent * 10) / 10 || 0,
    aovContributionPaise: Math.round(aovEffect) || 0,
    aovContributionPercent: Math.round(aovContributionPercent * 10) / 10 || 0,
    mixContributionPaise: Math.round(mixEffect) || 0,
    mixContributionPercent: Math.round(mixContributionPercent * 10) / 10 || 0,
    plainEnglishExplanation,
  };
}
