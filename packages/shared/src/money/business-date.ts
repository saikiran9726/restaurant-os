/**
 * Business Date Logic for Restaurant OS.
 *
 * In restaurant operations, the business day does not start at 00:00 midnight.
 * By default (05:00 AM start, Asia/Kolkata), a shift running past midnight
 * (e.g. Friday night extending into Saturday 02:30 AM) belongs to Friday's business day.
 */

/**
 * Calculates the canonical YYYY-MM-DD business date string for a given instant.
 *
 * @param date - Date object, ISO string, or epoch milliseconds
 * @param dayStartHour - The hour (0-23) when the new business day starts (default 5, i.e., 05:00 AM)
 * @param timeZone - IANA timezone string (default 'Asia/Kolkata')
 * @returns 'YYYY-MM-DD' formatted business date
 */
export function getBusinessDate(
  date: Date | string | number = new Date(),
  dayStartHour = 5,
  timeZone = 'Asia/Kolkata',
): string {
  const d = typeof date === 'object' ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date provided to getBusinessDate: ${date}`);
  }

  // Shift epoch by -dayStartHour hours.
  // Shifting the timestamp backwards by X hours means that anything between
  // 00:00 and (dayStartHour - 1):59:59 naturally rolls back into the previous calendar date.
  const shiftedMs = d.getTime() - dayStartHour * 60 * 60 * 1000;
  const shiftedDate = new Date(shiftedMs);

  // Format in the target timezone using ISO-standard en-CA (YYYY-MM-DD)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(shiftedDate);
}

/**
 * Adds or subtracts days from a YYYY-MM-DD string in a calendar-safe way.
 */
export function shiftBusinessDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export type ReportRangeOption = 'today' | 'yesterday' | 'weekly' | 'monthly' | 'custom';

/**
 * Resolves date ranges into concrete YYYY-MM-DD bounds.
 */
export function getBusinessDateRange(
  range: ReportRangeOption,
  options?: {
    customStart?: string;
    customEnd?: string;
    dayStartHour?: number;
    timeZone?: string;
    now?: Date;
  },
): {
  startDate: string;
  endDate: string;
  currentBusinessDate: string;
  isSingleDay: boolean;
  daysCount: number;
} {
  const dayStartHour = options?.dayStartHour ?? 5;
  const timeZone = options?.timeZone ?? 'Asia/Kolkata';
  const now = options?.now ?? new Date();

  const currentBusinessDate = getBusinessDate(now, dayStartHour, timeZone);

  let startDate = currentBusinessDate;
  let endDate = currentBusinessDate;

  switch (range) {
    case 'today':
      startDate = currentBusinessDate;
      endDate = currentBusinessDate;
      break;
    case 'yesterday': {
      const yesterday = shiftBusinessDays(currentBusinessDate, -1);
      startDate = yesterday;
      endDate = yesterday;
      break;
    }
    case 'weekly':
      // Last 7 days including today
      startDate = shiftBusinessDays(currentBusinessDate, -6);
      endDate = currentBusinessDate;
      break;
    case 'monthly':
      // Last 30 days including today
      startDate = shiftBusinessDays(currentBusinessDate, -29);
      endDate = currentBusinessDate;
      break;
    case 'custom':
      startDate = options?.customStart || currentBusinessDate;
      endDate = options?.customEnd || currentBusinessDate;
      if (startDate > endDate) {
        // Swap if reversed
        const temp = startDate;
        startDate = endDate;
        endDate = temp;
      }
      break;
  }

  const [y1, m1, d1] = startDate.split('-').map(Number);
  const [y2, m2, d2] = endDate.split('-').map(Number);
  const t1 = Date.UTC(y1!, m1! - 1, d1!);
  const t2 = Date.UTC(y2!, m2! - 1, d2!);
  const daysCount = Math.round((t2 - t1) / (24 * 60 * 60 * 1000)) + 1;

  return {
    startDate,
    endDate,
    currentBusinessDate,
    isSingleDay: startDate === endDate,
    daysCount,
  };
}

/**
 * Formats a YYYY-MM-DD string into a friendly localized display string.
 */
export function formatBusinessDateDisplay(
  dateStr: string,
  options?: { includeWeekday?: boolean; timeZone?: string },
): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };

  if (options?.includeWeekday) {
    formatOptions.weekday = 'short';
  }

  return new Intl.DateTimeFormat('en-IN', formatOptions).format(date);
}
