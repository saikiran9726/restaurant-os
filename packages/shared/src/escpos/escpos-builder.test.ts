import { describe, it, expect } from 'vitest';
import { EscPosBuilder } from './escpos-builder.js';
import {
  formatReceiptPlainText,
  buildReceiptEscPos,
  type ReceiptData,
} from './receipt-formatter.js';

describe('EscPosBuilder', () => {
  it('generates standard init and alignment bytes', () => {
    const builder = new EscPosBuilder();
    builder.init().align('center');
    const bytes = builder.build();

    // 0x1B 0x40 (init), 0x1B 0x61 0x01 (align center)
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    expect(bytes[2]).toBe(0x1b);
    expect(bytes[3]).toBe(0x61);
    expect(bytes[4]).toBe(0x01);
  });

  it('generates bold, double size, underline, and invert commands', () => {
    const builder = new EscPosBuilder();
    builder.bold(true).doubleSize(true).underline(true).invert(true);
    const bytes = builder.build();

    expect(Array.from(bytes)).toEqual([
      0x1b,
      0x45,
      0x01, // Bold ON
      0x1d,
      0x21,
      0x11, // Double size ON
      0x1b,
      0x2d,
      0x01, // Underline ON
      0x1d,
      0x42,
      0x01, // Invert ON
    ]);
  });

  it('generates cut and cash drawer pulse commands', () => {
    const builder = new EscPosBuilder();
    builder.pulseDrawer(2).cut(true);
    const bytes = builder.build();

    // Drawer: 0x1B 0x70 0x00 0x19 0xFA
    expect(bytes.slice(0, 5)).toEqual(new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]));
    // Feed 3 blank lines: 0x1B 0x64 0x03
    expect(bytes.slice(5, 8)).toEqual(new Uint8Array([0x1b, 0x64, 0x03]));
    // Cut partial: 0x1D 0x56 0x42 0x00
    expect(bytes.slice(8, 12)).toEqual(new Uint8Array([0x1d, 0x56, 0x42, 0x00]));
  });

  it('generates native ESC/POS Model 2 QR code command packets', () => {
    const builder = new EscPosBuilder();
    const qrData = 'upi://pay?pa=restaurant@icici&am=500.00';
    builder.qrCode(qrData, { size: 5, errorCorrection: 'M' });
    const bytes = builder.build();

    // Model 2 header: 1D 28 6B 04 00 31 41 32 00
    expect(bytes.slice(0, 9)).toEqual(
      new Uint8Array([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    );
    // Size packet: 1D 28 6B 03 00 31 43 05
    expect(bytes.slice(9, 17)).toEqual(
      new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05]),
    );
    // EC packet: 1D 28 6B 03 00 31 45 49 (49 = 'M')
    expect(bytes.slice(17, 25)).toEqual(
      new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 49]),
    );
    // Print packet at the end: 1D 28 6B 03 00 31 51 30
    expect(bytes.slice(-8)).toEqual(
      new Uint8Array([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
    );
  });

  it('replaces Rupee symbol with "Rs." when rupeeMode is text_rs', () => {
    const builder = new EscPosBuilder({ rupeeMode: 'text_rs' });
    builder.text('Total: ₹1,200.00');
    const bytes = builder.build();
    const str = new TextDecoder().decode(bytes);

    expect(str).toContain('Total: Rs.1,200.00');
    expect(str).not.toContain('₹');
  });

  it('correctly wraps two-column lines for 58mm (32 chars) and 80mm (48 chars)', () => {
    const builder58 = new EscPosBuilder({ widthMm: 58, charsPerLine: 32 });
    builder58.twoColumn('Paneer Butter Masala', 'Rs.320.00');
    const text58 = new TextDecoder().decode(builder58.build());

    // Should contain line break for long dish name
    expect(text58).toContain('Paneer Butter');
    expect(text58).toContain('Rs.320.00');

    const builder80 = new EscPosBuilder({ widthMm: 80, charsPerLine: 48 });
    builder80.twoColumn('Paneer Butter Masala', 'Rs.320.00');
    const text80 = new TextDecoder().decode(builder80.build());
    // Fits comfortably in 48 characters on one line
    expect(text80.split('\n')[0]?.length).toBe(48);
  });
});

describe('Receipt Formatter', () => {
  const sampleReceipt: ReceiptData = {
    restaurantName: 'The Royal Spoon',
    restaurantAddress: '123 MG Road, Bengaluru',
    restaurantPhone: '9876543210',
    restaurantGstin: '29ABCDE1234F1Z5',
    billNumber: 'B-20261008-0001',
    orderType: 'dine_in',
    tableName: 'T4',
    waiterName: 'Ramesh',
    date: '2026-10-08T19:30:00Z',
    lines: [
      {
        name: 'Butter Naan',
        qty: 2,
        pricePaise: 6000,
        totalPaise: 12000,
      },
      {
        name: 'Paneer Butter Masala',
        qty: 1,
        pricePaise: 32000,
        totalPaise: 32000,
      },
    ],
    subtotalPaise: 44000,
    discountPaise: 4400,
    discountReason: 'Welcome 10%',
    serviceChargePaise: 0,
    cgstPaise: 990,
    sgstPaise: 990,
    roundOffPaise: 20,
    totalPaise: 41600,
    paidPaise: 20000,
    balanceDuePaise: 21600,
    payments: [
      {
        method: 'cash',
        amountPaise: 20000,
        status: 'confirmed',
      },
    ],
    upiQrPayload: 'upi://pay?pa=spoon@icici&am=216.00&tn=B-20261008-0001',
  };

  it('generates clean plain text receipt with dynamic balance due and UPI section', () => {
    const plainText = formatReceiptPlainText(sampleReceipt, { widthMm: 80 });

    expect(plainText).toContain('The Royal Spoon');
    expect(plainText).toContain('GSTIN: 29ABCDE1234F1Z5');
    expect(plainText).toContain('Bill: B-20261008-0001');
    expect(plainText).toContain('Table: T4');
    expect(plainText).toContain('Butter Naan');
    expect(plainText).toContain('Paneer Butter Masala');
    expect(plainText).toContain('Subtotal:');
    expect(plainText).toContain('Discount (Welcome 10%):');
    expect(plainText).toContain('CGST:');
    expect(plainText).toContain('SGST:');
    expect(plainText).toContain('GRAND TOTAL:');
    expect(plainText).toContain('BALANCE DUE:');
    expect(plainText).toContain('SCAN TO PAY Rs.216.00');
    expect(plainText).toContain('UPI DYNAMIC QR CODE');
  });

  it('displays DUPLICATE COPY banner when marked duplicate or reprint', () => {
    const duplicateReceipt: ReceiptData = {
      ...sampleReceipt,
      isDuplicate: true,
      printedCount: 2,
    };

    const text = formatReceiptPlainText(duplicateReceipt, { widthMm: 80 });
    expect(text).toContain('*** DUPLICATE COPY ***');
    expect(text).toContain('(Reprint #2)');
  });

  it('builds complete ESC/POS binary buffer without throwing', () => {
    const bytes = buildReceiptEscPos(sampleReceipt, { widthMm: 80, autoCut: true });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(100);

    // Verify first command is init (0x1B, 0x40)
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);

    // Verify cut command is included at end
    const lastBytes = Array.from(bytes.slice(-4));
    expect(lastBytes).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });
});
