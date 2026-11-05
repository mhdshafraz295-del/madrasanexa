/**
 * Pure Calculation Engine for MadrasaNexa Marking Hub
 *
 * STRICT RULES:
 * - NO LETTER GRADES (NO A, B, C, D, F)
 * - NO CREDITS / NO CREDIT-BASED GPA
 * - NUMERIC MARKS ONLY
 * - BLANK MARK IS NOT ZERO (REMAINS INCOMPLETE)
 * - COMPETITION TIE RANKING (1, 2, 2, 4)
 * - EXPLICIT DENOMINATORS FOR CLASS AND SUBJECT ANALYTICS
 */

export const DEFAULT_GPA_SCALE = [
  { minPercentage: 85.00, maxPercentage: 100.00, gpa: 4.00 },
  { minPercentage: 75.00, maxPercentage: 84.99, gpa: 3.50 },
  { minPercentage: 65.00, maxPercentage: 74.99, gpa: 3.00 },
  { minPercentage: 55.00, maxPercentage: 64.99, gpa: 2.50 },
  { minPercentage: 45.00, maxPercentage: 54.99, gpa: 2.00 },
  { minPercentage: 40.00, maxPercentage: 44.99, gpa: 1.00 },
  { minPercentage: 0.00, maxPercentage: 39.99, gpa: 0.00 },
];

/**
 * Validates GPA bands for completeness, ordering, and absence of overlaps.
 *
 * @param {Array<{ minPercentage: number, maxPercentage: number, gpa: number }>} bands
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateGpaScale(bands) {
  if (!Array.isArray(bands) || bands.length === 0) {
    return { valid: false, error: 'GPA scale must be a non-empty array of bands.' };
  }

  // Sort descending by maxPercentage
  const sorted = [...bands].sort((a, b) => Number(b.maxPercentage) - Number(a.maxPercentage));

  // Check bounds
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    const min = Number(b.minPercentage);
    const max = Number(b.maxPercentage);
    const gpa = Number(b.gpa);

    if (isNaN(min) || isNaN(max) || isNaN(gpa)) {
      return { valid: false, error: `Invalid numeric values in band ${i + 1}.` };
    }
    if (min < 0 || max > 100 || min > max) {
      return { valid: false, error: `Band ${i + 1} bounds must satisfy 0 <= min (${min}) <= max (${max}) <= 100.` };
    }
    if (gpa < 0 || gpa > 4.00) {
      return { valid: false, error: `GPA must be between 0.00 and 4.00 (got ${gpa}).` };
    }

    // Overlap check with previous band
    if (i > 0) {
      const prev = sorted[i - 1];
      const prevMin = Number(prev.minPercentage);
      if (max >= prevMin) {
        return { valid: false, error: `Overlapping bands detected between [${min}-${max}] and [${prevMin}-${prev.maxPercentage}].` };
      }
    }
  }

  // Must span roughly from 0 to 100
  const highest = Number(sorted[0].maxPercentage);
  const lowest = Number(sorted[sorted.length - 1].minPercentage);

  if (highest < 99.9) {
    return { valid: false, error: `GPA scale must cover up to 100% (highest is ${highest}%).` };
  }
  if (lowest > 0.01) {
    return { valid: false, error: `GPA scale must cover down to 0% (lowest is ${lowest}%).` };
  }

  return { valid: true };
}

/**
 * Calculates student numeric GPA based on overall percentage and active GPA scale.
 *
 * @param {number|null} overallPercentage
 * @param {Array<{ minPercentage: number, maxPercentage: number, gpa: number }>} [scale=DEFAULT_GPA_SCALE]
 * @returns {number|null}
 */
export function calculateStudentGpa(overallPercentage, scale = DEFAULT_GPA_SCALE) {
  if (overallPercentage === null || overallPercentage === undefined || isNaN(overallPercentage)) {
    return null;
  }

  const activeScale = Array.isArray(scale) && scale.length > 0 ? scale : DEFAULT_GPA_SCALE;
  const pct = Number(overallPercentage);

  for (const band of activeScale) {
    const min = Number(band.minPercentage);
    const max = Number(band.maxPercentage);
    if (pct >= min && pct <= max + 0.0001) {
      return Number(Number(band.gpa).toFixed(2));
    }
  }

  // Fallback for floating edge cases
  if (pct > 100) return Number(Number(activeScale[0].gpa).toFixed(2));
  if (pct < 0) return 0.00;

  return 0.00;
}

/**
 * Calculates results for each student in the class assessment.
 *
 * @param {object} params
 * @param {Array<object>} params.students
 * @param {Array<object>} params.assessmentSubjects
 * @param {Map<string, number|null>} params.marksMap key: `${assessmentSubjectId}_${studentId}`
 * @param {Array<object>} [params.gpaScale=DEFAULT_GPA_SCALE]
 * @returns {Array<object>}
 */
