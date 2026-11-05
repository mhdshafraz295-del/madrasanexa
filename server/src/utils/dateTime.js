/**
 * Centralized Date & Time Utility for MadrasaNexa
 * Handles institutional timezone conversion, date formatting, and time formatting safely.
 */

export const SUPPORTED_DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
export const SUPPORTED_TIME_FORMATS = ['12_HOUR', '24_HOUR'];
export const DEFAULT_TIMEZONE = 'Asia/Colombo';
export const DEFAULT_DATE_FORMAT = 'DD/MM/YYYY';
export const DEFAULT_TIME_FORMAT = '12_HOUR';

export const VALID_WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export const DEFAULT_WORKING_DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

export const DEFAULT_WEEKLY_HOLIDAYS = ['SUNDAY'];

/**
 * Checks whether a timezone identifier is supported by Intl.
 * @param {string} tz
 * @returns {boolean}
 */
export function isValidTimezone(tz) {
  if (typeof tz !== 'string' || !tz.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates a 24-hour HH:mm time string (e.g. "07:30", "16:45").
 * @param {string} val
 * @returns {boolean}
 */
export function isValidTimeString(val) {
  if (typeof val !== 'string') return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(val.trim());
}

/**
 * Converts HH:mm string to minutes from midnight (0 - 1439).
 * @param {string} timeStr
 * @returns {number}
 */
export function timeStringToMinutes(timeStr) {
  if (!isValidTimeString(timeStr)) return 0;
  const [hours, minutes] = timeStr.trim().split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Formats a calendar DATE-only value without timezone shifting.
 * Safely extracts year, month, and day to preserve exact historical date.
 *
 * @param {string|Date} dateVal - ISO date string "YYYY-MM-DD" or Date object
 * @param {string} [format='DD/MM/YYYY']
 * @returns {string}
 */
export function formatDateOnly(dateVal, format = DEFAULT_DATE_FORMAT) {
  if (!dateVal) return '';

  let year, month, day;

  if (typeof dateVal === 'string') {
    // If it's a string starting with YYYY-MM-DD
    const match = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      year = match[1];
      month = match[2];
      day = match[3];
    } else {
      const parsed = new Date(dateVal);
      if (isNaN(parsed.getTime())) return '';
      year = String(parsed.getUTCFullYear()).padStart(4, '0');
      month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      day = String(parsed.getUTCDate()).padStart(2, '0');
    }
  } else if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return '';
    // For @db.Date from Prisma/MySQL, UTC parts hold the exact calendar date
    year = String(dateVal.getUTCFullYear()).padStart(4, '0');
    month = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
    day = String(dateVal.getUTCDate()).padStart(2, '0');
  } else {
    return '';
  }

  switch (format) {
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Formats an operational time string (HH:mm in 24h) or Date into 12H (AM/PM) or 24H.
 *
 * @param {string|Date} timeVal - "07:30" or Date
 * @param {string} [timeFormat='12_HOUR']
 * @param {string} [timezone='Asia/Colombo']
 * @returns {string}
 */
export function formatTime(timeVal, timeFormat = DEFAULT_TIME_FORMAT, timezone = DEFAULT_TIMEZONE) {
  if (!timeVal) return '';

  if (typeof timeVal === 'string' && isValidTimeString(timeVal)) {
    const [hStr, mStr] = timeVal.trim().split(':');
    const h = parseInt(hStr, 10);
    const m = mStr;

    if (timeFormat === '24_HOUR') {
      return `${String(h).padStart(2, '0')}:${m}`;
    }

    // 12_HOUR AM/PM
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${String(displayH).padStart(2, '0')}:${m} ${period}`;
  }

  if (timeVal instanceof Date || typeof timeVal === 'string') {
    const d = timeVal instanceof Date ? timeVal : new Date(timeVal);
    if (isNaN(d.getTime())) return '';

    const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat !== '24_HOUR',
    }).format(d);
  }

  return '';
}

/**
 * Formats a timestamp (UTC in database) converted to institutional timezone.
 *
 * @param {Date|string} timestamp
 * @param {object} settings
 * @param {string} [settings.timezone='Asia/Colombo']
 * @param {string} [settings.dateFormat='DD/MM/YYYY']
 * @param {string} [settings.timeFormat='12_HOUR']
 * @returns {string}
 */
export function formatDateTime(timestamp, settings = {}) {
  if (!timestamp) return '';
  const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(d.getTime())) return '';

  const tz = isValidTimezone(settings.timezone) ? settings.timezone : DEFAULT_TIMEZONE;
  const dateFormat = settings.dateFormat || DEFAULT_DATE_FORMAT;
  const timeFormat = settings.timeFormat || DEFAULT_TIME_FORMAT;

  // Format parts in institutional timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat !== '24_HOUR',
  });

  const parts = formatter.formatToParts(d);
  const partMap = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = partMap.year;
  const month = partMap.month;
  const day = partMap.day;
  const hour = partMap.hour;
  const minute = partMap.minute;
  const dayPeriod = partMap.dayPeriod ? ` ${partMap.dayPeriod.toUpperCase()}` : '';

  let datePart = `${day}/${month}/${year}`;
  if (dateFormat === 'MM/DD/YYYY') datePart = `${month}/${day}/${year}`;
  if (dateFormat === 'YYYY-MM-DD') datePart = `${year}-${month}-${day}`;

  const timePart = `${hour}:${minute}${dayPeriod}`;
  return `${datePart} ${timePart}`;
}
