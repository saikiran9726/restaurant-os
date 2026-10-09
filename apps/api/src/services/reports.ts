import { eq, and, desc, asc, sql, inArray, gte, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { bills, billLines, payments, refunds } from '../db/schema/bills.js';
import { orders } from '../db/schema/orders.js';
import { menuItems } from '../db/schema/menu-items.js';
import { menuCategories } from '../db/schema/menu-categories.js';
import { customers } from '../db/schema/customers.js';
import { restaurantSettings } from '../db/schema/restaurant-settings.js';
import {
  getBusinessDate,
  getBusinessDateRange,
  shiftBusinessDays,
  generateSalesInsights,
  type SalesReportFilter,
  type SalesReportResponse,
  type ItemsReportResponse,
  type CustomerAnalyticsResponse,
  type ItemPerformanceRow,
  type SalesReportKpis,
  type SalesChartDataPoint,
  type HourlyHeatmapPoint,
  type CategorySalesPoint,
  type OrderTypeBreakdownPoint,
  type PaymentMixPoint,
  type DaySalesComparisonPoint,
} from '@restaurant-os/shared';

/**
 * Generates the full sales report, KPIs, distributions, and deterministic insights.
 */
export async function getSalesReport(
  restaurantId: string,
  filter: SalesReportFilter,
): Promise<SalesReportResponse> {
  const [settings] = await db
    .select()
    .from(restaurantSettings)
    .where(eq(restaurantSettings.restaurantId, restaurantId))
    .limit(1);

  const dayStartHour = settings?.businessDayStartHour ?? 5;
  const timeZone = settings?.timezone ?? 'Asia/Kolkata';

  const rangeInfo = getBusinessDateRange(filter.range, {
    customStart: filter.startDate,
    customEnd: filter.endDate,
    dayStartHour,
    timeZone,
  });

  const { startDate, endDate, isSingleDay } = rangeInfo;

  // 1. Fetch all bills within the date range
  const billRows = await db
    .select({
      id: bills.id,
      orderId: bills.orderId,
      billNumber: bills.billNumber,
      subtotalPaise: bills.subtotalPaise,
      discountPaise: bills.discountPaise,
      taxPaise: bills.taxPaise,
      serviceChargePaise: bills.serviceChargePaise,
      roundOffPaise: bills.roundOffPaise,
      totalPaise: bills.totalPaise,
      status: bills.status,
      businessDate: bills.businessDate,
      loyaltyPointsRedeemed: bills.loyaltyPointsRedeemed,
      loyaltyDiscountPaise: bills.loyaltyDiscountPaise,
      createdAt: bills.createdAt,
    })
    .from(bills)
    .where(
      and(
        eq(bills.restaurantId, restaurantId),
        gte(bills.businessDate, startDate),
        lte(bills.businessDate, endDate),
      ),
    );

  const paidBills = billRows.filter((b) => b.status === 'paid' || b.status === 'partially_paid');
  const cancelledBills = billRows.filter((b) => b.status === 'cancelled');

  // 2. Fetch payments in the range
  const paymentRows = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.restaurantId, restaurantId),
        gte(payments.businessDate, startDate),
        lte(payments.businessDate, endDate),
      ),
    );

  // 3. Fetch refunds in the range
  const refundRows = await db
    .select({
      id: refunds.id,
      amountPaise: refunds.amountPaise,
      method: refunds.method,
      billId: refunds.billId,
    })
    .from(refunds)
    .innerJoin(bills, eq(refunds.billId, bills.id))
    .where(
      and(
        eq(bills.restaurantId, restaurantId),
        gte(bills.businessDate, startDate),
        lte(bills.businessDate, endDate),
      ),
    );

  // Reconciled KPIs
  const grossSalesPaise = paidBills.reduce((acc, b) => acc + b.subtotalPaise, 0);
  const netSalesPaise = paidBills.reduce((acc, b) => acc + b.totalPaise, 0);
  const discountsPaise = paidBills.reduce((acc, b) => acc + (b.discountPaise || 0), 0);
  const taxCollectedPaise = paidBills.reduce((acc, b) => acc + (b.taxPaise || 0), 0);
  const serviceChargePaise = paidBills.reduce((acc, b) => acc + (b.serviceChargePaise || 0), 0);
  const roundOffPaise = paidBills.reduce((acc, b) => acc + (b.roundOffPaise || 0), 0);
  const refundsPaise = refundRows.reduce((acc, r) => acc + r.amountPaise, 0);
  const ordersCount = paidBills.length;
  const billsCount = billRows.length;
  const aovPaise = ordersCount > 0 ? Math.round(netSalesPaise / ordersCount) : 0;

  const kpis: SalesReportKpis = {
    netSalesPaise,
    grossSalesPaise,
    ordersCount,
    billsCount,
    aovPaise,
    discountsPaise,
    taxCollectedPaise,
    serviceChargePaise,
    roundOffPaise,
    refundsPaise,
    cancelledBillsCount: cancelledBills.length,
  };

  // 4. Time series chart data
  const chartData: SalesChartDataPoint[] = [];
  if (isSingleDay) {
    // Group by hour (0 to 23) in restaurant timezone
    const hourMap: Record<number, { netSalesPaise: number; ordersCount: number }> = {};
    for (let h = 0; h < 24; h++) hourMap[h] = { netSalesPaise: 0, ordersCount: 0 };

    for (const b of paidBills) {
      // Local hour in target timezone
      const localHourStr = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        hour12: false,
      }).format(b.createdAt);
      const hour = parseInt(localHourStr, 10);
      if (hourMap[hour]) {
        hourMap[hour]!.netSalesPaise += b.totalPaise;
        hourMap[hour]!.ordersCount += 1;
      }
    }

    for (let h = 0; h < 24; h++) {
      const displayLabel = `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
      chartData.push({
        date: startDate,
        label: displayLabel,
        netSalesPaise: hourMap[h]!.netSalesPaise,
        ordersCount: hourMap[h]!.ordersCount,
      });
    }
  } else {
    // Group by calendar date
    const dateMap: Record<string, { netSalesPaise: number; ordersCount: number }> = {};
    for (const b of paidBills) {
      const d = b.businessDate || startDate;
      if (!dateMap[d]) dateMap[d] = { netSalesPaise: 0, ordersCount: 0 };
      dateMap[d]!.netSalesPaise += b.totalPaise;
      dateMap[d]!.ordersCount += 1;
    }

    // Fill all days in range
    let cur = startDate;
    while (cur <= endDate) {
      const [y, m, d] = cur.split('-').map(Number);
      const label = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'short',
      }).format(new Date(Date.UTC(y!, m! - 1, d!)));

      chartData.push({
        date: cur,
        label,
        netSalesPaise: dateMap[cur]?.netSalesPaise || 0,
        ordersCount: dateMap[cur]?.ordersCount || 0,
      });
      cur = shiftBusinessDays(cur, 1);
    }
  }

  // 5. Hourly heatmap
  const hourlyHeatmap: HourlyHeatmapPoint[] = [];
  const hourAggregate: Record<number, { netSalesPaise: number; ordersCount: number }> = {};
  for (let h = 0; h < 24; h++) hourAggregate[h] = { netSalesPaise: 0, ordersCount: 0 };

  for (const b of paidBills) {
    const localHourStr = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(b.createdAt);
    const hour = parseInt(localHourStr, 10);
    if (hourAggregate[hour]) {
      hourAggregate[hour]!.netSalesPaise += b.totalPaise;
      hourAggregate[hour]!.ordersCount += 1;
    }
  }

  for (let h = 0; h < 24; h++) {
    hourlyHeatmap.push({
      hour: h,
      label: `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`,
      netSalesPaise: hourAggregate[h]!.netSalesPaise,
      ordersCount: hourAggregate[h]!.ordersCount,
    });
  }

  // 6. Revenue by category
  const paidBillIds = paidBills.map((b) => b.id);
  let categories: CategorySalesPoint[] = [];

  if (paidBillIds.length > 0) {
    const linesRows = await db
      .select({
        revenuePaise: billLines.subtotalPaise,
        quantity: billLines.qty,
        categoryId: menuCategories.id,
        categoryName: menuCategories.name,
      })
      .from(billLines)
      .innerJoin(menuItems, eq(billLines.itemId, menuItems.id))
      .leftJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id))
      .where(inArray(billLines.billId, paidBillIds));

    const catMap: Record<string, { name: string; revenuePaise: number; quantity: number }> = {};
    for (const line of linesRows) {
      const cId = line.categoryId || 'uncategorized';
      const cName = line.categoryName || 'Other Items';
      if (!catMap[cId]) catMap[cId] = { name: cName, revenuePaise: 0, quantity: 0 };
      catMap[cId]!.revenuePaise += line.revenuePaise;
      catMap[cId]!.quantity += line.quantity;
    }

    const totalLinesRevenue = Object.values(catMap).reduce((acc, c) => acc + c.revenuePaise, 0);

    categories = Object.entries(catMap)
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        revenuePaise: data.revenuePaise,
        quantity: data.quantity,
        sharePercent:
          totalLinesRevenue > 0 ? Math.round((data.revenuePaise / totalLinesRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenuePaise - a.revenuePaise);
  }

  // 7. Order type breakdown (Dine-in vs Takeaway)
  let orderTypes: OrderTypeBreakdownPoint[] = [
    { type: 'dine_in', netSalesPaise: 0, ordersCount: 0, sharePercent: 0 },
    { type: 'takeaway', netSalesPaise: 0, ordersCount: 0, sharePercent: 0 },
  ];

  if (paidBillIds.length > 0) {
    const orderRows = await db
      .select({
        billId: bills.id,
        totalPaise: bills.totalPaise,
        orderType: orders.type,
      })
      .from(bills)
      .innerJoin(orders, eq(bills.orderId, orders.id))
      .where(inArray(bills.id, paidBillIds));

    let dineInSales = 0;
    let dineInCount = 0;
    let takeawaySales = 0;
    let takeawayCount = 0;

    for (const r of orderRows) {
      if (r.orderType === 'takeaway') {
        takeawaySales += r.totalPaise;
        takeawayCount += 1;
      } else {
        dineInSales += r.totalPaise;
        dineInCount += 1;
      }
    }

    const totalOrders = dineInCount + takeawayCount;
    orderTypes = [
      {
        type: 'dine_in',
        netSalesPaise: dineInSales,
        ordersCount: dineInCount,
        sharePercent: totalOrders > 0 ? Math.round((dineInCount / totalOrders) * 100) : 0,
      },
      {
        type: 'takeaway',
        netSalesPaise: takeawaySales,
        ordersCount: takeawayCount,
        sharePercent: totalOrders > 0 ? Math.round((takeawayCount / totalOrders) * 100) : 0,
      },
    ];
  }

  // 8. Payment Method Mix
  const confirmedPayments = paymentRows.filter(
    (p) => p.status === 'confirmed' || p.status === 'recorded',
  );
  const totalPaid = confirmedPayments.reduce((acc, p) => acc + p.amountPaise, 0);

  const methodMap: Record<string, { amountPaise: number; count: number }> = {
    cash: { amountPaise: 0, count: 0 },
    upi: { amountPaise: 0, count: 0 },
    card: { amountPaise: 0, count: 0 },
  };

  for (const p of confirmedPayments) {
    const m = p.method as 'cash' | 'upi' | 'card';
    if (methodMap[m]) {
      methodMap[m]!.amountPaise += p.amountPaise;
      methodMap[m]!.count += 1;
    }
  }

  const paymentMix: PaymentMixPoint[] = (['cash', 'upi', 'card'] as const).map((method) => ({
    method,
    amountPaise: methodMap[method]!.amountPaise,
    count: methodMap[method]!.count,
    sharePercent:
      totalPaid > 0 ? Math.round((methodMap[method]!.amountPaise / totalPaid) * 100) : 0,
  }));

  // 9. Fetch historical same-weekdays for deterministic insights comparison
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const startDayDate = new Date(Date.UTC(sy!, sm! - 1, sd!));
  const weekdayName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
  }).format(startDayDate);

  const pastSameWeekdaysDates: string[] = [
    shiftBusinessDays(startDate, -7),
    shiftBusinessDays(startDate, -14),
    shiftBusinessDays(startDate, -21),
    shiftBusinessDays(startDate, -28),
  ];

  const historicalRows = await db
    .select({
      businessDate: bills.businessDate,
      totalPaise: bills.totalPaise,
    })
    .from(bills)
    .where(
      and(
        eq(bills.restaurantId, restaurantId),
        inArray(bills.businessDate, pastSameWeekdaysDates),
        inArray(bills.status, ['paid', 'partially_paid']),
      ),
    );

  const histAgg: Record<string, { netSalesPaise: number; ordersCount: number }> = {};
  for (const d of pastSameWeekdaysDates) {
    histAgg[d] = { netSalesPaise: 0, ordersCount: 0 };
  }
  for (const r of historicalRows) {
    if (r.businessDate && histAgg[r.businessDate]) {
      histAgg[r.businessDate]!.netSalesPaise += r.totalPaise;
      histAgg[r.businessDate]!.ordersCount += 1;
    }
  }

  const historicalSameWeekdays: DaySalesComparisonPoint[] = pastSameWeekdaysDates
    .filter((d) => histAgg[d]!.ordersCount > 0)
    .map((d) => ({
      businessDate: d,
      weekday: weekdayName,
      netSalesPaise: histAgg[d]!.netSalesPaise,
      ordersCount: histAgg[d]!.ordersCount,
    }));

  // Previous period baseline for AOV
  const periodDays = rangeInfo.daysCount;
  const prevStartDate = shiftBusinessDays(startDate, -periodDays);
  const prevEndDate = shiftBusinessDays(startDate, -1);

  const prevBills = await db
    .select({ totalPaise: bills.totalPaise })
    .from(bills)
    .where(
      and(
        eq(bills.restaurantId, restaurantId),
        gte(bills.businessDate, prevStartDate),
        lte(bills.businessDate, prevEndDate),
        inArray(bills.status, ['paid', 'partially_paid']),
      ),
    );

  const prevNetSalesPaise = prevBills.reduce((acc, b) => acc + b.totalPaise, 0);
  const prevOrdersCount = prevBills.length;
  const prevAovPaise = prevOrdersCount > 0 ? Math.round(prevNetSalesPaise / prevOrdersCount) : 0;

  // 10. Generate plain-English deterministic insights
  const insights = generateSalesInsights({
    currentDay: {
      businessDate: startDate,
      weekday: weekdayName,
      netSalesPaise,
      grossSalesPaise,
      ordersCount,
      aovPaise,
    },
    previousPeriod:
      prevOrdersCount > 0
        ? {
            netSalesPaise: prevNetSalesPaise,
            ordersCount: prevOrdersCount,
            aovPaise: prevAovPaise,
          }
        : undefined,
    historicalSameWeekdays,
    paymentMix,
    categories: categories.map((c) => ({
      name: c.categoryName,
      revenuePaise: c.revenuePaise,
      quantity: c.quantity,
    })),
    hourlyDistribution: hourlyHeatmap.map((h) => ({
      hour: h.hour,
      netSalesPaise: h.netSalesPaise,
      ordersCount: h.ordersCount,
    })),
  });

  return {
    range: filter.range,
    startDate,
    endDate,
    isSingleDay,
    kpis,
    insights,
    chartData,
    hourlyHeatmap,
    categories,
    orderTypes,
    paymentMix,
  };
}

/**
 * Returns item performance tables: best sellers & worst performers with min-days-on-menu guard.
 */
export async function getItemsReport(
  restaurantId: string,
  startDate?: string,
  endDate?: string,
): Promise<ItemsReportResponse> {
  const [settings] = await db
    .select()
    .from(restaurantSettings)
    .where(eq(restaurantSettings.restaurantId, restaurantId))
    .limit(1);

  const dayStartHour = settings?.businessDayStartHour ?? 5;
  const timeZone = settings?.timezone ?? 'Asia/Kolkata';
  const currentBusinessDate = getBusinessDate(new Date(), dayStartHour, timeZone);

  const sDate = startDate || currentBusinessDate;
  const eDate = endDate || currentBusinessDate;

  // 1. Fetch item sales in range
  const salesRows = await db
    .select({
      itemId: billLines.itemId,
      quantity: billLines.qty,
      revenuePaise: billLines.subtotalPaise,
    })
    .from(billLines)
    .innerJoin(bills, eq(billLines.billId, bills.id))
    .where(
      and(
        eq(bills.restaurantId, restaurantId),
        gte(bills.businessDate, sDate),
        lte(bills.businessDate, eDate),
        inArray(bills.status, ['paid', 'partially_paid']),
      ),
    );

  const itemAgg: Record<string, { quantity: number; revenuePaise: number }> = {};
  for (const r of salesRows) {
    if (!itemAgg[r.itemId]) itemAgg[r.itemId] = { quantity: 0, revenuePaise: 0 };
    itemAgg[r.itemId]!.quantity += r.quantity;
    itemAgg[r.itemId]!.revenuePaise += r.revenuePaise;
  }

  // 2. Fetch all menu items for this restaurant
  const allMenuItems = await db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      createdAt: menuItems.createdAt,
      categoryId: menuItems.categoryId,
      categoryName: menuCategories.name,
    })
    .from(menuItems)
    .leftJoin(menuCategories, eq(menuItems.categoryId, menuCategories.id))
    .where(eq(menuItems.restaurantId, restaurantId));

  const nowMs = Date.now();
  const allPerformers: ItemPerformanceRow[] = allMenuItems.map((item) => {
    const agg = itemAgg[item.id] || { quantity: 0, revenuePaise: 0 };
    const ageDays = Math.floor((nowMs - item.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    return {
      itemId: item.id,
      itemName: item.name,
      categoryName: item.categoryName || 'Uncategorized',
      quantitySold: agg.quantity,
      revenuePaise: agg.revenuePaise,
      daysOnMenu: ageDays,
      isNewItem: ageDays < 7, // Guard: added less than 7 days ago
    };
  });

  // Best sellers: ordered by revenue descending
  const bestSellers = [...allPerformers]
    .filter((i) => i.quantitySold > 0)
    .sort((a, b) => b.revenuePaise - a.revenuePaise)
    .slice(0, 10);

  // Worst performers: Guard: ONLY items with >= 7 days on menu to avoid penalizing new items!
  const worstPerformers = [...allPerformers]
    .filter((i) => !i.isNewItem)
    .sort((a, b) => a.quantitySold - b.quantitySold || a.revenuePaise - b.revenuePaise)
    .slice(0, 10);

  return {
    startDate: sDate,
    endDate: eDate,
    bestSellers,
    worstPerformers,
    allPerformers,
  };
}

/**
 * Returns customer and loyalty usage metrics for the sales analytics panel.
 */
export async function getCustomerAnalyticsReport(
  restaurantId: string,
  startDate?: string,
  endDate?: string,
): Promise<CustomerAnalyticsResponse> {
  const [settings] = await db
    .select()
    .from(restaurantSettings)
    .where(eq(restaurantSettings.restaurantId, restaurantId))
    .limit(1);

  const dayStartHour = settings?.businessDayStartHour ?? 5;
  const timeZone = settings?.timezone ?? 'Asia/Kolkata';
  const currentBusinessDate = getBusinessDate(new Date(), dayStartHour, timeZone);

  const sDate = startDate || currentBusinessDate;
  const eDate = endDate || currentBusinessDate;

  // Fetch paid bills with customer attachments
  const billRows = await db
    .select({
      id: bills.id,
      customerId: orders.customerId,
      loyaltyPointsRedeemed: bills.loyaltyPointsRedeemed,
      loyaltyDiscountPaise: bills.loyaltyDiscountPaise,
    })
    .from(bills)
    .innerJoin(orders, eq(bills.orderId, orders.id))
    .where(
      and(
        eq(bills.restaurantId, restaurantId),
        gte(bills.businessDate, sDate),
        lte(bills.businessDate, eDate),
        inArray(bills.status, ['paid', 'partially_paid']),
      ),
    );

  const customerIds = Array.from(
    new Set(billRows.map((b) => b.customerId).filter(Boolean)),
  ) as string[];

  let returningCount = 0;
  let newCount = 0;

  if (customerIds.length > 0) {
    const custRows = await db
      .select({
        id: customers.id,
        visitCount: customers.visitCount,
      })
      .from(customers)
      .where(inArray(customers.id, customerIds));

    for (const c of custRows) {
      if (c.visitCount > 1) {
        returningCount += 1;
      } else {
        newCount += 1;
      }
    }
  }

  const totalCustomersSeen = customerIds.length;
  const returningSharePercent =
    totalCustomersSeen > 0 ? Math.round((returningCount / totalCustomersSeen) * 100) : 0;

  const totalLoyaltyPointsRedeemed = billRows.reduce(
    (acc, b) => acc + (b.loyaltyPointsRedeemed || 0),
    0,
  );
  const totalLoyaltyDiscountPaise = billRows.reduce(
    (acc, b) => acc + (b.loyaltyDiscountPaise || 0),
    0,
  );
  const billsWithLoyaltyCount = billRows.filter((b) => (b.loyaltyPointsRedeemed || 0) > 0).length;
  const loyaltyBillSharePercent =
    billRows.length > 0 ? Math.round((billsWithLoyaltyCount / billRows.length) * 100) : 0;

  return {
    totalCustomersSeen,
    newCustomersCount: newCount,
    returningCustomersCount: returningCount,
    returningSharePercent,
    totalLoyaltyPointsRedeemed,
    totalLoyaltyDiscountPaise,
    billsWithLoyaltyCount,
    loyaltyBillSharePercent,
  };
}
