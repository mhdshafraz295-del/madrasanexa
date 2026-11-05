/**
 * Centralized Date & Time Utility for MadrasaNexa (Frontend)
 * Guarantees safe calendar date rendering (zero timezone shift for DATE-only values)
 * and institutional timezone conversion for UTC timestamps.
 */

export const DEFAULT_TIMEZONE = 'Asia/Colombo';
export const DEFAULT_DATE_FORMAT = 'DD/MM/YYYY';
export const DEFAULT_TIME_FORMAT = '12_HOUR';

export const SUPPORTED_DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '30/10/2026' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '10/30/2026' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2026-10-30' },
] as const;

export const SUPPORTED_TIME_FORMATS = [
  { value: '12_HOUR', label: '12-Hour (AM / PM)', example: '08:30 AM' },
  { value: '24_HOUR', label: '24-Hour', example: '08:30' },
] as const;

export const WEEKDAYS = [
  { key: 'MONDAY', short: 'Mon', label: 'Monday' },
  { key: 'TUESDAY', short: 'Tue', label: 'Tuesday' },
  { key: 'WEDNESDAY', short: 'Wed', label: 'Wednesday' },
  { key: 'THURSDAY', short: 'Thu', label: 'Thursday' },
  { key: 'FRIDAY', short: 'Fri', label: 'Friday' },
  { key: 'SATURDAY', short: 'Sat', label: 'Saturday' },
  { key: 'SUNDAY', short: 'Sun', label: 'Sunday' },
] as const;

