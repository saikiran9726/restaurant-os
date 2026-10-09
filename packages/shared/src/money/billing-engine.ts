/**
 * Fintech-grade Billing Engine for Restaurant OS.
 * All monetary amounts are handled strictly as integer paise (1 INR = 100 paise).
 *
 * Tax Model: Indian Goods and Services Tax (GST)
 * - Intra-state assumption: GST is equally split into Central GST (CGST) and State GST (SGST).
 * - CGST = Math.floor(TotalGST / 2), SGST = TotalGST - CGST (guarantees CGST + SGST === TotalGST).
 * - Discounts are applied before tax calculation.
 * - Service Charge (if applicable) is calculated on post-discount subtotal.
 * - Tax can be either 'exclusive' (tax added to price) or 'inclusive' (tax included in price).
 * - Round-off to the nearest rupee (100 paise) is configurable.
 */

import type { TaxMode } from '../schemas/config.js';

export type { TaxMode };

export interface BillingLineInput {
  orderItemId?: string;
  itemId?: string;
  name: string;
  qty: number;
  pricePaise: number; // Unit price in paise
  taxRateBp: number; // Basis points (e.g., 500 = 5.00%, 1800 = 18.00%)
  modifiers?: Array<{ name: string; priceDeltaPaise?: number }>;
  note?: string | null;
}

export interface DiscountInput {
  type: 'percent' | 'flat';
  value: number; // Percent (e.g. 10 for 10%) or Flat paise (e.g. 15000 for ₹150)
  reason?: string;
}

export interface BillingCalculationInput {
  lines: BillingLineInput[];
  taxMode?: TaxMode; // Default: 'exclusive'
  discount?: DiscountInput | null;
  serviceChargePercent?: number; // e.g. 5 for 5%
  defaultGstRateBp?: number; // e.g. 500 for 5%
  roundOffEnabled?: boolean; // Default: true
}

export interface ComputedBillLine {
  orderItemId?: string;
  itemId?: string;
  name: string;
  qty: number;
  pricePaise: number;
  subtotalPaise: number; // qty * pricePaise
  discountPaise: number; // Allocated line discount
  taxablePaise: number; // Amount on which tax is levied
  taxRateBp: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  totalPaise: number;
  modifiers?: Array<{ name: string; priceDeltaPaise?: number }>;
  note?: string | null;
}

export interface ComputedBillSummary {
  lines: ComputedBillLine[];
  subtotalPaise: number;
  discountPaise: number;
  discountType: 'percent' | 'flat' | null;
  discountValue: number | null;
  discountReason?: string | null;
  serviceChargePaise: number;
  serviceChargeTaxPaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
}

/**
 * Calculates a complete restaurant bill with tax, service charge, discount, and rounding.
 */
