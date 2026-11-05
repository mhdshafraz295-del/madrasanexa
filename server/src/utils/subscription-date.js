/**
 * Subscription Date & Calendar Arithmetic Utilities.
 *
 * Provides safe UTC calendar arithmetic and precise time evaluations
 * to eliminate drift and boundary inconsistencies.
 */

/**
 * Adds an integer number of calendar months to a UTC Date without fixed 30-day drift.
 * Accurately clips days to the end of the target month (e.g., Jan 31 -> Feb 28/29, Aug 31 -> Sep 30).
 *
 * @param {Date|string|number} startDate - Starting date
 * @param {number} months - Number of calendar months to add (must be an integer)
 * @returns {Date} Resulting UTC Date
 */
export function addCalendarMonthsUtc(startDate, months) {
  const d = new Date(startDate);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid startDate provided to addCalendarMonthsUtc');
  }

  const originalDay = d.getUTCDate();
  const originalHours = d.getUTCHours();
  const originalMinutes = d.getUTCMinutes();
  const originalSeconds = d.getUTCSeconds();
  const originalMs = d.getUTCMilliseconds();

  const targetYear = d.getUTCFullYear();
  const targetMonth = d.getUTCMonth() + months;

  // Anchor to day 1 of the target year & month in UTC
  const result = new Date(Date.UTC(targetYear, targetMonth, 1, originalHours, originalMinutes, originalSeconds, originalMs));

  // Determine last day of the target month (day 0 of month + 1)
  const maxDaysInTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();

  // Clamp original day to available month length
  const finalDay = Math.min(originalDay, maxDaysInTargetMonth);
  result.setUTCDate(finalDay);

  return result;
}

/**
 * Computes integer days remaining for display purposes.
 * Clamped at 0 once the end date has been reached.
 *
 * @param {Date|string|number} endsAt - Expiration date
 * @param {Date|string|number} [nowUtc=new Date()] - Reference UTC date
 * @returns {number} Integer days remaining >= 0
 */
export function getSubscriptionDaysRemaining(endsAt, nowUtc = new Date()) {
  const targetMs = new Date(endsAt).getTime();
  const currentMs = new Date(nowUtc).getTime();
  const diffMs = targetMs - currentMs;

  if (diffMs <= 0) {
    return 0;
  }

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Evaluates whether a subscription is within the EXPIRING_SOON window using precise time comparison.
 * Must strictly satisfy: endsAt > nowUtc AND endsAt <= (nowUtc + thresholdDays).
 *
 * @param {Date|string|number} endsAt - Expiration date
 * @param {number} thresholdDays - Number of days configured for expiring soon
 * @param {Date|string|number} [nowUtc=new Date()] - Reference UTC date
 * @returns {boolean} True if within expiring soon window
 */
export function isExpiringSoonPrecise(endsAt, thresholdDays, nowUtc = new Date()) {
  const endMs = new Date(endsAt).getTime();
  const nowMs = new Date(nowUtc).getTime();
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

  return endMs > nowMs && endMs <= (nowMs + thresholdMs);
}

/**
 * Checks if a date has passed relative to UTC reference.
 *
 * @param {Date|string|number} date
 * @param {Date|string|number} [nowUtc=new Date()]
 * @returns {boolean}
 */
export function isDateInPast(date, nowUtc = new Date()) {
  return new Date(date).getTime() <= new Date(nowUtc).getTime();
}

/**
 * Checks if a date is in the future relative to UTC reference.
 *
 * @param {Date|string|number} date
 * @param {Date|string|number} [nowUtc=new Date()]
 * @returns {boolean}
 */
export function isDateInFuture(date, nowUtc = new Date()) {
  return new Date(date).getTime() > new Date(nowUtc).getTime();
}