export const COMMON_TIMEZONES = [
  { value: 'Asia/Colombo', label: 'Asia/Colombo (Sri Lanka Time, GMT+5:30)', group: 'South Asia' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (India Standard Time, GMT+5:30)', group: 'South Asia' },
  { value: 'Asia/Dhaka', label: 'Asia/Dhaka (Bangladesh Time, GMT+6:00)', group: 'South Asia' },
  { value: 'Asia/Karachi', label: 'Asia/Karachi (Pakistan Time, GMT+5:00)', group: 'South Asia' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (Saudi Arabia, GMT+3:00)', group: 'Middle East' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UAE, GMT+4:00)', group: 'Middle East' },
  { value: 'Asia/Qatar', label: 'Asia/Qatar (Qatar, GMT+3:00)', group: 'Middle East' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (Singapore, GMT+8:00)', group: 'Southeast Asia' },
  { value: 'Asia/Kuala_Lumpur', label: 'Asia/Kuala Lumpur (Malaysia, GMT+8:00)', group: 'Southeast Asia' },
  { value: 'Asia/Jakarta', label: 'Asia/Jakarta (Indonesia, GMT+7:00)', group: 'Southeast Asia' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)', group: 'Europe' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET, GMT+1:00)', group: 'Europe' },
  { value: 'America/New_York', label: 'America/New York (EST/EDT)', group: 'Americas' },
  { value: 'America/Toronto', label: 'America/Toronto (EST/EDT)', group: 'Americas' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', group: 'Universal' },
];

/**
 * Checks if timezone is valid in browser Intl.
 */
export function isValidTimezone(tz?: string | null): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats a calendar DATE-only field (e.g. attendanceDate, dob, joinDate, examDate)
 * without timezone conversion to prevent calendar date shifts.
 */
export function formatDateOnly(
  dateVal?: string | Date | null,
  format: string = DEFAULT_DATE_FORMAT
): string {
  if (!dateVal) return '-';

  let year: string, month: string, day: string;

  if (typeof dateVal === 'string') {
    const match = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      year = match[1];
      month = match[2];
      day = match[3];
    } else {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';
      year = String(d.getUTCFullYear()).padStart(4, '0');
      month = String(d.getUTCMonth() + 1).padStart(2, '0');
      day = String(d.getUTCDate()).padStart(2, '0');
    }
  } else if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return '-';
    year = String(dateVal.getUTCFullYear()).padStart(4, '0');
    month = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
    day = String(dateVal.getUTCDate()).padStart(2, '0');
  } else {
    return '-';
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
 * Formats an operational time (HH:mm string or Date) into 12-hour or 24-hour display.
 */
export function formatTime(
  timeVal?: string | Date | null,
  timeFormat: string = DEFAULT_TIME_FORMAT,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!timeVal) return '-';

  if (typeof timeVal === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(timeVal.trim())) {
    const [hStr, mStr] = timeVal.trim().split(':');
    const h = parseInt(hStr, 10);

    if (timeFormat === '24_HOUR') {
      return `${String(h).padStart(2, '0')}:${mStr}`;
    }

    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${String(displayH).padStart(2, '0')}:${mStr} ${period}`;
  }

  const d = timeVal instanceof Date ? timeVal : new Date(timeVal);
  if (isNaN(d.getTime())) return '-';

  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: timeFormat !== '24_HOUR',
  }).format(d);
}

/**
 * Formats a UTC timestamp into institutional timezone date & time.
 */
export function formatDateTime(
  timestamp?: string | Date | null,
  settings: { timezone?: string; dateFormat?: string; timeFormat?: string } = {}
): string {
  if (!timestamp) return '-';
  const d = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(d.getTime())) return '-';

  const tz = isValidTimezone(settings.timezone) ? settings.timezone! : DEFAULT_TIMEZONE;
  const dateFormat = settings.dateFormat || DEFAULT_DATE_FORMAT;
  const timeFormat = settings.timeFormat || DEFAULT_TIME_FORMAT;

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
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = partMap.year || '2026';
  const month = partMap.month || '01';
  const day = partMap.day || '01';
  const hour = partMap.hour || '12';
  const minute = partMap.minute || '00';
  const dayPeriod = partMap.dayPeriod ? ` ${partMap.dayPeriod.toUpperCase()}` : '';

  let datePart = `${day}/${month}/${year}`;
  if (dateFormat === 'MM/DD/YYYY') datePart = `${month}/${day}/${year}`;
  if (dateFormat === 'YYYY-MM-DD') datePart = `${year}-${month}-${day}`;

  return `${datePart} ${hour}:${minute}${dayPeriod}`;
}

export interface LiveClockSettings {
  timezone?: string;
  dateFormat?: string;
  timeFormat?: string;
}

/**
 * Returns formatted current institutional time string for live clock.
 * Supports passing either a timezone string or a full LiveClockSettings object.
 */
export function getInstitutionalLiveClock(settings: LiveClockSettings | string = DEFAULT_TIMEZONE) {
  const opts = typeof settings === 'string' ? { timezone: settings } : settings;
  const tz = isValidTimezone(opts.timezone) ? opts.timezone! : DEFAULT_TIMEZONE;
  const timeFormat = opts.timeFormat || DEFAULT_TIME_FORMAT;
  const dateFormat = opts.dateFormat || DEFAULT_DATE_FORMAT;
  const now = new Date();

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: timeFormat !== '24_HOUR',
  });

  const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
  });

  const longDateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = dateFormatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }
  const year = partMap.year || '2026';
  const month = partMap.month || '01';
  const day = partMap.day || '01';

  let formattedDate = `${day}/${month}/${year}`;
  if (dateFormat === 'MM/DD/YYYY') formattedDate = `${month}/${day}/${year}`;
  if (dateFormat === 'YYYY-MM-DD') formattedDate = `${year}-${month}-${day}`;

  const tzNameFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  });
  const tzParts = tzNameFormatter.formatToParts(now);
  const offsetPart = tzParts.find((p) => p.type === 'timeZoneName')?.value || 'UTC';

  return {
    timeString: timeFormatter.format(now),
    dateString: longDateFormatter.format(now),
    formattedDate,
    weekday: weekdayFormatter.format(now),
    timezone: tz,
    offset: offsetPart,
    fullTimezoneDisplay: `${tz} (${offsetPart})`,
  };
}
