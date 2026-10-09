import { EscPosBuilder, type EscPosOptions } from './escpos-builder.js';
import { formatPaiseToRupeeString } from '../money/index.js';

export interface ReceiptLineItem {
  name: string;
  qty: number;
  pricePaise: number;
  totalPaise: number;
  modifiers?: string[];
  note?: string;
}

export interface ReceiptPaymentItem {
  method: string;
  amountPaise: number;
  status: string;
}

export interface ReceiptData {
  restaurantName: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  restaurantGstin?: string;
  billNumber: string;
  orderType?: 'dine_in' | 'takeaway';
  tableName?: string;
  waiterName?: string;
  date: string | Date;
  lines: ReceiptLineItem[];
  subtotalPaise: number;
  discountPaise: number;
  discountReason?: string;
  serviceChargePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  paidPaise: number;
  balanceDuePaise: number;
  payments?: ReceiptPaymentItem[];
  isDuplicate?: boolean;
  isReprint?: boolean;
  printedCount?: number;
  upiQrPayload?: string;
}

export interface ReceiptTemplateConfig extends EscPosOptions {
  headerLines?: string[];
  footerLines?: string[];
  showGstin?: boolean;
  showTable?: boolean;
  showWaiter?: boolean;
  showItemNotes?: boolean;
  showServiceCharge?: boolean;
  showQr?: boolean;
  autoCut?: boolean;
  drawerPulse?: boolean;
}

/**
 * Generates human-readable monospace plain text suitable for UI preview,
 * logging, or browser printing.
 */
export function formatReceiptPlainText(
  receipt: ReceiptData,
  config: ReceiptTemplateConfig = {},
): string {
  const width = config.charsPerLine ?? (config.widthMm === 58 ? 32 : 48);
  const out: string[] = [];

  const divider = (char = '-') => char.repeat(width);
  const center = (str: string) => {
    const pad = Math.max(0, Math.floor((width - str.length) / 2));
    return ' '.repeat(pad) + str;
  };
  const twoCol = (left: string, right: string) => {
    const rightLen = right.length;
    const maxLeftLen = width - rightLen - 1;
    if (left.length <= maxLeftLen) {
      const spaces = width - left.length - rightLen;
      return left + ' '.repeat(Math.max(1, spaces)) + right;
    }
    const l1 = left.slice(0, maxLeftLen);
    const l2 = left.slice(maxLeftLen).trim();
    const spaces = width - l1.length - rightLen;
    return `${l1}${' '.repeat(Math.max(1, spaces))}${right}\n  ${l2}`;
  };

  const fmtRs = (paise: number) => {
    const s = formatPaiseToRupeeString(paise);
    return config.rupeeMode === 'symbol' ? s : s.replace('₹', 'Rs.');
  };

  // Duplicate / Reprint Banner
  if (receipt.isDuplicate || receipt.isReprint || (receipt.printedCount ?? 0) > 1) {
    out.push(divider('*'));
    out.push(center('*** DUPLICATE COPY ***'));
    if ((receipt.printedCount ?? 0) > 1) {
      out.push(center(`(Reprint #${receipt.printedCount})`));
    }
    out.push(divider('*'));
  }

  // Header Lines
  if (config.headerLines && config.headerLines.length > 0) {
    for (const h of config.headerLines) {
      if (h.trim()) out.push(center(h.trim()));
    }
  }

  // Restaurant details
  out.push(center(receipt.restaurantName));
  if (receipt.restaurantAddress) {
    out.push(center(receipt.restaurantAddress));
  }
  if (receipt.restaurantPhone) {
    out.push(center(`Ph: ${receipt.restaurantPhone}`));
  }
  if (config.showGstin !== false && receipt.restaurantGstin) {
    out.push(center(`GSTIN: ${receipt.restaurantGstin}`));
  }

  out.push(divider('='));

  // Bill metadata
  out.push(
    twoCol(`Bill: ${receipt.billNumber}`, new Date(receipt.date).toLocaleDateString('en-IN')),
  );
  const metaSecondLeft = receipt.tableName
    ? `Table: ${receipt.tableName}`
    : receipt.orderType === 'takeaway'
      ? 'Takeaway'
      : 'Dine-In';
  const metaSecondRight = receipt.waiterName ? `Server: ${receipt.waiterName}` : '';
  out.push(twoCol(metaSecondLeft, metaSecondRight));

  out.push(divider('-'));

  // Items table header
  if (width >= 40) {
    // 80mm format: Item (24), Qty (6), Rate (8), Total (10)
    out.push(twoCol('Item                     Qty   Rate', 'Total'));
  } else {
    // 58mm format: Item x Qty, Total
    out.push(twoCol('Item x Qty', 'Total'));
  }
  out.push(divider('-'));

  // Item rows
  for (const item of receipt.lines) {
    const totalStr = fmtRs(item.totalPaise);
    if (width >= 40) {
      const itemTitle = item.name.length > 22 ? item.name.slice(0, 22) : item.name.padEnd(22);
      const qtyStr = String(item.qty).padStart(4);
      const rateStr = fmtRs(item.pricePaise).padStart(9);
      out.push(twoCol(`${itemTitle} ${qtyStr} ${rateStr}`, totalStr));
    } else {
      out.push(twoCol(`${item.name} x${item.qty}`, totalStr));
    }

    if (item.modifiers && item.modifiers.length > 0) {
      out.push(`  + ${item.modifiers.join(', ')}`);
    }
    if (config.showItemNotes !== false && item.note) {
      out.push(`  * Note: ${item.note}`);
    }
  }

  out.push(divider('-'));

  // Subtotal & Financial Breakdown
  out.push(twoCol('Subtotal:', fmtRs(receipt.subtotalPaise)));

  if (receipt.discountPaise > 0) {
    const discLabel = receipt.discountReason
      ? `Discount (${receipt.discountReason}):`
      : 'Discount:';
    out.push(twoCol(discLabel, `-${fmtRs(receipt.discountPaise)}`));
  }

  if (receipt.cgstPaise > 0 || receipt.sgstPaise > 0) {
    out.push(twoCol('CGST:', fmtRs(receipt.cgstPaise)));
    out.push(twoCol('SGST:', fmtRs(receipt.sgstPaise)));
  }

  if (config.showServiceCharge !== false && receipt.serviceChargePaise > 0) {
    out.push(twoCol('Service Charge:', fmtRs(receipt.serviceChargePaise)));
  }

  if (receipt.roundOffPaise !== 0) {
    const roundStr =
      receipt.roundOffPaise > 0
        ? `+${fmtRs(receipt.roundOffPaise)}`
        : `-${fmtRs(Math.abs(receipt.roundOffPaise))}`;
    out.push(twoCol('Round Off:', roundStr));
  }

  out.push(divider('='));
  out.push(twoCol('GRAND TOTAL:', fmtRs(receipt.totalPaise)));
  out.push(divider('='));

  // Payment settlement details
  if (receipt.payments && receipt.payments.length > 0) {
    for (const p of receipt.payments) {
      out.push(twoCol(`Paid (${p.method.toUpperCase()}):`, fmtRs(p.amountPaise)));
    }
  }

  if (receipt.balanceDuePaise <= 0) {
    out.push(center('*** PAID IN FULL ***'));
  } else {
    out.push(twoCol('BALANCE DUE:', fmtRs(receipt.balanceDuePaise)));
    if (config.showQr !== false && receipt.upiQrPayload) {
      out.push('');
      out.push(center(`[ SCAN TO PAY ${fmtRs(receipt.balanceDuePaise)} ]`));
      out.push(center('[ UPI DYNAMIC QR CODE ]'));
      out.push(center('(Verify payment upon staff confirmation)'));
    }
  }

  // Footer Lines
  out.push(divider('-'));
  if (config.footerLines && config.footerLines.length > 0) {
    for (const f of config.footerLines) {
      if (f.trim()) out.push(center(f.trim()));
    }
  } else {
    out.push(center('Thank you for dining with us!'));
    out.push(center('Please visit again.'));
  }

  return out.join('\n');
}

