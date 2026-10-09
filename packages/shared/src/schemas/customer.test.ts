import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber, computeCustomerSegment, type SegmentSettings } from './customer.js';

describe('Customer Phone Normalization', () => {
  it('normalizes clean 10-digit mobile numbers to E.164 (+91)', () => {
    expect(normalizePhoneNumber('9876543210')).toBe('+919876543210');
    expect(normalizePhoneNumber('6123456789')).toBe('+916123456789');
    expect(normalizePhoneNumber('7000011111')).toBe('+917000011111');
    expect(normalizePhoneNumber('8999900000')).toBe('+918999900000');
  });

  it('normalizes formatted phone numbers with spaces, brackets, hyphens', () => {
    expect(normalizePhoneNumber('98765 43210')).toBe('+919876543210');
    expect(normalizePhoneNumber('+91 98765-43210')).toBe('+919876543210');
    expect(normalizePhoneNumber('(98765) 43210')).toBe('+919876543210');
    expect(normalizePhoneNumber('919876543210')).toBe('+919876543210');
    expect(normalizePhoneNumber('09876543210')).toBe('+919876543210');
  });

  it('throws on invalid or non-Indian mobile formats', () => {
    expect(() => normalizePhoneNumber('12345')).toThrow('Invalid mobile number');
    expect(() => normalizePhoneNumber('5123456789')).toThrow('Invalid mobile number'); // Must start with 6-9
    expect(() => normalizePhoneNumber('abcdefghij')).toThrow('Invalid mobile number');
    expect(() => normalizePhoneNumber('')).toThrow();
  });
});

describe('Customer Segment Rules & Classification', () => {
  const defaultSettings: SegmentSettings = {
    regularMinVisits: 4,
    highValueMinSpentPaise: 500000, // ₹5,000
    inactiveDays: 45,
  };

  it('classifies customer with 1 visit as "new"', () => {
    const result = computeCustomerSegment(
      {
        visitCount: 1,
        totalSpentPaise: 45000,
        lastVisitAt: new Date(),
        daysSinceLastVisit: 0,
      },
      defaultSettings,
    );

    expect(result.segment).toBe('new');
    expect(result.reason).toContain('First visit');
  });

  it('classifies customer with 2 visits and low spend as "returning"', () => {
    const result = computeCustomerSegment(
      {
        visitCount: 2,
        totalSpentPaise: 90000,
        lastVisitAt: new Date(),
        daysSinceLastVisit: 5,
      },
      defaultSettings,
    );

    expect(result.segment).toBe('returning');
    expect(result.reason).toContain('2 lifetime visits');
  });

  it('classifies customer meeting regular visit threshold as "regular"', () => {
    const result = computeCustomerSegment(
      {
        visitCount: 5,
        totalSpentPaise: 200000,
        recentVisitsLast60Days: 4,
        lastVisitAt: new Date(),
        daysSinceLastVisit: 3,
        averageVisitIntervalDays: 10,
      },
      defaultSettings,
    );

    expect(result.segment).toBe('regular');
    expect(result.reason).toContain('4 visits in the last 60 days');
  });

  it('classifies customer meeting spend threshold as "high_value"', () => {
    const result = computeCustomerSegment(
      {
        visitCount: 2,
        totalSpentPaise: 650000, // ₹6,500
        lastVisitAt: new Date(),
        daysSinceLastVisit: 4,
      },
      defaultSettings,
    );

    expect(result.segment).toBe('high_value');
    expect(result.reason).toContain('High lifetime spend');
  });

  it('classifies customer absent beyond inactive threshold as "inactive"', () => {
    const result = computeCustomerSegment(
      {
        visitCount: 6,
        totalSpentPaise: 300000,
        lastVisitAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
        daysSinceLastVisit: 50,
      },
      defaultSettings,
    );

    expect(result.segment).toBe('inactive');
    expect(result.reason).toContain('threshold: 45 days');
  });

  it('classifies previously regular customer whose absence exceeds 1.5x cadence as "at_risk"', () => {
    const result = computeCustomerSegment(
      {
        visitCount: 6,
        totalSpentPaise: 250000,
        lastVisitAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        daysSinceLastVisit: 25,
        averageVisitIntervalDays: 10, // Usually visits every 10 days, now 25 days gap (> 15)
        recentVisitsLast60Days: 2,
      },
      defaultSettings,
    );

    expect(result.segment).toBe('at_risk');
    expect(result.reason).toContain('exceeds 1.5× usual visit cadence');
  });
});
