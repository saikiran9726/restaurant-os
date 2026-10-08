import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  paiseToRupees,
  roundToPaise,
  isValidPaise,
  formatPaiseToRupeeString,
  parseRupeeStringToPaise,
} from './index.js';

describe('Money Helpers', () => {
  describe('rupeesToPaise', () => {
    it('converts basic rupee amounts accurately', () => {
      expect(rupeesToPaise(1)).toBe(100);
      expect(rupeesToPaise(10.5)).toBe(1050);
      expect(rupeesToPaise(0)).toBe(0);
      expect(rupeesToPaise(99.99)).toBe(9999);
    });

    it('handles floating point precision by rounding', () => {
      // 19.99 * 100 in JS can be 1998.9999999999998
      expect(rupeesToPaise(19.99)).toBe(1999);
      expect(rupeesToPaise(1.005)).toBe(101);
      expect(rupeesToPaise(12.345)).toBe(1235);
    });

    it('handles negative amounts', () => {
      expect(rupeesToPaise(-15.25)).toBe(-1525);
    });

    it('throws on non-finite values', () => {
      expect(() => rupeesToPaise(NaN)).toThrow(TypeError);
      expect(() => rupeesToPaise(Infinity)).toThrow(TypeError);
    });
  });

  describe('paiseToRupees', () => {
    it('converts paise to rupees accurately', () => {
      expect(paiseToRupees(100)).toBe(1);
      expect(paiseToRupees(1050)).toBe(10.5);
      expect(paiseToRupees(0)).toBe(0);
      expect(paiseToRupees(9999)).toBe(99.99);
      expect(paiseToRupees(-1525)).toBe(-15.25);
    });

    it('throws on non-finite values', () => {
      expect(() => paiseToRupees(NaN)).toThrow(TypeError);
    });
  });

  describe('roundToPaise', () => {
    it('rounds fractional paise to nearest integer', () => {
      expect(roundToPaise(100.4)).toBe(100);
      expect(roundToPaise(100.5)).toBe(101);
      expect(roundToPaise(100.9)).toBe(101);
    });
  });

  describe('isValidPaise', () => {
    it('validates safe integer paise', () => {
      expect(isValidPaise(100)).toBe(true);
      expect(isValidPaise(0)).toBe(true);
      expect(isValidPaise(-50)).toBe(true);
      expect(isValidPaise(10.5)).toBe(false);
      expect(isValidPaise('100')).toBe(false);
      expect(isValidPaise(null)).toBe(false);
    });
  });

  describe('formatPaiseToRupeeString (en-IN formatting)', () => {
    it('formats basic paise with ₹ symbol', () => {
      expect(formatPaiseToRupeeString(0)).toBe('₹0.00');
      expect(formatPaiseToRupeeString(100)).toBe('₹1.00');
      expect(formatPaiseToRupeeString(9950)).toBe('₹99.50');
    });

    it('formats thousands, lakhs, and crores using Indian numbering system', () => {
      // 1,000.00
      expect(formatPaiseToRupeeString(100000)).toBe('₹1,000.00');
      // 1,23,456.78
      expect(formatPaiseToRupeeString(12345678)).toBe('₹1,23,456.78');
      // 1,00,00,000.00 (1 Crore)
      expect(formatPaiseToRupeeString(1000000000)).toBe('₹1,00,00,000.00');
    });

    it('formats negative amounts properly', () => {
      expect(formatPaiseToRupeeString(-12345678)).toBe('-₹1,23,456.78');
    });

    it('supports options to omit symbol or decimals', () => {
      expect(formatPaiseToRupeeString(12345678, { includeSymbol: false })).toBe('1,23,456.78');
      expect(formatPaiseToRupeeString(10000, { showDecimals: false })).toBe('₹100');
      expect(formatPaiseToRupeeString(10050, { showDecimals: false })).toBe('₹100.50');
    });
  });

  describe('parseRupeeStringToPaise', () => {
    it('parses formatted rupee strings', () => {
      expect(parseRupeeStringToPaise('₹1,23,456.78')).toBe(12345678);
      expect(parseRupeeStringToPaise('₹ 1,23,456.78')).toBe(12345678);
      expect(parseRupeeStringToPaise('1,23,456.78')).toBe(12345678);
      expect(parseRupeeStringToPaise('₹100')).toBe(10000);
      expect(parseRupeeStringToPaise('50.25')).toBe(5025);
      expect(parseRupeeStringToPaise('-₹50.00')).toBe(-5000);
    });

    it('throws on invalid inputs', () => {
      expect(() => parseRupeeStringToPaise('invalid')).toThrow();
      expect(() => parseRupeeStringToPaise('')).toThrow();
    });
  });
});
