import { describe, it, expect } from 'vitest';
import {
  isValidUpiVpa,
  formatPaiseForUpi,
  generateUpiIntentUrl,
  parseUpiIntentUrl,
} from './upi-qr.js';

describe('Dynamic UPI QR Generator', () => {
  it('validates VPA formats correctly', () => {
    expect(isValidUpiVpa('merchant@icici')).toBe(true);
    expect(isValidUpiVpa('bistro.cafe@okhdfcbank')).toBe(true);
    expect(isValidUpiVpa('user_123@paytm')).toBe(true);
    expect(isValidUpiVpa('user-99@axis')).toBe(true);

    expect(isValidUpiVpa('invalid')).toBe(false);
    expect(isValidUpiVpa('invalid@')).toBe(false);
    expect(isValidUpiVpa('@bank')).toBe(false);
    expect(isValidUpiVpa('inv alid@bank')).toBe(false);
    expect(isValidUpiVpa('')).toBe(false);
  });

  it('formats paise to 2-decimal rupees', () => {
    expect(formatPaiseForUpi(64700)).toBe('647.00');
    expect(formatPaiseForUpi(1250)).toBe('12.50');
    expect(formatPaiseForUpi(99)).toBe('0.99');
    expect(formatPaiseForUpi(5)).toBe('0.05');
    expect(formatPaiseForUpi(0)).toBe('0.00');
  });

  it('generates an NPCI-compliant UPI URI with encoded parameters', () => {
    const url = generateUpiIntentUrl({
      vpa: 'greenbistro@hdfcbank',
      payeeName: 'Green Bistro & Cafe',
      amountPaise: 64700,
      billNumber: 'B-20261008-0001',
      transactionRef: 'REF123456',
    });

    expect(url).toContain('upi://pay?');
    expect(url).toContain('pa=greenbistro%40hdfcbank');
    expect(url).toContain('pn=Green%20Bistro%20%26%20Cafe');
    expect(url).toContain('am=647.00');
    expect(url).toContain('cu=INR');
    expect(url).toContain('tn=B-20261008-0001');
    expect(url).toContain('tr=REF123456');

    const parsed = parseUpiIntentUrl(url);
    expect(parsed.pa).toBe('greenbistro@hdfcbank');
    expect(parsed.pn).toBe('Green Bistro & Cafe');
    expect(parsed.am).toBe('647.00');
    expect(parsed.cu).toBe('INR');
    expect(parsed.tn).toBe('B-20261008-0001');
    expect(parsed.tr).toBe('REF123456');
  });

  it('throws on invalid VPA or non-positive amount', () => {
    expect(() =>
      generateUpiIntentUrl({
        vpa: 'invalid-vpa',
        payeeName: 'Test',
        amountPaise: 5000,
        billNumber: 'B1',
        transactionRef: 'R1',
      }),
    ).toThrow('Invalid UPI VPA');

    expect(() =>
      generateUpiIntentUrl({
        vpa: 'test@upi',
        payeeName: 'Test',
        amountPaise: 0,
        billNumber: 'B1',
        transactionRef: 'R1',
      }),
    ).toThrow('greater than 0 paise');
  });
});
