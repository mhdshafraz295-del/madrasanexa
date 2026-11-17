/**
 * Institutional Live Clock helper for Teacher Portal
 * Standardized to Asia/Colombo (GMT+5:30)
 */

export const DEFAULT_TIMEZONE = 'Asia/Colombo';

export function getTeacherLiveClock(timezone: string = DEFAULT_TIMEZONE) {
  const tz = timezone || DEFAULT_TIMEZONE;
  const now = new Date();

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
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
  const formattedDate = `${day}/${month}/${year}`;

  return {
    timeString: timeFormatter.format(now),
    dateString: longDateFormatter.format(now),
    formattedDate,
    weekday: weekdayFormatter.format(now),
    timezone: tz,
    fullTimezoneDisplay: `${tz} (GMT+5:30)`,
  };
}