/**
 * Builds binary ESC/POS Uint8Array commands matching the configured receipt layout.
 */
export function buildReceiptEscPos(
  receipt: ReceiptData,
  config: ReceiptTemplateConfig = {},
): Uint8Array {
  const builder = new EscPosBuilder({
    widthMm: config.widthMm ?? 80,
    charsPerLine: config.charsPerLine,
    rupeeMode: config.rupeeMode ?? 'text_rs',
    codePage: config.codePage ?? 0,
  });

  const width = builder.charsPerLine;
  const fmtRs = (paise: number) => {
    const s = formatPaiseToRupeeString(paise);
    return builder.rupeeMode === 'symbol' ? s : s.replace('₹', 'Rs.');
  };

  builder.init();

  // Cash Drawer kick if enabled
  if (config.drawerPulse) {
    builder.pulseDrawer(2);
  }

  // Duplicate / Reprint Banner
  if (receipt.isDuplicate || receipt.isReprint || (receipt.printedCount ?? 0) > 1) {
    builder.align('center').bold(true).invert(true);
    builder.textLine('   *** DUPLICATE COPY ***   ');
    builder.invert(false);
    if ((receipt.printedCount ?? 0) > 1) {
      builder.textLine(`(Reprint #${receipt.printedCount})`);
    }
    builder.bold(false).feed(1);
  }

  // Header Lines
  builder.align('center');
  if (config.headerLines && config.headerLines.length > 0) {
    for (const h of config.headerLines) {
      if (h.trim()) builder.textLine(h.trim());
    }
  }

  // Restaurant Header
  builder
    .bold(true)
    .doubleHeight(true)
    .textLine(receipt.restaurantName)
    .doubleHeight(false)
    .bold(false);
  if (receipt.restaurantAddress) builder.textLine(receipt.restaurantAddress);
  if (receipt.restaurantPhone) builder.textLine(`Ph: ${receipt.restaurantPhone}`);
  if (config.showGstin !== false && receipt.restaurantGstin) {
    builder.textLine(`GSTIN: ${receipt.restaurantGstin}`);
  }

  builder.align('left');
  builder.horizontalLine('=');

  // Metadata
  builder.twoColumn(
    `Bill: ${receipt.billNumber}`,
    new Date(receipt.date).toLocaleDateString('en-IN'),
  );
  const metaSecondLeft = receipt.tableName
    ? `Table: ${receipt.tableName}`
    : receipt.orderType === 'takeaway'
      ? 'Takeaway'
      : 'Dine-In';
  const metaSecondRight = receipt.waiterName ? `Server: ${receipt.waiterName}` : '';
  builder.twoColumn(metaSecondLeft, metaSecondRight);

  builder.horizontalLine('-');

  // Column header
  if (width >= 40) {
    builder.bold(true).twoColumn('Item                     Qty   Rate', 'Total').bold(false);
  } else {
    builder.bold(true).twoColumn('Item x Qty', 'Total').bold(false);
  }
  builder.horizontalLine('-');

  // Items
  for (const item of receipt.lines) {
    const totalStr = fmtRs(item.totalPaise);
    if (width >= 40) {
      const itemTitle = item.name.length > 22 ? item.name.slice(0, 22) : item.name.padEnd(22);
      const qtyStr = String(item.qty).padStart(4);
      const rateStr = fmtRs(item.pricePaise).padStart(9);
      builder.twoColumn(`${itemTitle} ${qtyStr} ${rateStr}`, totalStr);
    } else {
      builder.twoColumn(`${item.name} x${item.qty}`, totalStr);
    }

    if (item.modifiers && item.modifiers.length > 0) {
      builder.textLine(`  + ${item.modifiers.join(', ')}`);
    }
    if (config.showItemNotes !== false && item.note) {
      builder.textLine(`  * Note: ${item.note}`);
    }
  }

  builder.horizontalLine('-');

  // Subtotal & Financials
  builder.twoColumn('Subtotal:', fmtRs(receipt.subtotalPaise));

  if (receipt.discountPaise > 0) {
    const discLabel = receipt.discountReason
      ? `Discount (${receipt.discountReason}):`
      : 'Discount:';
    builder.twoColumn(discLabel, `-${fmtRs(receipt.discountPaise)}`);
  }

  if (receipt.cgstPaise > 0 || receipt.sgstPaise > 0) {
    builder.twoColumn('CGST:', fmtRs(receipt.cgstPaise));
    builder.twoColumn('SGST:', fmtRs(receipt.sgstPaise));
  }

  if (config.showServiceCharge !== false && receipt.serviceChargePaise > 0) {
    builder.twoColumn('Service Charge:', fmtRs(receipt.serviceChargePaise));
  }

  if (receipt.roundOffPaise !== 0) {
    const roundStr =
      receipt.roundOffPaise > 0
        ? `+${fmtRs(receipt.roundOffPaise)}`
        : `-${fmtRs(Math.abs(receipt.roundOffPaise))}`;
    builder.twoColumn('Round Off:', roundStr);
  }

  builder.horizontalLine('=');
  builder.bold(true).doubleHeight(true);
  builder.twoColumn('GRAND TOTAL:', fmtRs(receipt.totalPaise));
  builder.doubleHeight(false).bold(false);
  builder.horizontalLine('=');

  // Payments & Balance Due
  if (receipt.payments && receipt.payments.length > 0) {
    for (const p of receipt.payments) {
      builder.twoColumn(`Paid (${p.method.toUpperCase()}):`, fmtRs(p.amountPaise));
    }
  }

  if (receipt.balanceDuePaise <= 0) {
    builder.feed(1).align('center').bold(true).textLine('*** PAID IN FULL ***').bold(false);
  } else {
    builder.bold(true).twoColumn('BALANCE DUE:', fmtRs(receipt.balanceDuePaise)).bold(false);

    // Dynamic UPI QR code
    if (config.showQr !== false && receipt.upiQrPayload) {
      builder.feed(1).align('center');
      builder
        .bold(true)
        .textLine(`SCAN TO PAY ${fmtRs(receipt.balanceDuePaise)}`)
        .bold(false);
      builder.qrCode(receipt.upiQrPayload, {
        size: builder.widthMm === 58 ? 4 : 6,
        errorCorrection: 'M',
      });
      builder.feed(1);
      builder.textLine('(Payment confirmed upon staff approval)');
    }
  }

  // Footer
  builder.horizontalLine('-');
  builder.align('center');
  if (config.footerLines && config.footerLines.length > 0) {
    for (const f of config.footerLines) {
      if (f.trim()) builder.textLine(f.trim());
    }
  } else {
    builder.textLine('Thank you for dining with us!');
    builder.textLine('Please visit again.');
  }

  // Auto-cut
  if (config.autoCut !== false) {
    builder.cut(true);
  } else {
    builder.feed(4);
  }

  return builder.build();
}
