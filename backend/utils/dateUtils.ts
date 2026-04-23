// backend/utils/dateUtils.ts

/**
 * Safely converts input into a Date object.
 * Throws if invalid.
 */
function toDate(date: Date | string): Date {
  const parsed = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(parsed.getTime())) {
    throw new Error('Invalid date provided');
  }

  return parsed;
}

/**
 * Format date to ISO or custom format.
 * Default: ISO string.
 */
export function formatDate(
  date: Date | string,
  format?: Intl.DateTimeFormatOptions,
  locale = 'en-US',
): string {
  const parsed = toDate(date);

  if (!format) {
    return parsed.toISOString();
  }

  return new Intl.DateTimeFormat(locale, format).format(parsed);
}

/**
 * Parse a date safely.
 * Returns null instead of throwing.
 */
export function parseDate(dateString: string): Date | null {
  const parsed = new Date(dateString);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Validate if input is a valid date.
 */
export function isValidDate(date: unknown): boolean {
  if (!date) return false;

  const parsed = typeof date === 'string' ? new Date(date) : (date as Date);

  return parsed instanceof Date && !isNaN(parsed.getTime());
}

/**
 * Get difference between two dates.
 */
export function getDateDifference(
  start: Date | string,
  end: Date | string,
  unit: 'days' | 'hours' | 'minutes' | 'seconds' = 'days',
): number {
  const startDate = toDate(start);
  const endDate = toDate(end);

  const diffMs = endDate.getTime() - startDate.getTime();

  switch (unit) {
    case 'days':
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    case 'hours':
      return Math.floor(diffMs / (1000 * 60 * 60));
    case 'minutes':
      return Math.floor(diffMs / (1000 * 60));
    case 'seconds':
      return Math.floor(diffMs / 1000);
    default:
      throw new Error('Unsupported unit');
  }
}

/**
 * Get relative time string (e.g., "2 days ago")
 */
export function getRelativeTime(date: Date | string): string {
  const parsed = toDate(date);
  const now = new Date();

  const diffMs = now.getTime() - parsed.getTime();
  const isFuture = diffMs < 0;

  const absDiff = Math.abs(diffMs);

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let value: number;
  let unit: string;

  if (days > 0) {
    value = days;
    unit = 'day';
  } else if (hours > 0) {
    value = hours;
    unit = 'hour';
  } else if (minutes > 0) {
    value = minutes;
    unit = 'minute';
  } else {
    value = seconds;
    unit = 'second';
  }

  const plural = value !== 1 ? 's' : '';

  return isFuture ? `in ${value} ${unit}${plural}` : `${value} ${unit}${plural} ago`;
}

/**
 * Convert date to a specific timezone using Intl API.
 */
export function formatInTimezone(
  date: Date | string,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
  locale = 'en-US',
): string {
  const parsed = toDate(date);

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    ...(options || {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  }).format(parsed);
}
