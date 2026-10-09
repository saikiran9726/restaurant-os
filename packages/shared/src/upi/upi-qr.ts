/**
 * Dynamic UPI QR Code generator for Restaurant OS.
 * Builds standard NPCI-compliant UPI payment intent URLs (upi://pay?...).
 */

export interface DynamicUpiParams {
  vpa: string; // e.g. "restaurant@icici"
  payeeName: string; // e.g. "Green Garden Bistro"
  amountPaise: number; // Exact amount due in integer paise
  billNumber: string; // Used as transaction note (tn)
  transactionRef: string; // Unique transaction reference (tr)
}

/**
 * Validates UPI Virtual Payment Address (VPA) / UPI ID format.
 * Format: username@bankhandle (e.g. merchant@okhdfcbank, cashier@paytm)
 */
export function isValidUpiVpa(vpa: string): boolean {
  if (!vpa || typeof vpa !== 'string') return false;
  const trimmed = vpa.trim();
  // Alphanumeric with dots, dashes, underscores before @, alphabetic/alphanumeric handle after @
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}$/;
  return upiRegex.test(trimmed);
}

/**
 * Converts integer paise into standard 2-decimal rupee string for UPI.
 * E.g., 64700 -> "647.00", 50 -> "0.50"
 */
export function formatPaiseForUpi(amountPaise: number): string {
  if (amountPaise < 0) {
    throw new Error('UPI payment amount cannot be negative');
  }
  const rupees = (amountPaise / 100).toFixed(2);
  return rupees;
}

/**
 * Generates an NPCI-compliant UPI payment intent URL.
 * Example:
 * upi://pay?pa=restaurant%40icici&pn=Green%20Garden&am=647.00&cu=INR&tn=B-20261008-0001&tr=B202610080001
 */
export function generateUpiIntentUrl(params: DynamicUpiParams): string {
  const { vpa, payeeName, amountPaise, billNumber, transactionRef } = params;

  if (!isValidUpiVpa(vpa)) {
    throw new Error(`Invalid UPI VPA: "${vpa}". Must follow username@bank format.`);
  }

  if (amountPaise <= 0) {
    throw new Error('UPI payment amount must be greater than 0 paise.');
  }

  const am = formatPaiseForUpi(amountPaise);
  const pa = encodeURIComponent(vpa.trim());
  const pn = encodeURIComponent(payeeName.trim());
  const tn = encodeURIComponent(billNumber.trim());
  const tr = encodeURIComponent(transactionRef.trim());

  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}&tr=${tr}`;
}

/**
 * Extracts and parses parameters from an existing UPI URL for verification or display.
 */
export function parseUpiIntentUrl(url: string): Record<string, string> {
  if (!url.startsWith('upi://pay?')) {
    throw new Error('Not a valid upi://pay URI');
  }
  const queryString = url.slice('upi://pay?'.length);
  const searchParams = new URLSearchParams(queryString);
  const result: Record<string, string> = {};
  searchParams.forEach((val, key) => {
    result[key] = val;
  });
  return result;
}
