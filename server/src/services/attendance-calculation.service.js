/**
 * Pure Attendance Calculation Service
 *
 * Implements strict academic formulas for:
 * 1. Daily Attendance Rate: (presentCount / recordedStudentCount) * 100
 * 2. Student Attendance %: (studentPresentRecords / studentTotalRecords) * 100 (protects new joiners)
 * 3. Monthly Class Attendance Rate (weighted): (totalPresentInMonth / totalRecordedInMonth) * 100
 * 4. Average Daily Attendance %: Arithmetic mean of daily session rates in the month
 *
 * All percentages are rounded to 2 decimal places.
 */

/**
 * Calculates summary metrics for a daily attendance session.
 *
 * @param {Array<{ status: 'PRESENT' | 'ABSENT' }>} records
 * @returns {{ totalStudents: number, presentCount: number, absentCount: number, attendanceRate: number }}
 */
export function calculateDailySummary(records = []) {
  const totalStudents = records.length;
  let presentCount = 0;
  let absentCount = 0;

  for (const rec of records) {
    if (rec.status === 'PRESENT') presentCount++;
    else if (rec.status === 'ABSENT') absentCount++;
  }

  const attendanceRate =
    totalStudents > 0 ? Number(((presentCount / totalStudents) * 100).toFixed(2)) : 0.0;

  return {
    totalStudents,
    presentCount,
    absentCount,
    attendanceRate,
  };
}

/**
 * Calculates individual student attendance percentage.
 * Uses only actual recorded sessions for this specific student.
 *
 * @param {number} presentRecords
 * @param {number} totalRecords
 * @returns {number}
 */
export function calculateStudentAttendancePercentage(presentRecords, totalRecords) {
  if (!totalRecords || totalRecords <= 0) return 0.0;
  return Number(((presentRecords / totalRecords) * 100).toFixed(2));
}

/**
 * Calculates the monthly weighted class attendance rate.
 * Total Present Records in Month / Total Recorded Records in Month * 100
 *
 * @param {number} totalPresentInMonth
 * @param {number} totalRecordedInMonth
 * @returns {number}
 */
export function calculateMonthlyClassAttendanceRate(totalPresentInMonth, totalRecordedInMonth) {
  if (!totalRecordedInMonth || totalRecordedInMonth <= 0) return 0.0;
  return Number(((totalPresentInMonth / totalRecordedInMonth) * 100).toFixed(2));
}

/**
 * Calculates the average daily attendance percentage for a month.
 * Arithmetic mean of each valid daily session's attendance rate.
 *
 * @param {number[]} dailyRates
 * @returns {number}
 */
export function calculateAverageDailyAttendanceRate(dailyRates = []) {
  if (!dailyRates || dailyRates.length === 0) return 0.0;
  const sum = dailyRates.reduce((acc, rate) => acc + rate, 0);
  return Number((sum / dailyRates.length).toFixed(2));
}
