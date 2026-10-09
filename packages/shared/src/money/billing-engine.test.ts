import { describe, it, expect } from 'vitest';
import {
  calculateBill,
  calculatePaymentBreakdown,
  type BillingLineInput,
} from './billing-engine.js';

describe('Fintech-Grade Billing Engine', () => {
  const sampleLines: BillingLineInput[] = [
    {
      name: 'Paneer Butter Masala',
      qty: 2,
      pricePaise: 30000, // ₹300 each = ₹600 (60000 paise)
      taxRateBp: 500, // 5% GST
    },
    {
      name: 'Butter Naan',
      qty: 4,
      pricePaise: 5000, // ₹50 each = ₹200 (20000 paise)
      taxRateBp: 500, // 5% GST
    },
    {
      name: 'Mineral Water',
      qty: 2,
      pricePaise: 2000, // ₹20 each = ₹40 (4000 paise)
      taxRateBp: 1800, // 18% GST
    },
  ];

  it('calculates exclusive tax correctly without discount or service charge', () => {
    // Total subtotal: 60000 + 20000 + 4000 = 84000 paise (₹840.00)
    // Line 1: 60000 * 5% = 3000 paise (CGST 1500, SGST 1500)
    // Line 2: 20000 * 5% = 1000 paise (CGST 500, SGST 500)
    // Line 3: 4000 * 18% = 720 paise (CGST 360, SGST 360)
    // Total Tax: 3000 + 1000 + 720 = 4720 paise (₹47.20)
    // Total: 84000 + 4720 = 88720 paise -> Round off to nearest ₹1:
    // 88720 rounded to nearest 100 is 88700 (roundOff = -20 paise)
    const result = calculateBill({
      lines: sampleLines,
      taxMode: 'exclusive',
      roundOffEnabled: true,
    });

    expect(result.subtotalPaise).toBe(84000);
    expect(result.discountPaise).toBe(0);
    expect(result.taxPaise).toBe(4720);
    expect(result.cgstPaise).toBe(2360);
    expect(result.sgstPaise).toBe(2360);
    expect(result.cgstPaise + result.sgstPaise).toBe(result.taxPaise);
    expect(result.roundOffPaise).toBe(-20);
    expect(result.totalPaise).toBe(88700);
  });

  it('applies percentage discount before tax and reallocates proportionally', () => {
    // 10% discount on 84000 = 8400 paise
    // Net subtotal: 84000 - 8400 = 75600 paise
    // Line 1: subtotal 60000, discount 6000, net 54000 -> 5% tax = 2700 paise (CGST 1350, SGST 1350)
    // Line 2: subtotal 20000, discount 2000, net 18000 -> 5% tax = 900 paise (CGST 450, SGST 450)
    // Line 3: subtotal 4000, discount 400, net 3600 -> 18% tax = 648 paise (CGST 324, SGST 324)
    // Total Tax: 2700 + 900 + 648 = 4248 paise
    // Total before round: 75600 + 4248 = 79848 paise
    // Round to nearest ₹1: 79800 (round off = -48 paise)
    const result = calculateBill({
      lines: sampleLines,
      taxMode: 'exclusive',
      discount: { type: 'percent', value: 10, reason: 'Happy Hours' },
      roundOffEnabled: true,
    });

    expect(result.subtotalPaise).toBe(84000);
    expect(result.discountPaise).toBe(8400);
    expect(result.taxPaise).toBe(4248);
    expect(result.cgstPaise + result.sgstPaise).toBe(4248);
    expect(result.roundOffPaise).toBe(-48);
    expect(result.totalPaise).toBe(79800);
  });

  it('handles flat discount correctly', () => {
    // Flat ₹100 discount (10000 paise)
    const result = calculateBill({
      lines: sampleLines,
      taxMode: 'exclusive',
      discount: { type: 'flat', value: 10000, reason: 'Manager Courtesy' },
      roundOffEnabled: false,
    });

    expect(result.subtotalPaise).toBe(84000);
    expect(result.discountPaise).toBe(10000);
    // Allocated line discounts must sum to exactly 10000 paise
    const allocatedSum = result.lines.reduce((sum, l) => sum + l.discountPaise, 0);
    expect(allocatedSum).toBe(10000);
    expect(result.roundOffPaise).toBe(0);
  });

  it('caps discount if discount exceeds gross subtotal', () => {
    const result = calculateBill({
      lines: sampleLines,
      taxMode: 'exclusive',
      discount: { type: 'flat', value: 999999, reason: 'Total comp' },
    });

    expect(result.discountPaise).toBe(84000);
    expect(result.taxPaise).toBe(0);
    expect(result.totalPaise).toBe(0);
  });

  it('calculates inclusive tax correctly', () => {
    // Single item ₹210 inclusive of 5% tax = 21000 paise
    // Taxable base: 21000 * 10000 / 10500 = 20000 paise
    // Tax: 21000 - 20000 = 1000 paise (CGST 500, SGST 500)
    const result = calculateBill({
      lines: [
        {
          name: 'Thali (Tax Inclusive)',
          qty: 1,
          pricePaise: 21000,
          taxRateBp: 500,
        },
      ],
      taxMode: 'inclusive',
      roundOffEnabled: true,
    });

    expect(result.subtotalPaise).toBe(21000);
    expect(result.lines[0]?.taxablePaise).toBe(20000);
    expect(result.lines[0]?.taxPaise).toBe(1000);
    expect(result.lines[0]?.cgstPaise).toBe(500);
    expect(result.lines[0]?.sgstPaise).toBe(500);
    expect(result.totalPaise).toBe(21000);
    expect(result.roundOffPaise).toBe(0);
  });

  it('includes service charge and levies GST on service charge', () => {
    // Subtotal: ₹1,000 (100000 paise)
    // 5% GST item = 5000 paise tax
    // Service Charge: 10% = ₹100 (10000 paise)
    // GST on Service Charge at 5% = 500 paise
    // Total Tax: 5000 + 500 = 5500 paise
    // Total before roundoff: 100000 + 10000 + 5500 = 115500 paise (₹1,155)
    const result = calculateBill({
      lines: [
        {
          name: 'Chef Tasting Menu',
          qty: 1,
          pricePaise: 100000,
          taxRateBp: 500,
        },
      ],
      taxMode: 'exclusive',
      serviceChargePercent: 10,
      defaultGstRateBp: 500,
      roundOffEnabled: true,
    });

    expect(result.subtotalPaise).toBe(100000);
    expect(result.serviceChargePaise).toBe(10000);
    expect(result.serviceChargeTaxPaise).toBe(500);
    expect(result.taxPaise).toBe(5500);
    expect(result.totalPaise).toBe(115500);
  });

  it('handles empty lines gracefully', () => {
    const result = calculateBill({ lines: [] });
    expect(result.subtotalPaise).toBe(0);
    expect(result.totalPaise).toBe(0);
    expect(result.taxPaise).toBe(0);
  });

  it('calculates payment breakdown and remaining balance correctly', () => {
    // Total Bill: ₹1,200 (120000 paise)
    // Confirmed cash: ₹500 (50000 paise)
    // Pending UPI: ₹700 (70000 paise)
    const partial = calculatePaymentBreakdown(120000, 50000, 70000);
    expect(partial.totalBillPaise).toBe(120000);
    expect(partial.confirmedPaymentsPaise).toBe(50000);
    expect(partial.pendingPaymentsPaise).toBe(70000);
    expect(partial.totalReceivedPaise).toBe(120000);
    expect(partial.balanceRemainingPaise).toBe(70000);
    expect(partial.isFullyPaid).toBe(false);
    expect(partial.isPartiallyPaid).toBe(true);

    // After UPI is confirmed: confirmed = 120000, pending = 0
    const settled = calculatePaymentBreakdown(120000, 120000, 0);
    expect(settled.balanceRemainingPaise).toBe(0);
    expect(settled.isFullyPaid).toBe(true);
    expect(settled.isPartiallyPaid).toBe(false);
  });
});