export function calculateBill(input: BillingCalculationInput): ComputedBillSummary {
  const {
    lines,
    taxMode = 'exclusive',
    discount = null,
    serviceChargePercent = 0,
    defaultGstRateBp = 500,
    roundOffEnabled = true,
  } = input;

  if (!lines || lines.length === 0) {
    return {
      lines: [],
      subtotalPaise: 0,
      discountPaise: 0,
      discountType: null,
      discountValue: null,
      serviceChargePaise: 0,
      serviceChargeTaxPaise: 0,
      taxPaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      roundOffPaise: 0,
      totalPaise: 0,
    };
  }

  // 1. Calculate raw line subtotals
  const rawLineSubtotals: number[] = lines.map((line) => {
    if (line.qty <= 0 || line.pricePaise < 0) {
      throw new Error(
        `Invalid line item: qty (${line.qty}) and price (${line.pricePaise}) must be non-negative`,
      );
    }
    return line.qty * line.pricePaise;
  });

  const grossSubtotalPaise = rawLineSubtotals.reduce((sum, val) => sum + val, 0);

  // 2. Compute total discount amount
  let totalDiscountPaise = 0;
  if (discount && discount.value > 0 && grossSubtotalPaise > 0) {
    if (discount.type === 'percent') {
      const pct = Math.min(100, Math.max(0, discount.value));
      totalDiscountPaise = Math.round((grossSubtotalPaise * pct) / 100);
    } else if (discount.type === 'flat') {
      totalDiscountPaise = Math.round(discount.value);
    }
    // Cap discount to gross subtotal
    totalDiscountPaise = Math.min(grossSubtotalPaise, Math.max(0, totalDiscountPaise));
  }

  // 3. Proportional discount allocation per line item with integer remainder reconciliation
  const lineDiscounts: number[] = new Array(lines.length).fill(0);
  if (totalDiscountPaise > 0 && grossSubtotalPaise > 0) {
    let allocatedDiscount = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineSubtotal = rawLineSubtotals[i] ?? 0;
      const lineDisc = Math.floor((lineSubtotal * totalDiscountPaise) / grossSubtotalPaise);
      lineDiscounts[i] = lineDisc;
      allocatedDiscount += lineDisc;
    }
    // Distribute remainder paise to lines with highest unallocated fractions
    const remainder = totalDiscountPaise - allocatedDiscount;
    if (remainder > 0) {
      // Find the line with the largest subtotal to absorb the rounding remainder
      let maxIdx = 0;
      for (let i = 1; i < lines.length; i++) {
        if ((rawLineSubtotals[i] ?? 0) > (rawLineSubtotals[maxIdx] ?? 0)) {
          maxIdx = i;
        }
      }
      lineDiscounts[maxIdx] = (lineDiscounts[maxIdx] ?? 0) + remainder;
    }
  }

  // 4. Calculate per-line tax based on tax mode (inclusive vs exclusive)
  const computedLines: ComputedBillLine[] = [];
  let totalItemsTaxPaise = 0;
  let totalItemsCgstPaise = 0;
  let totalItemsSgstPaise = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const subtotal = rawLineSubtotals[i] ?? 0;
    const lineDiscount = lineDiscounts[i] ?? 0;
    const netAmount = subtotal - lineDiscount;
    const rateBp = line.taxRateBp;

    let taxablePaise = 0;
    let taxPaise = 0;

    if (taxMode === 'exclusive') {
      taxablePaise = netAmount;
      taxPaise = Math.round((taxablePaise * rateBp) / 10000);
    } else {
      // Inclusive tax: netAmount already includes tax
      // taxableAmount = netAmount / (1 + rateBp / 10000) = (netAmount * 10000) / (10000 + rateBp)
      if (rateBp > 0) {
        taxablePaise = Math.round((netAmount * 10000) / (10000 + rateBp));
        taxPaise = netAmount - taxablePaise;
      } else {
        taxablePaise = netAmount;
        taxPaise = 0;
      }
    }

    const cgstPaise = Math.floor(taxPaise / 2);
    const sgstPaise = taxPaise - cgstPaise;

    const lineTotal = taxMode === 'exclusive' ? netAmount + taxPaise : netAmount;

    totalItemsTaxPaise += taxPaise;
    totalItemsCgstPaise += cgstPaise;
    totalItemsSgstPaise += sgstPaise;

    computedLines.push({
      orderItemId: line.orderItemId,
      itemId: line.itemId,
      name: line.name,
      qty: line.qty,
      pricePaise: line.pricePaise,
      subtotalPaise: subtotal,
      discountPaise: lineDiscount,
      taxablePaise,
      taxRateBp: rateBp,
      taxPaise,
      cgstPaise,
      sgstPaise,
      totalPaise: lineTotal,
      modifiers: line.modifiers,
      note: line.note,
    });
  }

  // 5. Service Charge Calculation (on net subtotal)
  let serviceChargePaise = 0;
  let serviceChargeTaxPaise = 0;
  let serviceChargeCgstPaise = 0;
  let serviceChargeSgstPaise = 0;

  const netSubtotal = grossSubtotalPaise - totalDiscountPaise;

  if (serviceChargePercent > 0 && netSubtotal > 0) {
    serviceChargePaise = Math.round((netSubtotal * serviceChargePercent) / 100);

    // In India, GST applies to Service Charge at restaurant GST rate
    if (taxMode === 'exclusive') {
      serviceChargeTaxPaise = Math.round((serviceChargePaise * defaultGstRateBp) / 10000);
      serviceChargeCgstPaise = Math.floor(serviceChargeTaxPaise / 2);
      serviceChargeSgstPaise = serviceChargeTaxPaise - serviceChargeCgstPaise;
    }
  }

  // 6. Aggregate Totals
  const totalTaxPaise = totalItemsTaxPaise + serviceChargeTaxPaise;
  const totalCgstPaise = totalItemsCgstPaise + serviceChargeCgstPaise;
  const totalSgstPaise = totalItemsSgstPaise + serviceChargeSgstPaise;

  let totalBeforeRoundOff = 0;
  if (taxMode === 'exclusive') {
    totalBeforeRoundOff = netSubtotal + serviceChargePaise + totalTaxPaise;
  } else {
    totalBeforeRoundOff = netSubtotal + serviceChargePaise;
  }

  // 7. Round off to nearest ₹1 (100 paise)
  let roundOffPaise = 0;
  let finalTotalPaise = totalBeforeRoundOff;

  if (roundOffEnabled && totalBeforeRoundOff > 0) {
    finalTotalPaise = Math.round(totalBeforeRoundOff / 100) * 100;
    roundOffPaise = finalTotalPaise - totalBeforeRoundOff;
  }

  return {
    lines: computedLines,
    subtotalPaise: grossSubtotalPaise,
    discountPaise: totalDiscountPaise,
    discountType: discount?.type ?? null,
    discountValue: discount?.value ?? null,
    discountReason: discount?.reason ?? null,
    serviceChargePaise,
    serviceChargeTaxPaise,
    taxPaise: totalTaxPaise,
    cgstPaise: totalCgstPaise,
    sgstPaise: totalSgstPaise,
    roundOffPaise,
    totalPaise: finalTotalPaise,
  };
}

/**
 * Calculates remaining balance and verifies overpayment constraints.
 */
export function calculatePaymentBreakdown(
  totalBillPaise: number,
  confirmedPaymentsPaise: number,
  pendingPaymentsPaise: number = 0,
) {
  const totalReceivedPaise = confirmedPaymentsPaise + pendingPaymentsPaise;
  const balanceRemainingPaise = Math.max(0, totalBillPaise - confirmedPaymentsPaise);
  const isFullyPaid = confirmedPaymentsPaise >= totalBillPaise;
  const isPartiallyPaid = confirmedPaymentsPaise > 0 && !isFullyPaid;

  return {
    totalBillPaise,
    confirmedPaymentsPaise,
    pendingPaymentsPaise,
    totalReceivedPaise,
    balanceRemainingPaise,
    isFullyPaid,
    isPartiallyPaid,
  };
}