export function calculateStudentResults({
  students = [],
  assessmentSubjects = [],
  marksMap = new Map(),
  gpaScale = DEFAULT_GPA_SCALE,
}) {
  const activeScale = Array.isArray(gpaScale) && gpaScale.length > 0 ? gpaScale : DEFAULT_GPA_SCALE;
  const totalMaxPossible = assessmentSubjects.reduce((sum, s) => sum + Number(s.maxMark || 0), 0);

  const results = students.map((student) => {
    let enteredMarksTotal = 0;
    let enteredCount = 0;
    let passedSubjectsCount = 0;
    let failedSubjectsCount = 0;
    let hasAnyFail = false;

    const subjectBreakdown = assessmentSubjects.map((sub) => {
      const key = `${sub.id}_${student.id}`;
      const rawMark = marksMap.get(key);
      const isEntered = rawMark !== null && rawMark !== undefined && rawMark !== '';
      const numMark = isEntered ? Number(rawMark) : null;
      const maxMark = Number(sub.maxMark);
      const passMark = Number(sub.passMark);

      let subjectStatus = 'INCOMPLETE';
      let subjectPercentage = null;

      if (isEntered && !isNaN(numMark)) {
        enteredCount++;
        enteredMarksTotal += numMark;
        subjectPercentage = maxMark > 0 ? Number(((numMark / maxMark) * 100).toFixed(2)) : 0;
        if (numMark >= passMark) {
          subjectStatus = 'PASS';
          passedSubjectsCount++;
        } else {
          subjectStatus = 'FAIL';
          failedSubjectsCount++;
          hasAnyFail = true;
        }
      }

      return {
        assessmentSubjectId: sub.id,
        subjectId: sub.subjectId,
        subjectName: sub.subject?.name || 'Subject',
        subjectCode: sub.subject?.code || null,
        maxMark,
        passMark,
        mark: numMark,
        isEntered,
        percentage: subjectPercentage,
        status: subjectStatus,
      };
    });

    const isComplete = assessmentSubjects.length > 0 && enteredCount === assessmentSubjects.length;

    let totalObtained = null;
    let overallPercentage = null;
    let gpa = null;
    let overallStatus = 'INCOMPLETE';

    if (isComplete) {
      totalObtained = Number(enteredMarksTotal.toFixed(2));
      overallPercentage = totalMaxPossible > 0 ? Number(((totalObtained / totalMaxPossible) * 100).toFixed(2)) : 0;
      gpa = calculateStudentGpa(overallPercentage, activeScale);
      overallStatus = hasAnyFail ? 'FAIL' : 'PASS';
    }

    return {
      studentId: student.id,
      admissionNo: student.admissionNo,
      fullName: student.fullName,
      guardianName: student.guardianName,
      isComplete,
      totalObtained,
      maxPossible: totalMaxPossible,
      overallPercentage,
      gpa,
      overallStatus,
      passedSubjectsCount,
      failedSubjectsCount,
      subjects: subjectBreakdown,
      position: null, // assigned by calculateClassPositions
    };
  });

  return calculateClassPositions(results);
}

/**
 * Assigns competition ranking (1, 2, 2, 4) to completed students.
 * Incomplete students receive position = null.
 *
 * @param {Array<object>} studentResults
 * @returns {Array<object>}
 */
export function calculateClassPositions(studentResults) {
  // Separate completed vs incomplete
  const completed = studentResults.filter((s) => s.isComplete && s.overallPercentage !== null);
  const incomplete = studentResults.filter((s) => !s.isComplete || s.overallPercentage === null);

  // Sort completed by overall percentage descending
  completed.sort((a, b) => b.overallPercentage - a.overallPercentage);

  let currentRank = 1;
  for (let i = 0; i < completed.length; i++) {
    if (i > 0) {
      const prev = completed[i - 1];
      if (completed[i].overallPercentage === prev.overallPercentage) {
        completed[i].position = prev.position;
      } else {
        completed[i].position = i + 1;
      }
    } else {
      completed[i].position = 1;
    }
  }

  incomplete.forEach((s) => {
    s.position = null;
  });

  // Re-merge in original order
  const resultMap = new Map();
  completed.forEach((s) => resultMap.set(s.studentId, s));
  incomplete.forEach((s) => resultMap.set(s.studentId, s));

  return studentResults.map((s) => resultMap.get(s.studentId) || s);
}

/**
 * Calculates class-wide and subject-level analytics.
 *
 * STRICT DENOMINATOR RULES:
 * - Class average %: completed students only
 * - Average GPA: completed students only
 * - Class pass rate: PASS / (PASS + FAIL) (completed students only)
 * - Subject average: students with an entered mark for that subject only
 * - Subject pass rate: PASS / (PASS + FAIL) for that subject
 *
 * @param {object} params
 * @param {Array<object>} params.studentResults
 * @param {Array<object>} params.assessmentSubjects
 * @returns {object}
 */
