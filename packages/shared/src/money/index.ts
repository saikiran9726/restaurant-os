/**
 * Money utilities for Restaurant OS.
 * All monetary amounts in database & business logic are stored as integer paise (1 INR = 100 paise)
 * to avoid floating point precision issues.
 */

/**
 * Converts rupees (e.g. 150.50) to integer paise (15050).
 */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) {
    throw new TypeError('Rupees must be a finite number');
  }
  // Use decimal-safe exponential notation to prevent IEEE 754 precision issues (e.g. 1.005 * 100)
  const sign = rupees < 0 ? -1 : 1;
  const abs = Math.abs(rupees);
  return sign * Math.round(Number(`${abs}e2`));
}

/**
 * Converts integer paise (e.g. 15050) to rupees (150.50).
 */
export function paiseToRupees(paise: number): number {
  if (!Number.isFinite(paise)) {
    throw new TypeError('Paise must be a finite number');
  }
  return paise / 100;
}

/**
 * Rounds any fractional paise to the nearest integer paise.
 */
export function roundToPaise(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError('Value must be a finite number');
  }
  return Math.round(value);
}

/**
 * Checks if a value is a valid integer paise representation.
 */
export function isValidPaise(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export interface FormatCurrencyOptions {
  /**
   * If true, always shows 2 decimal digits (paise). Default: true.
   * If false and paise is a round rupee amount, decimal part may be omitted.
   */
  showDecimals?: boolean;
  /**
   * Whether to include the currency symbol '₹'. Default: true.
   */
  includeSymbol?: boolean;
}

/**
 * Formats integer paise into an Indian numbering system string (en-IN).
 * e.g., 12345678 paise -> "₹1,23,456.78"
 */
export function formatPaiseToRupeeString(
  paise: number,
  options: FormatCurrencyOptions = {},
): string {
  const { showDecimals = true, includeSymbol = true } = options;

  if (!Number.isFinite(paise)) {
    throw new TypeError('Paise must be a finite number');
  }

  const roundedPaise = Math.round(paise);
  const rupees = roundedPaise / 100;
  const isNegative = rupees < 0;
  const absRupees = Math.abs(rupees);

  // Indian number formatting with 2 decimals
  const fractionDigits = showDecimals ? 2 : Number.isInteger(rupees) ? 0 : 2;

  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  const formattedNumber = formatter.format(absRupees);
  const symbolPrefix = includeSymbol ? '₹' : '';
  const sign = isNegative ? '-' : '';

  return `${sign}${symbolPrefix}${formattedNumber}`;
}

/**
 * Parses a rupee string into integer paise.
 * Supports strings like "₹1,23,456.50", "123456.50", "-₹50.00", "50".
 */
export function parseRupeeStringToPaise(input: string): number {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string');
  }

  const cleaned = input.trim().replace(/[₹,\s]/g, '');

  if (cleaned === '' || isNaN(Number(cleaned))) {
    throw new Error(`Invalid rupee string format: "${input}"`);
  }

  const rupees = parseFloat(cleaned);
  return Math.round(rupees * 100);
}
