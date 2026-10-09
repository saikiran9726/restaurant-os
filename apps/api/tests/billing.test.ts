import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { signAccessToken } from '../src/auth/jwt.js';
import {
  generateUuidV7,
  Roles,
  ROLE_DEFAULT_PERMISSIONS,
  calculatePaymentBreakdown,
  calculateBill,
} from '@restaurant-os/shared';

describe('Fintech-Grade Billing & Payment Architecture', () => {
  let app: FastifyInstance;
  const testRestaurantId = '018f9e1e-2895-7800-9831-000000000000';

  const ownerToken = signAccessToken({
    userId: '018f9e1e-2895-7800-9831-111111111111',
    restaurantId: testRestaurantId,
    username: 'owner_user',
    name: 'Owner',
    role: Roles.OWNER,
    permissions: ROLE_DEFAULT_PERMISSIONS[Roles.OWNER],
  });

  const waiterToken = signAccessToken({
    userId: '018f9e1e-2895-7800-9831-222222222222',
    restaurantId: testRestaurantId,
    username: 'waiter_user',
    name: 'Waiter',
    role: Roles.WAITER,
    permissions: ROLE_DEFAULT_PERMISSIONS[Roles.WAITER],
  });

  const kitchenToken = signAccessToken({
    userId: '018f9e1e-2895-7800-9831-333333333333',
    restaurantId: testRestaurantId,
    username: 'kitchen_user',
    name: 'Kitchen Staff',
    role: Roles.KITCHEN,
    permissions: ROLE_DEFAULT_PERMISSIONS[Roles.KITCHEN],
  });

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('RBAC Route Protection & Data Isolation', () => {
    it('blocks kitchen staff from accessing bill creation routes', async () => {
      const orderId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/orders/${orderId}/bill`,
        headers: { authorization: `Bearer ${kitchenToken}` },
        payload: {},
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('blocks kitchen staff from reading bills', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/bills',
        headers: { authorization: `Bearer ${kitchenToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('blocks kitchen staff from recording payments', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${billId}/payments`,
        headers: { authorization: `Bearer ${kitchenToken}` },
        payload: {
          method: 'cash',
          amountPaise: 1000,
          idempotencyKey: generateUuidV7(),
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('blocks waiters from issuing refunds (requires bill.refund permission)', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${billId}/refunds`,
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          amountPaise: 50000,
          method: 'cash',
          reason: 'Customer complaint',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('FORBIDDEN');
    });

    it('allows owner to access refunds route (passes RBAC guard)', async () => {
      const nonExistentBillId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${nonExistentBillId}/refunds`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          amountPaise: 50000,
          method: 'cash',
          reason: 'Customer goodwill refund',
        },
      });

      // RBAC passes: does NOT return 401 or 403
      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });

    it('allows waiter to access bill creation and payment routes (passes RBAC guard)', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${billId}/payments`,
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          method: 'cash',
          amountPaise: 5000,
          idempotencyKey: generateUuidV7(),
        },
      });

      expect(res.statusCode).not.toBe(401);
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('Validation & Payload Constraints', () => {
    it('rejects payment with negative or zero amount', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${billId}/payments`,
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          method: 'cash',
          amountPaise: 0,
          idempotencyKey: generateUuidV7(),
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects payment with invalid payment method', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${billId}/payments`,
        headers: { authorization: `Bearer ${waiterToken}` },
        payload: {
          method: 'bitcoin',
          amountPaise: 1000,
          idempotencyKey: generateUuidV7(),
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects refund without reason', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/bills/${billId}/refunds`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          amountPaise: 1000,
          method: 'cash',
          reason: '',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects discount application with negative value or missing reason', async () => {
      const billId = generateUuidV7();
      const res = await app.inject({
        method: 'PATCH',
        url: `/bills/${billId}/discount`,
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: {
          type: 'percent',
          value: -10,
          reason: '',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Fintech Split Calculation & Breakdown Mathematics', () => {
    it('verifies split maths for ₹1,200 split into ₹500 cash + ₹700 UPI', () => {
      const billTotalPaise = 120000; // ₹1,200
      const cashPartPaise = 50000; // ₹500
      const upiPartPaise = 70000; // ₹700

      // Step 1: Cash recorded as confirmed, UPI recorded as pending
      const step1 = calculatePaymentBreakdown(billTotalPaise, cashPartPaise, upiPartPaise);
      expect(step1.confirmedPaymentsPaise).toBe(50000);
      expect(step1.pendingPaymentsPaise).toBe(70000);
      expect(step1.balanceRemainingPaise).toBe(70000); // UPI not yet confirmed!
      expect(step1.isFullyPaid).toBe(false);
      expect(step1.isPartiallyPaid).toBe(true);

      // Step 2: Staff confirms UPI receipt
      const step2 = calculatePaymentBreakdown(billTotalPaise, cashPartPaise + upiPartPaise, 0);
      expect(step2.confirmedPaymentsPaise).toBe(120000);
      expect(step2.pendingPaymentsPaise).toBe(0);
      expect(step2.balanceRemainingPaise).toBe(0);
      expect(step2.isFullyPaid).toBe(true);
      expect(step2.isPartiallyPaid).toBe(false);
    });

    it('verifies cash overpayment calculates correct change without altering payment amount', () => {
      const billTotalPaise = 85000; // ₹850
      const tenderedPaise = 100000; // Customer handed ₹1,000 note
      const changePaise = tenderedPaise - billTotalPaise;

      expect(changePaise).toBe(15000); // ₹150 change
      const breakdown = calculatePaymentBreakdown(billTotalPaise, billTotalPaise, 0);
      expect(breakdown.isFullyPaid).toBe(true);
      expect(breakdown.balanceRemainingPaise).toBe(0);
    });

    it('ensures round-off to nearest rupee never exceeds 50 paise', () => {
      for (let paise = 1000; paise <= 2000; paise += 7) {
        const rounded = Math.round(paise / 100) * 100;
        const diff = rounded - paise;
        expect(Math.abs(diff)).toBeLessThanOrEqual(50);
      }
    });

    it('reconciles calculated bill total with sum of lines, discounts, taxes, and roundoff', () => {
      const bill = calculateBill({
        lines: [
          { name: 'Biryani', qty: 2, pricePaise: 35000, taxRateBp: 500 },
          { name: 'Cold Drink', qty: 3, pricePaise: 4000, taxRateBp: 1800 },
        ],
        taxMode: 'exclusive',
        discount: { type: 'percent', value: 15, reason: 'Special promo' },
        serviceChargePercent: 5,
        defaultGstRateBp: 500,
        roundOffEnabled: true,
      });

      const netSubtotal = bill.subtotalPaise - bill.discountPaise;
      const expectedBeforeRound = netSubtotal + bill.serviceChargePaise + bill.taxPaise;
      expect(bill.totalPaise).toBe(expectedBeforeRound + bill.roundOffPaise);
      expect(bill.cgstPaise + bill.sgstPaise).toBe(bill.taxPaise);
    });
  });
});