export function calculateClassAnalytics({ studentResults = [], assessmentSubjects = [] }) {
  const totalStudents = studentResults.length;
  const completedStudents = studentResults.filter((s) => s.isComplete && s.overallPercentage !== null);
  const completedCount = completedStudents.length;

  let classAverage = null;
  let averageGpa = null;
  let highestAverage = null;
  let lowestAverage = null;
  let passRate = null;

  if (completedCount > 0) {
    const sumPct = completedStudents.reduce((acc, s) => acc + s.overallPercentage, 0);
    const sumGpa = completedStudents.reduce((acc, s) => acc + (s.gpa || 0), 0);
    classAverage = Number((sumPct / completedCount).toFixed(2));
    averageGpa = Number((sumGpa / completedCount).toFixed(2));

    highestAverage = Math.max(...completedStudents.map((s) => s.overallPercentage));
    lowestAverage = Math.min(...completedStudents.map((s) => s.overallPercentage));

    const passCount = completedStudents.filter((s) => s.overallStatus === 'PASS').length;
    const failCount = completedStudents.filter((s) => s.overallStatus === 'FAIL').length;
    const evaluatedCount = passCount + failCount;
    passRate = evaluatedCount > 0 ? Number(((passCount / evaluatedCount) * 100).toFixed(2)) : 0;
  }

  // Subject analytics
  const subjectAnalytics = assessmentSubjects.map((sub) => {
    const marks = [];
    let passCount = 0;
    let failCount = 0;

    studentResults.forEach((st) => {
      const subResult = st.subjects?.find((s) => s.assessmentSubjectId === sub.id);
      if (subResult && subResult.isEntered && subResult.mark !== null) {
        marks.push(subResult.mark);
        if (subResult.status === 'PASS') passCount++;
        if (subResult.status === 'FAIL') failCount++;
      }
    });

    const enteredCount = marks.length;
    const maxMark = Number(sub.maxMark);
    const passMark = Number(sub.passMark);

    let averageMark = null;
    let averagePercentage = null;
    let highestMark = null;
    let lowestMark = null;
    let subjectPassRate = null;

    if (enteredCount > 0) {
      const sum = marks.reduce((a, b) => a + b, 0);
      averageMark = Number((sum / enteredCount).toFixed(2));
      averagePercentage = maxMark > 0 ? Number(((averageMark / maxMark) * 100).toFixed(2)) : 0;
      highestMark = Math.max(...marks);
      lowestMark = Math.min(...marks);

      const totalEvaluated = passCount + failCount;
      subjectPassRate = totalEvaluated > 0 ? Number(((passCount / totalEvaluated) * 100).toFixed(2)) : 0;
    }

    return {
      assessmentSubjectId: sub.id,
      subjectId: sub.subjectId,
      subjectName: sub.subject?.name || 'Subject',
      subjectCode: sub.subject?.code || null,
      maxMark,
      passMark,
      enteredCount,
      totalStudents,
      averageMark,
      averagePercentage,
      highestMark,
      lowestMark,
      passCount,
      failCount,
      passRate: subjectPassRate,
    };
  });

  // Top 5 students
  const topStudents = completedStudents
    .sort((a, b) => (a.position || 9999) - (b.position || 9999))
    .slice(0, 5)
    .map((s) => ({
      studentId: s.studentId,
      admissionNo: s.admissionNo,
      fullName: s.fullName,
      position: s.position,
      overallPercentage: s.overallPercentage,
      gpa: s.gpa,
      overallStatus: s.overallStatus,
    }));

  // Students requiring attention: failed 1+ subjects OR low overall %
  const studentsRequiringAttention = studentResults
    .filter((s) => s.failedSubjectsCount > 0 || (s.isComplete && s.overallPercentage !== null && s.overallPercentage < 40))
    .map((s) => {
      const reasons = [];
      if (s.failedSubjectsCount > 0) {
        reasons.push(`${s.failedSubjectsCount} subject${s.failedSubjectsCount > 1 ? 's' : ''} below pass mark`);
      }
      if (s.isComplete && s.overallPercentage !== null && s.overallPercentage < 40) {
        reasons.push(`Low overall average (${s.overallPercentage}%)`);
      }
      return {
        studentId: s.studentId,
        admissionNo: s.admissionNo,
        fullName: s.fullName,
        failedSubjectsCount: s.failedSubjectsCount,
        overallPercentage: s.overallPercentage,
        overallStatus: s.overallStatus,
        attentionReason: reasons.join('; '),
      };
    });

  return {
    summary: {
      totalStudents,
      completedStudents: completedCount,
      incompleteStudents: totalStudents - completedCount,
      subjectsCount: assessmentSubjects.length,
      classAverage,
      averageGpa,
      highestAverage,
      lowestAverage,
      passRate,
    },
    subjectAnalytics,
    topStudents,
    studentsRequiringAttention,
  };
}
