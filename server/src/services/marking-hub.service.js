import { prisma } from '../lib/prisma.js';
import { ConflictError, NotFoundError, BadRequestError } from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import { createSubject, getSubject } from './subject.service.js';
import {
  DEFAULT_GPA_SCALE,
  validateGpaScale,
  calculateStudentResults,
  calculateClassAnalytics,
} from './marking-calculation.service.js';
import { renderRawHtmlToPdf, escapeHtml } from './pdf-report.service.js';
import { resolveLogoDataUri } from './branding.service.js';
import { generateCsvString } from './csv-report.service.js';
import dayjs from 'dayjs';

/**
 * Lists marking assessments for the authenticated Madrasa.
 *
 * @param {string} madrasaId
 * @param {{ classId?: string, academicYear?: string, term?: string }} [filters={}]
 * @returns {Promise<Array<object>>}
 */
export async function listAssessments(madrasaId, filters = {}) {
  const where = { madrasaId };

  if (filters.classId) {
    where.classId = filters.classId;
  }
  if (filters.academicYear) {
    where.academicYear = filters.academicYear;
  }
  if (filters.term) {
    where.term = filters.term;
  }

  const assessments = await prisma.markingAssessment.findMany({
    where,
    orderBy: [
      { academicYear: 'desc' },
      { createdAt: 'desc' },
    ],
    include: {
      class: {
        select: {
          id: true,
          name: true,
          code: true,
          academicSection: {
            select: { id: true, name: true },
          },
        },
      },
      assessmentSubjects: {
        select: {
          id: true,
          subjectId: true,
          maxMark: true,
          passMark: true,
          sortOrder: true,
          subject: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      _count: {
        select: {
          assessmentSubjects: true,
        },
      },
    },
  });

  return assessments;
}

/**
 * Creates a new Marking Assessment session for a class.
 *
 * @param {string} madrasaId
 * @param {string} userId
 * @param {{ classId: string, academicYear: string, term: string, name: string }} data
 * @returns {Promise<object>}
 */
export async function createAssessment(madrasaId, userId, data) {
  const { classId, academicYear, term, name } = data;

  // Validate Class tenant ownership
  const targetClass = await prisma.class.findFirst({
    where: { id: classId, madrasaId, isActive: true },
  });
  if (!targetClass) {
    throw new NotFoundError('Class not found or inactive.');
  }

  // Check unique assessment context
  const existing = await prisma.markingAssessment.findFirst({
    where: {
      madrasaId,
      classId,
      academicYear: academicYear.trim(),
      term: term.trim(),
      name: name.trim(),
    },
  });
  if (existing) {
    throw new ConflictError(
      `An assessment named "${name}" already exists for class "${targetClass.name}" in ${academicYear} ${term}.`
    );
  }

  const assessment = await prisma.markingAssessment.create({
    data: {
      madrasaId,
      classId,
      academicYear: academicYear.trim(),
      term: term.trim(),
      name: name.trim(),
      status: 'DRAFT',
      createdById: userId,
    },
    include: {
      class: { select: { id: true, name: true, code: true } },
      assessmentSubjects: {
        include: { subject: true },
      },
    },
  });

  await logTenantActivity({
    madrasaId,
    userId,
    action: 'MARKING_ASSESSMENT_CREATED',
    entityType: 'MarkingAssessment',
    entityId: assessment.id,
    metadata: {
      assessmentName: assessment.name,
      className: targetClass.name,
      academicYear: assessment.academicYear,
      term: assessment.term,
    },
  });

  return assessment;
}

/**
 * Retrieves a single assessment ensuring strict tenant ownership.
 *
 * @param {string} madrasaId
 * @param {string} assessmentId
 * @returns {Promise<object>}
 */
export async function getAssessment(madrasaId, assessmentId) {
  const assessment = await prisma.markingAssessment.findFirst({
    where: { id: assessmentId, madrasaId },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          code: true,
          academicSection: { select: { id: true, name: true } },
        },
      },
      assessmentSubjects: {
        include: {
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!assessment) {
    throw new NotFoundError('Marking assessment not found.');
  }

  return assessment;
}

/**
 * Updates basic metadata of an assessment (only when in DRAFT state).
 *
 * @param {string} madrasaId
 * @param {string} assessmentId
 * @param {{ academicYear?: string, term?: string, name?: string }} data
 * @returns {Promise<object>}
 */
export async function updateAssessment(madrasaId, assessmentId, data) {
  const assessment = await getAssessment(madrasaId, assessmentId);

  if (assessment.status === 'FINALIZED') {
    throw new BadRequestError('Assessment is finalized and read-only. Reopen the assessment before making changes.');
  }

  const updateData = {};
  if (data.name) updateData.name = data.name.trim();
  if (data.academicYear) updateData.academicYear = data.academicYear.trim();
  if (data.term) updateData.term = data.term.trim();

  return await prisma.markingAssessment.update({
    where: { id: assessmentId },
    data: updateData,
    include: {
      class: true,
      assessmentSubjects: { include: { subject: true } },
    },
  });
}

/**
 * Finalizes an assessment session:
 * - Validates current tenant GPA scale
 * - Atomically captures gpaScaleSnapshot
 * - Marks status = FINALIZED
 * - Result becomes truly read-only
 *
 * @param {string} madrasaId
 * @param {string} userId
 * @param {string} assessmentId
 * @returns {Promise<object>}
 */
export async function finalizeAssessment(madrasaId, userId, assessmentId) {
  const assessment = await getAssessment(madrasaId, assessmentId);

  if (assessment.status === 'FINALIZED') {
    return assessment;
  }

  // Load current tenant GPA scale
  const setting = await prisma.madrasaSetting.findUnique({
    where: { madrasaId },
  });

  let activeScale = DEFAULT_GPA_SCALE;
  if (setting?.gpaScale && Array.isArray(setting.gpaScale) && setting.gpaScale.length > 0) {
    const check = validateGpaScale(setting.gpaScale);
    if (check.valid) {
      activeScale = setting.gpaScale;
    }
  }

  const finalized = await prisma.markingAssessment.update({
    where: { id: assessmentId },
    data: {
      status: 'FINALIZED',
      gpaScaleSnapshot: activeScale,
    },
    include: {
      class: true,
      assessmentSubjects: { include: { subject: true } },
    },
  });

  await logTenantActivity({
    madrasaId,
    userId,
    action: 'MARKING_ASSESSMENT_FINALIZED',
    entityType: 'MarkingAssessment',
    entityId: assessmentId,
    metadata: {
      assessmentName: finalized.name,
      className: finalized.class?.name,
    },
  });

  return finalized;
}

/**
 * Reopens a finalized assessment session back to DRAFT state.
 * Requires explicit action and logs activity.
 *
 * @param {string} madrasaId
 * @param {string} userId
 * @param {string} assessmentId
 * @returns {Promise<object>}
 */
export async function reopenAssessment(madrasaId, userId, assessmentId) {
  const assessment = await getAssessment(madrasaId, assessmentId);

  if (assessment.status === 'DRAFT') {
    return assessment;
  }

  const draft = await prisma.markingAssessment.update({
    where: { id: assessmentId },
    data: {
      status: 'DRAFT',
    },
    include: {
      class: true,
      assessmentSubjects: { include: { subject: true } },
    },
  });

  await logTenantActivity({
    madrasaId,
    userId,
    action: 'MARKING_ASSESSMENT_REOPENED',
    entityType: 'MarkingAssessment',
    entityId: assessmentId,
    metadata: {
      assessmentName: draft.name,
      className: draft.class?.name,
    },
  });

  return draft;
}

/**
 * Adds a subject to an assessment session (select existing or create canonical subject).
 *
 * @param {string} madrasaId
 * @param {string} assessmentId
 * @param {{ subjectId?: string, newSubject?: object, maxMark: number, passMark: number, sortOrder?: number }} data
 * @returns {Promise<object>}
 */
export async function addAssessmentSubject(madrasaId, assessmentId, data) {
  const assessment = await getAssessment(madrasaId, assessmentId);

  if (assessment.status === 'FINALIZED') {
    throw new BadRequestError('Assessment is finalized and read-only. Reopen to add subjects.');
  }

  let targetSubjectId = data.subjectId;

  if (data.newSubject) {
    const created = await createSubject(madrasaId, data.newSubject);
    targetSubjectId = created.id;
  } else if (targetSubjectId) {
    // Assert tenant ownership
    await getSubject(madrasaId, targetSubjectId);
  } else {
    throw new BadRequestError('Subject ID or new subject details required.');
  }

  // Check duplicate subject in assessment
  const existing = await prisma.markingAssessmentSubject.findUnique({
    where: {
      assessmentId_subjectId: {
        assessmentId,
        subjectId: targetSubjectId,
      },
    },
  });

  if (existing) {
    throw new ConflictError('This subject has already been added to the assessment.');
  }

  const assessmentSubject = await prisma.markingAssessmentSubject.create({
    data: {
      madrasaId,
      assessmentId,
      subjectId: targetSubjectId,
      maxMark: data.maxMark,
      passMark: data.passMark,
      sortOrder: data.sortOrder || 0,
    },
    include: {
      subject: true,
    },
  });

  return assessmentSubject;
}

/**
 * Removes a subject from an assessment.
 * Prevents removal if marks already exist for this subject.
 *
 * @param {string} madrasaId
 * @param {string} assessmentId
 * @param {string} assessmentSubjectId
 * @param {{ force?: boolean }} [options={}]
 * @returns {Promise<{ success: boolean }>}
 */
export async function removeAssessmentSubject(madrasaId, assessmentId, assessmentSubjectId, options = {}) {
  const assessment = await getAssessment(madrasaId, assessmentId);

  if (assessment.status === 'FINALIZED') {
    throw new BadRequestError('Assessment is finalized and read-only.');
  }

  const target = await prisma.markingAssessmentSubject.findFirst({
    where: { id: assessmentSubjectId, assessmentId, madrasaId },
  });

  if (!target) {
    throw new NotFoundError('Assessment subject not found.');
  }

  // Check if student marks exist
  const existingMarksCount = await prisma.studentMark.count({
    where: {
      assessmentSubjectId,
      mark: { not: null },
    },
  });

  if (existingMarksCount > 0 && !options.force) {
    throw new BadRequestError(
      `Cannot remove subject because ${existingMarksCount} student mark(s) have been entered. Confirm removal to proceed.`
    );
  }

  // Delete subject from assessment (cascades to marks for this assessment)
  await prisma.markingAssessmentSubject.delete({
    where: { id: assessmentSubjectId },
  });

  return { success: true };
}

/**
 * Loads the complete marks matrix, calculated results, and analytics for an assessment.
 *
 * @param {string} madrasaId
 * @param {string} assessmentId
 * @returns {Promise<object>}
 */
export async function getAssessmentMarks(madrasaId, assessmentId) {
  const assessment = await getAssessment(madrasaId, assessmentId);

  // 1. Fetch eligible students for this class
  const students = await prisma.student.findMany({
    where: {
      madrasaId,
      classId: assessment.classId,
      status: 'ACTIVE',
    },
    orderBy: { admissionNo: 'asc' },
    select: {
      id: true,
      admissionNo: true,
      fullName: true,
      guardianName: true,
    },
  });

  // 2. Fetch assessment subjects
  const assessmentSubjects = assessment.assessmentSubjects || [];

  // 3. Fetch entered marks
  const studentMarks = await prisma.studentMark.findMany({
    where: {
      madrasaId,
      assessmentSubjectId: { in: assessmentSubjects.map((s) => s.id) },
    },
  });

  // Build lookup map
  const marksMap = new Map();
  studentMarks.forEach((m) => {
    marksMap.set(`${m.assessmentSubjectId}_${m.studentId}`, m.mark !== null ? Number(m.mark) : null);
  });

  // 4. Resolve authoritative GPA scale
  let gpaScaleToUse = DEFAULT_GPA_SCALE;
  if (assessment.status === 'FINALIZED' && assessment.gpaScaleSnapshot) {
    gpaScaleToUse = assessment.gpaScaleSnapshot;
  } else {
    const setting = await prisma.madrasaSetting.findUnique({
      where: { madrasaId },
      select: { gpaScale: true },
    });
    if (setting?.gpaScale && Array.isArray(setting.gpaScale) && setting.gpaScale.length > 0) {
      gpaScaleToUse = setting.gpaScale;
    }
  }

  // 5. Calculate authoritative student results & analytics
  const studentResults = calculateStudentResults({
    students,
    assessmentSubjects,
    marksMap,
    gpaScale: gpaScaleToUse,
  });

  const analytics = calculateClassAnalytics({
    studentResults,
    assessmentSubjects,
  });

  return {
    assessment: {
      id: assessment.id,
      name: assessment.name,
      academicYear: assessment.academicYear,
      term: assessment.term,
      status: assessment.status,
      class: assessment.class,
    },
    subjects: assessmentSubjects,
    students,
    results: studentResults,
    analytics,
    gpaScaleUsed: gpaScaleToUse,
  };
}

/**
 * Bulk saves student marks safely in a single transaction.
 *
 * @param {string} madrasaId
 * @param {string} userId
 * @param {string} assessmentId
 * @param {Array<{ studentId: string, assessmentSubjectId: string, mark: number|null }>} marksArray
 * @returns {Promise<object>}
 */
export async function saveAssessmentMarks(madrasaId, userId, assessmentId, marksArray) {
  const assessment = await getAssessment(madrasaId, assessmentId);

  if (assessment.status === 'FINALIZED') {
    throw new BadRequestError('Assessment is finalized and read-only. Reopen to edit marks.');
  }

  // Fetch valid subjects and students for verification
  const validSubjects = await prisma.markingAssessmentSubject.findMany({
    where: { assessmentId, madrasaId },
    select: { id: true, maxMark: true },
  });
  const subjectMap = new Map();
  validSubjects.forEach((s) => subjectMap.set(s.id, Number(s.maxMark)));

  const validStudents = await prisma.student.findMany({
    where: { classId: assessment.classId, madrasaId, status: 'ACTIVE' },
    select: { id: true },
  });
  const studentSet = new Set(validStudents.map((s) => s.id));

  // Validate all marks before executing writes
  for (const item of marksArray) {
    if (!studentSet.has(item.studentId)) {
      throw new BadRequestError(`Student ${item.studentId} is not in class ${assessment.class?.name}.`);
    }
    const max = subjectMap.get(item.assessmentSubjectId);
    if (max === undefined) {
      throw new BadRequestError(`Assessment subject ${item.assessmentSubjectId} is not valid for this assessment.`);
    }

    if (item.mark !== null && item.mark !== undefined) {
      const num = Number(item.mark);
      if (isNaN(num) || num < 0 || num > max) {
        throw new BadRequestError(`Mark ${item.mark} is invalid. Must be between 0 and maximum mark (${max}).`);
      }
    }
  }

  // Safe transactional bulk upsert
  await prisma.$transaction(async (tx) => {
    for (const item of marksArray) {
      const numMark = item.mark !== null && item.mark !== undefined ? Number(item.mark) : null;

      await tx.studentMark.upsert({
        where: {
          assessmentSubjectId_studentId: {
            assessmentSubjectId: item.assessmentSubjectId,
            studentId: item.studentId,
          },
        },
        update: {
          mark: numMark,
          updatedById: userId,
        },
        create: {
          madrasaId,
          assessmentSubjectId: item.assessmentSubjectId,
          studentId: item.studentId,
          mark: numMark,
          createdById: userId,
          updatedById: userId,
        },
      });
    }
  });

  await logTenantActivity({
    madrasaId,
    userId,
    action: 'MARKS_UPDATED',
    entityType: 'MarkingAssessment',
    entityId: assessmentId,
    metadata: {
      count: marksArray.length,
      assessmentName: assessment.name,
    },
  });

  // Return refreshed results
  return await getAssessmentMarks(madrasaId, assessmentId);
}

/**
 * Retrieves the tenant's configured GPA settings or default.
 *
 * @param {string} madrasaId
 * @returns {Promise<Array<object>>}
 */
export async function getGpaSettings(madrasaId) {
  const setting = await prisma.madrasaSetting.findUnique({
    where: { madrasaId },
    select: { gpaScale: true },
  });

  if (setting?.gpaScale && Array.isArray(setting.gpaScale) && setting.gpaScale.length > 0) {
    return setting.gpaScale;
  }

  return DEFAULT_GPA_SCALE;
}

/**
 * Updates tenant GPA settings.
 *
 * @param {string} madrasaId
 * @param {string} userId
 * @param {Array<object>} bands
 * @returns {Promise<Array<object>>}
 */
export async function updateGpaSettings(madrasaId, userId, bands) {
  const check = validateGpaScale(bands);
  if (!check.valid) {
    throw new BadRequestError(check.error || 'Invalid GPA bands configuration.');
  }

  const sortedBands = [...bands].sort((a, b) => Number(b.maxPercentage) - Number(a.maxPercentage));

  await prisma.madrasaSetting.upsert({
    where: { madrasaId },
    update: { gpaScale: sortedBands },
    create: {
      madrasaId,
      currency: 'LKR',
      timezone: 'Asia/Colombo',
      gpaScale: sortedBands,
    },
  });

  await logTenantActivity({
    madrasaId,
    userId,
    action: 'GPA_SETTINGS_UPDATED',
    entityType: 'MadrasaSetting',
    entityId: madrasaId,
  });

  return sortedBands;
}

/**
 * Generates ONE COMBINED PDF for all students in the class.
 * Exactly 1 student report per page using CSS page breaks.
 *
 * @param {string} madrasaId
 * @param {string} assessmentId
 * @returns {Promise<Buffer>}
 */
export async function generateAllStudentsPdf(madrasaId, assessmentId) {
  const data = await getAssessmentMarks(madrasaId, assessmentId);
  const { assessment, subjects, results, analytics } = data;

  const madrasa = await prisma.madrasa.findUnique({
    where: { id: madrasaId },
    include: { settings: true },
  });

  let logoDataUri = null;
  try {
    logoDataUri = await resolveLogoDataUri(madrasaId);
  } catch (e) {
    logoDataUri = null;
  }

  const madrasaName = escapeHtml(madrasa?.name || 'Madrasa');
  const madrasaAddress = escapeHtml(madrasa?.address || '');
  const madrasaPhone = escapeHtml(madrasa?.phone || '');
  const className = escapeHtml(assessment.class?.name || 'Class');
  const academicYear = escapeHtml(assessment.academicYear || '');
  const term = escapeHtml(assessment.term || '');
  const assessmentName = escapeHtml(assessment.name || '');

  // Build multi-page HTML
  const pagesHtml = results.map((student, idx) => {
    const isFirstPage = idx === 0;

    const subjectsRowsHtml = student.subjects.map((sub) => {
      const markDisplay = sub.isEntered && sub.mark !== null ? Number(sub.mark).toFixed(1) : '—';
      const pctDisplay = sub.percentage !== null ? `${sub.percentage}%` : '—';
      const statusColor = sub.status === 'PASS' ? '#059669' : sub.status === 'FAIL' ? '#DC2626' : '#6B7280';

      return `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 10px 12px; font-weight: 600; color: #111827;">
            ${escapeHtml(sub.subjectName)}
            ${sub.subjectCode ? `<span style="font-size: 11px; color: #6B7280; margin-left: 4px;">(${escapeHtml(sub.subjectCode)})</span>` : ''}
          </td>
          <td style="padding: 10px 12px; text-align: center; font-weight: 700; color: #111827;">${markDisplay}</td>
          <td style="padding: 10px 12px; text-align: center; color: #4B5563;">${sub.maxMark}</td>
          <td style="padding: 10px 12px; text-align: center; color: #4B5563;">${sub.passMark}</td>
          <td style="padding: 10px 12px; text-align: center; font-weight: 600; color: #374151;">${pctDisplay}</td>
          <td style="padding: 10px 12px; text-align: center; font-weight: 700; color: ${statusColor};">${sub.status}</td>
        </tr>
      `;
    }).join('');

    const totalDisplay = student.isComplete ? `${student.totalObtained} / ${student.maxPossible}` : '—';
    const averageDisplay = student.isComplete && student.overallPercentage !== null ? `${student.overallPercentage}%` : '—';
    const gpaDisplay = student.isComplete && student.gpa !== null ? Number(student.gpa).toFixed(2) : '—';
    const positionDisplay = student.isComplete && student.position !== null ? `${student.position} / ${analytics.summary.completedStudents}` : '—';

    const resultBadgeBg = student.overallStatus === 'PASS' ? '#DEF7EC' : student.overallStatus === 'FAIL' ? '#FDE8E8' : '#F3F4F6';
    const resultBadgeColor = student.overallStatus === 'PASS' ? '#03543F' : student.overallStatus === 'FAIL' ? '#9B1C1C' : '#374151';

    return `
      <div class="report-page" style="${!isFirstPage ? 'page-break-before: always;' : ''} padding: 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <!-- Institutional Header -->
        <div style="border-bottom: 2px solid #0F172A; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 16px;">
            ${logoDataUri ? `<img src="${logoDataUri}" alt="Logo" style="height: 52px; width: 52px; object-fit: contain; border-radius: 8px; border: 1px solid #E5E7EB; padding: 2px;" />` : ''}
            <div>
              <h1 style="font-size: 20px; font-weight: 800; color: #0F172A; margin: 0; line-height: 1.2;">${madrasaName}</h1>
              <p style="font-size: 11px; color: #4B5563; margin: 3px 0 0 0;">${madrasaAddress}${madrasaPhone ? ` • Phone: ${madrasaPhone}` : ''}</p>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: 700; color: #37C6A3; text-transform: uppercase; letter-spacing: 0.05em;">Academic Assessment</div>
            <div style="font-size: 14px; font-weight: 800; color: #0F172A; margin-top: 2px;">STUDENT REPORT CARD</div>
          </div>
        </div>

        <!-- Student & Assessment Meta Grid -->
        <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px;">
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; display: block; font-weight: 600;">Student Name</span>
            <strong style="color: #0F172A; font-size: 14px;">${escapeHtml(student.fullName)}</strong>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; display: block; font-weight: 600;">Admission No</span>
            <span style="color: #0F172A; font-weight: 700; font-family: monospace;">${escapeHtml(student.admissionNo)}</span>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; display: block; font-weight: 600;">Class</span>
            <strong style="color: #0F172A;">${className}</strong>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; display: block; font-weight: 600;">Assessment</span>
            <span style="color: #0F172A; font-weight: 600;">${assessmentName}</span>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; display: block; font-weight: 600;">Academic Year</span>
            <span style="color: #0F172A; font-weight: 600;">${academicYear}</span>
          </div>
          <div>
            <span style="color: #64748B; font-size: 10px; text-transform: uppercase; display: block; font-weight: 600;">Term</span>
            <span style="color: #0F172A; font-weight: 600;">${term}</span>
          </div>
        </div>

        <!-- Subject Marks Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; border: 1px solid #E5E7EB;">
          <thead>
            <tr style="background-color: #0F172A; color: #FFFFFF;">
              <th style="padding: 10px 12px; text-align: left; font-weight: 700;">Subject</th>
              <th style="padding: 10px 12px; text-align: center; font-weight: 700;">Mark</th>
              <th style="padding: 10px 12px; text-align: center; font-weight: 700;">Maximum</th>
              <th style="padding: 10px 12px; text-align: center; font-weight: 700;">Pass Mark</th>
              <th style="padding: 10px 12px; text-align: center; font-weight: 700;">Percentage</th>
              <th style="padding: 10px 12px; text-align: center; font-weight: 700;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${subjectsRowsHtml}
          </tbody>
        </table>

        <!-- Result Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 32px;">
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #6B7280; text-transform: uppercase;">Total Marks</div>
            <div style="font-size: 16px; font-weight: 800; color: #111827; margin-top: 4px;">${totalDisplay}</div>
          </div>
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #6B7280; text-transform: uppercase;">Average</div>
            <div style="font-size: 16px; font-weight: 800; color: #111827; margin-top: 4px;">${averageDisplay}</div>
          </div>
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #6B7280; text-transform: uppercase;">Numeric GPA</div>
            <div style="font-size: 16px; font-weight: 800; color: #37C6A3; margin-top: 4px;">${gpaDisplay}</div>
          </div>
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: #6B7280; text-transform: uppercase;">Class Position</div>
            <div style="font-size: 16px; font-weight: 800; color: #111827; margin-top: 4px;">${positionDisplay}</div>
          </div>
          <div style="background: ${resultBadgeBg}; border: 1px solid ${resultBadgeColor}33; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; font-weight: 700; color: ${resultBadgeColor}; text-transform: uppercase;">Overall Result</div>
            <div style="font-size: 16px; font-weight: 800; color: ${resultBadgeColor}; margin-top: 4px;">${student.overallStatus}</div>
          </div>
        </div>

        <!-- Teacher / Principal Signatures -->
        <div style="margin-top: 60px; display: flex; justify-content: space-between; padding: 0 20px;">
          <div style="text-align: center; width: 180px;">
            <div style="border-bottom: 1px solid #9CA3AF; height: 30px; margin-bottom: 6px;"></div>
            <div style="font-size: 11px; font-weight: 600; color: #4B5563;">Class Teacher</div>
          </div>
          <div style="text-align: center; width: 180px;">
            <div style="border-bottom: 1px solid #9CA3AF; height: 30px; margin-bottom: 6px;"></div>
            <div style="font-size: 11px; font-weight: 600; color: #4B5563;">Principal / Mudir</div>
          </div>
          <div style="text-align: center; width: 140px;">
            <div style="border-bottom: 1px solid #9CA3AF; height: 30px; margin-bottom: 6px;"></div>
            <div style="font-size: 11px; font-weight: 600; color: #4B5563;">Date</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(assessmentName)} - All Student Reports</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 12mm 16mm 12mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
            background: #FFFFFF;
            color: #0F172A;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
    </html>
  `;

  return await renderRawHtmlToPdf({ html: fullHtml, landscape: false });
}

/**
 * Generates ONE CSV for the entire class with dynamic subject columns.
 * Incorporates formula injection defense and UTF-8 BOM.
 *
 * @param {string} madrasaId
 * @param {string} assessmentId
 * @returns {Promise<string>}
 */
export async function generateClassCsv(madrasaId, assessmentId) {
  const data = await getAssessmentMarks(madrasaId, assessmentId);
  const { subjects, results } = data;

  const subjectHeaders = subjects.map((s) => s.subject?.name || 'Subject');

  const headers = [
    'Student ID',
    'Student Name',
    ...subjectHeaders,
    'Obtained Total',
    'Maximum Total',
    'Average Percentage',
    'GPA',
    'Passed Subjects',
    'Failed Subjects',
    'Overall Status',
    'Position',
  ];

  const rows = results.map((st) => {
    const subjectMarkCells = subjects.map((sub) => {
      const subResult = st.subjects.find((s) => s.assessmentSubjectId === sub.id);
      if (subResult && subResult.isEntered && subResult.mark !== null) {
        return subResult.mark;
      }
      return ''; // Blank for incomplete
    });

    const obtainedTotalCell = st.isComplete ? st.totalObtained : '';
    const maxPossibleCell = st.maxPossible || '';
    const averageCell = st.isComplete && st.overallPercentage !== null ? st.overallPercentage : '';
    const gpaCell = st.isComplete && st.gpa !== null ? st.gpa : '';
    const positionCell = st.isComplete && st.position !== null ? st.position : '';

    return [
      st.admissionNo,
      st.fullName,
      ...subjectMarkCells,
      obtainedTotalCell,
      maxPossibleCell,
      averageCell,
      gpaCell,
      st.passedSubjectsCount,
      st.failedSubjectsCount,
      st.overallStatus,
      positionCell,
    ];
  });

  return generateCsvString({ headers, rows });
}
