import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { findTenantRecordOrThrow } from '../lib/tenant-prisma.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import {
  buildMadrasaKey,
  uploadStudentDocumentBufferToR2,
  deleteStudentDocumentFromR2,
  getSecureStudentDocumentDownloadUrl,
} from './r2.service.js';
import { validateAndProcessReceipt } from './subscription-payment.service.js';
import { logTenantActivity } from './tenant.service.js';
import { buildFollowUpEmailHtml, processFollowUpReminders } from '../jobs/notification-worker.job.js';

export const QUALIFICATION_RECORD_TYPES = new Set(['QUALIFICATION', 'ACHIEVEMENT']);
export const QUALIFICATION_CATEGORIES = new Set([
  'HIFZ_JUZ',
  'QIRAATH',
  'NAZIRA_QURAN',
  'TAJWEED',
  'ISLAMIC_STUDIES',
  'ARABIC_LANGUAGE',
  'PREVIOUS_SCHOOLING',
  'EXTERNAL_CERTIFICATE',
  'AWARD_ACHIEVEMENT',
  'OTHER',
]);
export const QUALIFICATION_PROGRESS_STATUSES = new Set(['IN_PROGRESS', 'COMPLETED']);
export const CERTIFICATE_VERIFICATION_STATUSES = new Set(['PENDING', 'VERIFIED', 'REJECTED']);

export const INCIDENT_CATEGORIES = new Set([
  'ATTENDANCE_TARDINESS',
  'BEHAVIOR_CONDUCT',
  'ACADEMIC_INTEGRITY',
  'DRESS_CODE',
  'PEER_CONFLICT',
  'PROPERTY_DAMAGE',
  'SAFETY_CONCERN',
  'OTHER',
]);
export const INCIDENT_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const INCIDENT_VERIFICATION_STATUSES = new Set([
  'REPORTED',
  'UNDER_REVIEW',
  'CONFIRMED',
  'RESOLVED',
  'DISMISSED',
]);

export const FOLLOW_UP_STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export const FOLLOW_UP_PRIORITIES = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

export const STUDENT_MEETING_TYPES = new Set([
  'GUARDIAN_CONFERENCE',
  'ACADEMIC_REVIEW',
  'DISCIPLINARY_HEARING',
  'COUNSELING',
  'GENERAL',
]);

/**
 * Formats a Date into YYYY-MM-DD in a specific IANA timezone.
 */
export function getTenantDateString(date = new Date(), timeZone = 'Asia/Colombo') {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
  }
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

/**
 * Parses a date-only string or Date into a UTC midnight Date object.
 */
function parseDateOnly(val, fieldName) {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestError(`Invalid date provided for ${fieldName}.`);
  }
  return d;
}

/**
 * Parses a full date-time value into a valid Date object.
 */
function parseDateTime(val, fieldName) {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestError(`Invalid date/time provided for ${fieldName}.`);
  }
  return d;
}

/**
 * Validates that a student belongs to the authenticated tenant.
 */
async function assertStudentInTenant(madrasaId, studentId) {
  return await findTenantRecordOrThrow(
    prisma.student,
    studentId,
    madrasaId,
    {},
    'Student not found.'
  );
}

/**
 * Validates that an Ustadh belongs to the authenticated tenant.
 */
async function assertUstadhInTenant(madrasaId, ustadhId, label = 'Selected staff member') {
  if (!ustadhId) return null;
  return await findTenantRecordOrThrow(
    prisma.ustadh,
    ustadhId,
    madrasaId,
    {},
    `${label} not found.`
  );
}

/**
 * Validates that an admin user belongs to the authenticated tenant.
 */
async function assertUserInTenant(madrasaId, userId, label = 'Selected admin user') {
  if (!userId) return null;
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      madrasaId,
      isActive: true,
    },
  });
  if (!user) {
    throw new NotFoundError(`${label} not found.`);
  }
  return user;
}

/**
 * Validates and uploads a private student document (certificate or incident evidence) to R2.
 * Returns { objectKey, originalName, mimeType, size } so the caller can persist FileObject
 * and clean up the R2 object if database persistence fails.
 */
export async function uploadPrivateStudentDocumentToR2(madrasaId, studentId, prefix, file) {
  if (!file || !file.buffer) {
    throw new BadRequestError('Document file is required.');
  }

  const { processedBuffer, mimeType, extension } = await validateAndProcessReceipt(
    file.buffer,
    file.originalname || 'document'
  );

  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const filename = `${prefix}-${studentId}-${uniqueSuffix}.${extension}`;
  const objectKey = buildMadrasaKey(madrasaId, 'documents', filename);

  await uploadStudentDocumentBufferToR2(objectKey, processedBuffer, mimeType);

  return {
    objectKey,
    originalName: String(file.originalname || filename).slice(0, 191),
    mimeType,
    size: processedBuffer.length,
  };
}

/**
 * Formats a StudentQualification record for API response.
 */
function formatQualification(q) {
  return {
    id: q.id,
    madrasaId: q.madrasaId,
    studentId: q.studentId,
    recordType: q.recordType,
    category: q.category,
    title: q.title,
    issuingAuthority: q.issuingAuthority,
    certificateNumber: q.certificateNumber,
    progressStatus: q.progressStatus,
    verificationStatus: q.verificationStatus,
    achievedDate: q.achievedDate ? q.achievedDate.toISOString().split('T')[0] : null,
    expiryDate: q.expiryDate ? q.expiryDate.toISOString().split('T')[0] : null,
    gradeOrScore: q.gradeOrScore,
    description: q.description,
    certificateFileId: q.certificateFileId,
    hasCertificateFile: Boolean(q.certificateFileId && q.certificateFile),
    certificateFile: q.certificateFile
      ? {
          id: q.certificateFile.id,
          originalName: q.certificateFile.originalName,
          mimeType: q.certificateFile.mimeType,
          size: q.certificateFile.size,
          createdAt: q.certificateFile.createdAt,
        }
      : null,
    examinerUstadhId: q.examinerUstadhId,
    examinerUstadh: q.examinerUstadh
      ? {
          id: q.examinerUstadh.id,
          fullName: q.examinerUstadh.fullName,
          ustadhCode: q.examinerUstadh.ustadhCode,
          staffType: q.examinerUstadh.staffType,
        }
      : null,
    reviewedByUserId: q.reviewedByUserId,
    reviewedByUser: q.reviewedByUser
      ? {
          id: q.reviewedByUser.id,
          name: q.reviewedByUser.name,
          email: q.reviewedByUser.email,
        }
      : null,
    reviewedAt: q.reviewedAt,
    rejectionReason: q.rejectionReason,
    createdByUserId: q.createdByUserId,
    createdByUser: q.createdByUser
      ? {
          id: q.createdByUser.id,
          name: q.createdByUser.name,
        }
      : null,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

// ============================================================================
// 1. STUDENT QUALIFICATIONS & CERTIFICATES
// ============================================================================

export async function listStudentQualifications(madrasaId, studentId, query = {}) {
  await assertStudentInTenant(madrasaId, studentId);

  const where = {
    madrasaId,
    studentId,
    deletedAt: null,
  };

  if (query.recordType && query.recordType !== 'ALL') {
    if (!QUALIFICATION_RECORD_TYPES.has(query.recordType)) {
      throw new BadRequestError('Invalid qualification recordType filter.');
    }
    where.recordType = query.recordType;
  }

  if (query.category && query.category !== 'ALL') {
    if (!QUALIFICATION_CATEGORIES.has(query.category)) {
      throw new BadRequestError('Invalid qualification category filter.');
    }
    where.category = query.category;
  }

  if (query.progressStatus && query.progressStatus !== 'ALL') {
    if (!QUALIFICATION_PROGRESS_STATUSES.has(query.progressStatus)) {
      throw new BadRequestError('Invalid qualification progressStatus filter.');
    }
    where.progressStatus = query.progressStatus;
  }

  if (query.verificationStatus && query.verificationStatus !== 'ALL') {
    if (!CERTIFICATE_VERIFICATION_STATUSES.has(query.verificationStatus)) {
      throw new BadRequestError('Invalid certificate verificationStatus filter.');
    }
    where.verificationStatus = query.verificationStatus;
  }

  const records = await prisma.studentQualification.findMany({
    where,
    orderBy: [{ achievedDate: 'desc' }, { createdAt: 'desc' }],
    include: {
      certificateFile: true,
      examinerUstadh: true,
      reviewedByUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true } },
    },
  });

  const items = records.map(formatQualification);
  const summary = {
    total: items.length,
    verifiedCount: items.filter((i) => i.verificationStatus === 'VERIFIED').length,
    pendingCount: items.filter((i) => i.verificationStatus === 'PENDING').length,
    rejectedCount: items.filter((i) => i.verificationStatus === 'REJECTED').length,
    inProgressCount: items.filter((i) => i.progressStatus === 'IN_PROGRESS').length,
    completedCount: items.filter((i) => i.progressStatus === 'COMPLETED').length,
  };

  return { items, summary };
}

export async function createStudentQualification(madrasaId, studentId, data, file, auditContext = {}) {
  await assertStudentInTenant(madrasaId, studentId);

  const title = data.title ? String(data.title).trim() : '';
  if (!title) {
    throw new BadRequestError('Qualification title is required.');
  }

  const recordType = data.recordType || 'QUALIFICATION';
  if (!QUALIFICATION_RECORD_TYPES.has(recordType)) {
    throw new BadRequestError(`Invalid recordType "${recordType}".`);
  }

  const category = data.category || 'OTHER';
  if (!QUALIFICATION_CATEGORIES.has(category)) {
    throw new BadRequestError(`Invalid qualification category "${category}".`);
  }

  const progressStatus = data.progressStatus || 'COMPLETED';
  if (!QUALIFICATION_PROGRESS_STATUSES.has(progressStatus)) {
    throw new BadRequestError(`Invalid progressStatus "${progressStatus}".`);
  }

  const verificationStatus = data.verificationStatus || 'PENDING';
  if (!CERTIFICATE_VERIFICATION_STATUSES.has(verificationStatus)) {
    throw new BadRequestError(`Invalid verificationStatus "${verificationStatus}".`);
  }

  const rejectionReason = data.rejectionReason ? String(data.rejectionReason).trim() : null;
  if (verificationStatus === 'REJECTED' && !rejectionReason) {
    throw new BadRequestError('Rejection reason is required when verification status is REJECTED.');
  }

  const examinerUstadhId = data.examinerUstadhId ? String(data.examinerUstadhId).trim() : null;
  if (examinerUstadhId) {
    await assertUstadhInTenant(madrasaId, examinerUstadhId, 'Examiner Ustadh');
  }

  const achievedDate = parseDateOnly(data.achievedDate, 'achievedDate');
  const expiryDate = parseDateOnly(data.expiryDate, 'expiryDate');

  let uploadedDoc = null;
  if (file && file.buffer) {
    uploadedDoc = await uploadPrivateStudentDocumentToR2(madrasaId, studentId, 'cert', file);
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      let certificateFileId = null;
      if (uploadedDoc) {
        const fileObj = await tx.fileObject.create({
          data: {
            madrasaId,
            type: 'STUDENT_DOCUMENT',
            objectKey: uploadedDoc.objectKey,
            originalName: uploadedDoc.originalName,
            mimeType: uploadedDoc.mimeType,
            size: uploadedDoc.size,
            publicUrl: null,
          },
        });
        certificateFileId = fileObj.id;
      }

      const isReviewed = verificationStatus === 'VERIFIED' || verificationStatus === 'REJECTED';

      return await tx.studentQualification.create({
        data: {
          madrasaId,
          studentId,
          recordType,
          category,
          title,
          issuingAuthority: data.issuingAuthority ? String(data.issuingAuthority).trim() : null,
          certificateNumber: data.certificateNumber ? String(data.certificateNumber).trim() : null,
          progressStatus,
          verificationStatus,
          achievedDate,
          expiryDate,
          gradeOrScore: data.gradeOrScore ? String(data.gradeOrScore).trim() : null,
          description: data.description ? String(data.description).trim() : null,
          certificateFileId,
          examinerUstadhId,
          reviewedByUserId: isReviewed ? auditContext.userId || null : null,
          reviewedAt: isReviewed ? new Date() : null,
          rejectionReason: verificationStatus === 'REJECTED' ? rejectionReason : null,
          createdByUserId: auditContext.userId,
        },
        include: {
          certificateFile: true,
          examinerUstadh: true,
          reviewedByUser: { select: { id: true, name: true, email: true } },
          createdByUser: { select: { id: true, name: true } },
        },
      });
    });

    await logTenantActivity({
      madrasaId,
      userId: auditContext.userId,
      action: 'STUDENT_QUALIFICATION_CREATED',
      entityType: 'StudentQualification',
      entityId: created.id,
      metadata: {
        studentId,
        recordType: created.recordType,
        category: created.category,
        title: created.title,
        progressStatus: created.progressStatus,
        verificationStatus: created.verificationStatus,
        hasCertificateFile: Boolean(created.certificateFileId),
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });

    return formatQualification(created);
  } catch (err) {
    if (uploadedDoc) {
      await deleteStudentDocumentFromR2(uploadedDoc.objectKey).catch(() => {});
    }
    throw err;
  }
}

export async function updateStudentQualification(
  madrasaId,
  studentId,
  qualificationId,
  data,
  file,
  auditContext = {}
) {
  await assertStudentInTenant(madrasaId, studentId);

  const existing = await prisma.studentQualification.findFirst({
    where: {
      id: qualificationId,
      madrasaId,
      studentId,
      deletedAt: null,
    },
    include: { certificateFile: true },
  });

  if (!existing) {
    throw new NotFoundError('Qualification record not found.');
  }

  const updateData = {};

  if (data.title !== undefined) {
    const title = String(data.title).trim();
    if (!title) throw new BadRequestError('Qualification title cannot be empty.');
    updateData.title = title;
  }

  if (data.recordType !== undefined) {
    if (!QUALIFICATION_RECORD_TYPES.has(data.recordType)) {
      throw new BadRequestError(`Invalid recordType "${data.recordType}".`);
    }
    updateData.recordType = data.recordType;
  }

  if (data.category !== undefined) {
    if (!QUALIFICATION_CATEGORIES.has(data.category)) {
      throw new BadRequestError(`Invalid qualification category "${data.category}".`);
    }
    updateData.category = data.category;
  }

  if (data.progressStatus !== undefined) {
    if (!QUALIFICATION_PROGRESS_STATUSES.has(data.progressStatus)) {
      throw new BadRequestError(`Invalid progressStatus "${data.progressStatus}".`);
    }
    updateData.progressStatus = data.progressStatus;
  }

  if (data.issuingAuthority !== undefined) {
    updateData.issuingAuthority = data.issuingAuthority ? String(data.issuingAuthority).trim() : null;
  }

  if (data.certificateNumber !== undefined) {
    updateData.certificateNumber = data.certificateNumber ? String(data.certificateNumber).trim() : null;
  }

  if (data.achievedDate !== undefined) {
    updateData.achievedDate = data.achievedDate ? parseDateOnly(data.achievedDate, 'achievedDate') : null;
  }

  if (data.expiryDate !== undefined) {
    updateData.expiryDate = data.expiryDate ? parseDateOnly(data.expiryDate, 'expiryDate') : null;
  }

  if (data.gradeOrScore !== undefined) {
    updateData.gradeOrScore = data.gradeOrScore ? String(data.gradeOrScore).trim() : null;
  }

  if (data.description !== undefined) {
    updateData.description = data.description ? String(data.description).trim() : null;
  }

  if (data.examinerUstadhId !== undefined) {
    const examinerUstadhId = data.examinerUstadhId ? String(data.examinerUstadhId).trim() : null;
    if (examinerUstadhId) {
      await assertUstadhInTenant(madrasaId, examinerUstadhId, 'Examiner Ustadh');
    }
    updateData.examinerUstadhId = examinerUstadhId;
  }

  if (data.verificationStatus !== undefined) {
    if (!CERTIFICATE_VERIFICATION_STATUSES.has(data.verificationStatus)) {
      throw new BadRequestError(`Invalid verificationStatus "${data.verificationStatus}".`);
    }
    updateData.verificationStatus = data.verificationStatus;
    if (data.verificationStatus === 'REJECTED') {
      const reason = data.rejectionReason !== undefined ? String(data.rejectionReason || '').trim() : existing.rejectionReason;
      if (!reason) {
        throw new BadRequestError('Rejection reason is required when verification status is REJECTED.');
      }
      updateData.rejectionReason = reason;
      updateData.reviewedByUserId = auditContext.userId || null;
      updateData.reviewedAt = new Date();
    } else if (data.verificationStatus === 'VERIFIED') {
      updateData.rejectionReason = null;
      updateData.reviewedByUserId = auditContext.userId || null;
      updateData.reviewedAt = new Date();
    } else {
      updateData.rejectionReason = null;
      updateData.reviewedByUserId = null;
      updateData.reviewedAt = null;
    }
  } else if (data.rejectionReason !== undefined && existing.verificationStatus === 'REJECTED') {
    const reason = String(data.rejectionReason || '').trim();
    if (!reason) {
      throw new BadRequestError('Rejection reason cannot be empty while status is REJECTED.');
    }
    updateData.rejectionReason = reason;
  }

  let uploadedDoc = null;
  if (file && file.buffer) {
    uploadedDoc = await uploadPrivateStudentDocumentToR2(madrasaId, studentId, 'cert', file);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (uploadedDoc) {
        const fileObj = await tx.fileObject.create({
          data: {
            madrasaId,
            type: 'STUDENT_DOCUMENT',
            objectKey: uploadedDoc.objectKey,
            originalName: uploadedDoc.originalName,
            mimeType: uploadedDoc.mimeType,
            size: uploadedDoc.size,
            publicUrl: null,
          },
        });
        updateData.certificateFileId = fileObj.id;
      }

      return await tx.studentQualification.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          certificateFile: true,
          examinerUstadh: true,
          reviewedByUser: { select: { id: true, name: true, email: true } },
          createdByUser: { select: { id: true, name: true } },
        },
      });
    });

    // Clean up previous R2 certificate if replaced
    if (uploadedDoc && existing.certificateFile?.objectKey) {
      await deleteStudentDocumentFromR2(existing.certificateFile.objectKey).catch(() => {});
    }

    await logTenantActivity({
      madrasaId,
      userId: auditContext.userId,
      action: 'STUDENT_QUALIFICATION_UPDATED',
      entityType: 'StudentQualification',
      entityId: updated.id,
      metadata: {
        studentId,
        progressStatus: updated.progressStatus,
        verificationStatus: updated.verificationStatus,
        certificateReplaced: Boolean(uploadedDoc),
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });

    return formatQualification(updated);
  } catch (err) {
    if (uploadedDoc) {
      await deleteStudentDocumentFromR2(uploadedDoc.objectKey).catch(() => {});
    }
    throw err;
  }
}

export async function verifyOrRejectStudentQualification(
  madrasaId,
  studentId,
  qualificationId,
  data,
  auditContext = {}
) {
  await assertStudentInTenant(madrasaId, studentId);

  const existing = await prisma.studentQualification.findFirst({
    where: {
      id: qualificationId,
      madrasaId,
      studentId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new NotFoundError('Qualification record not found.');
  }

  const verificationStatus = data.verificationStatus;
  if (!verificationStatus || !CERTIFICATE_VERIFICATION_STATUSES.has(verificationStatus)) {
    throw new BadRequestError('Valid verificationStatus (PENDING, VERIFIED, or REJECTED) is required.');
  }

  const rejectionReason = data.rejectionReason ? String(data.rejectionReason).trim() : null;
  if (verificationStatus === 'REJECTED' && !rejectionReason) {
    throw new BadRequestError('Rejection reason is required when rejecting a certificate or qualification.');
  }

  const updateData = {
    verificationStatus,
    reviewedByUserId: verificationStatus === 'PENDING' ? null : auditContext.userId || null,
    reviewedAt: verificationStatus === 'PENDING' ? null : new Date(),
    rejectionReason: verificationStatus === 'REJECTED' ? rejectionReason : null,
  };

  if (data.examinerUstadhId !== undefined) {
    const examinerUstadhId = data.examinerUstadhId ? String(data.examinerUstadhId).trim() : null;
    if (examinerUstadhId) {
      await assertUstadhInTenant(madrasaId, examinerUstadhId, 'Examiner Ustadh');
    }
    updateData.examinerUstadhId = examinerUstadhId;
  }

  const updated = await prisma.studentQualification.update({
    where: { id: existing.id },
    data: updateData,
    include: {
      certificateFile: true,
      examinerUstadh: true,
      reviewedByUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true } },
    },
  });

  await logTenantActivity({
    madrasaId,
    userId: auditContext.userId,
    action:
      verificationStatus === 'VERIFIED'
        ? 'STUDENT_CERTIFICATE_VERIFIED'
        : verificationStatus === 'REJECTED'
        ? 'STUDENT_CERTIFICATE_REJECTED'
        : 'STUDENT_CERTIFICATE_RESET_PENDING',
    entityType: 'StudentQualification',
    entityId: updated.id,
    metadata: {
      studentId,
      previousVerificationStatus: existing.verificationStatus,
      newVerificationStatus: updated.verificationStatus,
      rejectionReason: updated.rejectionReason,
    },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  return formatQualification(updated);
}

export async function getStudentQualificationCertificateUrl(
  madrasaId,
  studentId,
  qualificationId,
  query = {},
  auditContext = {}
) {
  await assertStudentInTenant(madrasaId, studentId);

  const qualification = await prisma.studentQualification.findFirst({
    where: {
      id: qualificationId,
      madrasaId,
      studentId,
      deletedAt: null,
    },
    include: {
      certificateFile: true,
    },
  });

  if (!qualification) {
    throw new NotFoundError('Qualification record not found.');
  }

  if (!qualification.certificateFileId || !qualification.certificateFile) {
    throw new NotFoundError('No certificate file is attached to this qualification.');
  }

  const fileObj = qualification.certificateFile;
  const expectedPrefix = `madrasas/${madrasaId}/documents/`;
  if (fileObj.madrasaId !== madrasaId || !fileObj.objectKey.startsWith(expectedPrefix)) {
    throw new NotFoundError('Certificate file not found.');
  }

  const mode = query.mode === 'download' ? 'download' : 'inline';
  const expiresIn = 120;
  const url = await getSecureStudentDocumentDownloadUrl(fileObj.objectKey, expiresIn, {
    mode,
    filename: fileObj.originalName,
    contentType: fileObj.mimeType,
  });

  if (!url) {
    throw new BadRequestError('Private document storage is currently unavailable.');
  }

  await logTenantActivity({
    madrasaId,
    userId: auditContext.userId,
    action: 'STUDENT_CERTIFICATE_ACCESSED',
    entityType: 'StudentQualification',
    entityId: qualification.id,
    metadata: {
      studentId,
      fileId: fileObj.id,
      mode,
    },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  return {
    url,
    expiresIn,
    mode,
    originalName: fileObj.originalName,
    mimeType: fileObj.mimeType,
    size: fileObj.size,
  };
}

export async function deleteStudentQualification(
  madrasaId,
  studentId,
  qualificationId,
  auditContext = {}
) {
  await assertStudentInTenant(madrasaId, studentId);

  const existing = await prisma.studentQualification.findFirst({
    where: {
      id: qualificationId,
      madrasaId,
      studentId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new NotFoundError('Qualification record not found.');
  }

  await prisma.studentQualification.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  await logTenantActivity({
    madrasaId,
    userId: auditContext.userId,
    action: 'STUDENT_QUALIFICATION_DELETED',
    entityType: 'StudentQualification',
    entityId: existing.id,
    metadata: {
      studentId,
      title: existing.title,
    },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  return { deleted: true, id: existing.id };
}

// ============================================================================
// 2. STUDENT DISCIPLINE & INCIDENT RECORDS
// ============================================================================

function formatIncident(inc) {
  const isUnconfirmedReport =
    inc.verificationStatus === 'REPORTED' || inc.verificationStatus === 'UNDER_REVIEW';
  const isConfirmedMisconduct =
    inc.verificationStatus === 'CONFIRMED' && Boolean(inc.investigatedFindings);
  const isResolved = inc.verificationStatus === 'RESOLVED';
  const isDismissed = inc.verificationStatus === 'DISMISSED';

  return {
    id: inc.id,
    madrasaId: inc.madrasaId,
    studentId: inc.studentId,
    title: inc.title,
    category: inc.category,
    severity: inc.severity,
    occurredAt: inc.occurredAt ? inc.occurredAt.toISOString() : null,
    location: inc.location,
    isConfidential: inc.isConfidential,
    reportedDescription: inc.reportedDescription,
    reportedByUstadhId: inc.reportedByUstadhId,
    reportedByUstadh: inc.reportedByUstadh
      ? {
          id: inc.reportedByUstadh.id,
          fullName: inc.reportedByUstadh.fullName,
          ustadhCode: inc.reportedByUstadh.ustadhCode,
        }
      : null,
    reportedByUserId: inc.reportedByUserId,
    reportedByUser: inc.reportedByUser
      ? {
          id: inc.reportedByUser.id,
          name: inc.reportedByUser.name,
        }
      : null,
    reportedAt: inc.reportedAt ? inc.reportedAt.toISOString() : null,
    verificationStatus: inc.verificationStatus,
    isUnconfirmedReport,
    isConfirmedMisconduct,
    isResolved,
    isDismissed,
    investigatedFindings: inc.investigatedFindings,
    actionTaken: inc.actionTaken,
    dismissalReason: inc.dismissalReason,
    reviewedByUserId: inc.reviewedByUserId,
    reviewedByUser: inc.reviewedByUser
      ? {
          id: inc.reviewedByUser.id,
          name: inc.reviewedByUser.name,
        }
      : null,
    reviewedAt: inc.reviewedAt ? inc.reviewedAt.toISOString() : null,
    resolvedAt: inc.resolvedAt ? inc.resolvedAt.toISOString() : null,
    evidenceFileId: inc.evidenceFileId,
    hasEvidenceFile: Boolean(inc.evidenceFileId && inc.evidenceFile),
    evidenceFile: inc.evidenceFile
      ? {
          id: inc.evidenceFile.id,
          originalName: inc.evidenceFile.originalName,
          mimeType: inc.evidenceFile.mimeType,
          size: inc.evidenceFile.size,
          createdAt: inc.evidenceFile.createdAt,
        }
      : null,
    guardianNotified: inc.guardianNotified,
    guardianNotifiedAt: inc.guardianNotifiedAt ? inc.guardianNotifiedAt.toISOString() : null,
    followUpCount: Array.isArray(inc.followUps) ? inc.followUps.length : 0,
    createdAt: inc.createdAt,
    updatedAt: inc.updatedAt,
  };
}

export async function listStudentIncidents(madrasaId, studentId, query = {}) {
  await assertStudentInTenant(madrasaId, studentId);

  const where = {
    madrasaId,
    studentId,
    deletedAt: null,
  };

  if (query.verificationStatus && query.verificationStatus !== 'ALL') {
    if (!INCIDENT_VERIFICATION_STATUSES.has(query.verificationStatus)) {
      throw new BadRequestError('Invalid incident verificationStatus filter.');
    }
    where.verificationStatus = query.verificationStatus;
  }

  if (query.severity && query.severity !== 'ALL') {
    if (!INCIDENT_SEVERITIES.has(query.severity)) {
      throw new BadRequestError('Invalid incident severity filter.');
    }
    where.severity = query.severity;
  }

  if (query.category && query.category !== 'ALL') {
    if (!INCIDENT_CATEGORIES.has(query.category)) {
      throw new BadRequestError('Invalid incident category filter.');
    }
    where.category = query.category;
  }

  const records = await prisma.studentIncident.findMany({
    where,
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      reportedByUstadh: true,
      reportedByUser: { select: { id: true, name: true } },
      reviewedByUser: { select: { id: true, name: true } },
      evidenceFile: true,
      followUps: {
        where: { deletedAt: null },
        select: { id: true, status: true },
      },
    },
  });

  const items = records.map(formatIncident);

  // Compute strict summary separating unconfirmed reports, confirmed findings, resolved matters, and dismissed reports
  const allTenantStudentIncidents = await prisma.studentIncident.findMany({
    where: { madrasaId, studentId, deletedAt: null },
    select: { verificationStatus: true },
  });

  const summary = {
    total: allTenantStudentIncidents.length,
    unconfirmedCount: allTenantStudentIncidents.filter(
      (i) => i.verificationStatus === 'REPORTED' || i.verificationStatus === 'UNDER_REVIEW'
    ).length,
    confirmedCount: allTenantStudentIncidents.filter(
      (i) => i.verificationStatus === 'CONFIRMED'
    ).length,
    resolvedCount: allTenantStudentIncidents.filter(
      (i) => i.verificationStatus === 'RESOLVED'
    ).length,
    dismissedCount: allTenantStudentIncidents.filter(
      (i) => i.verificationStatus === 'DISMISSED'
    ).length,
  };

  return { items, summary };
}

export async function createStudentIncident(
  madrasaId,
  studentId,
  data,
  file,
  auditContext = {}
) {
  await assertStudentInTenant(madrasaId, studentId);

  const title = data.title ? String(data.title).trim() : '';
  if (!title) {
    throw new BadRequestError('Incident title is required.');
  }

  const reportedDescription = data.reportedDescription ? String(data.reportedDescription).trim() : '';
  if (!reportedDescription) {
    throw new BadRequestError('Original incident report description is required.');
  }

  const occurredAt = parseDateTime(data.occurredAt, 'occurredAt');
  if (!occurredAt) {
    throw new BadRequestError('Incident date and time (occurredAt) is required.');
  }

  const category = data.category || 'OTHER';
  if (!INCIDENT_CATEGORIES.has(category)) {
    throw new BadRequestError(`Invalid incident category "${category}".`);
  }

  const severity = data.severity || 'LOW';
  if (!INCIDENT_SEVERITIES.has(severity)) {
    throw new BadRequestError(`Invalid incident severity "${severity}".`);
  }

  const verificationStatus = data.verificationStatus || 'REPORTED';
  if (!INCIDENT_VERIFICATION_STATUSES.has(verificationStatus)) {
    throw new BadRequestError(`Invalid incident verificationStatus "${verificationStatus}".`);
  }

  const investigatedFindings = data.investigatedFindings ? String(data.investigatedFindings).trim() : null;
  const actionTaken = data.actionTaken ? String(data.actionTaken).trim() : null;
  const dismissalReason = data.dismissalReason ? String(data.dismissalReason).trim() : null;

  if (verificationStatus === 'CONFIRMED' && !investigatedFindings) {
    throw new BadRequestError('Investigated findings are required to mark an incident as CONFIRMED.');
  }

  if (verificationStatus === 'RESOLVED' && !investigatedFindings && !actionTaken) {
    throw new BadRequestError('Investigated findings or action taken are required to mark an incident as RESOLVED.');
  }

  if (verificationStatus === 'DISMISSED' && !dismissalReason) {
    throw new BadRequestError('An explicit dismissal reason is required to mark an incident as DISMISSED.');
  }

  const reportedByUstadhId = data.reportedByUstadhId ? String(data.reportedByUstadhId).trim() : null;
  if (reportedByUstadhId) {
    await assertUstadhInTenant(madrasaId, reportedByUstadhId, 'Reporting Ustadh');
  }

  const isConfidential =
    data.isConfidential === undefined
      ? true
      : data.isConfidential === true || data.isConfidential === 'true';
  const guardianNotified =
    data.guardianNotified === true || data.guardianNotified === 'true';

  let uploadedEvidence = null;
  if (file && file.buffer) {
    uploadedEvidence = await uploadPrivateStudentDocumentToR2(madrasaId, studentId, 'incident', file);
  }

  const now = new Date();
  const isReviewed =
    verificationStatus === 'UNDER_REVIEW' ||
    verificationStatus === 'CONFIRMED' ||
    verificationStatus === 'RESOLVED' ||
    verificationStatus === 'DISMISSED';

  try {
    const created = await prisma.$transaction(async (tx) => {
      let evidenceFileId = null;
      if (uploadedEvidence) {
        const fileObj = await tx.fileObject.create({
          data: {
            madrasaId,
            type: 'STUDENT_DOCUMENT',
            objectKey: uploadedEvidence.objectKey,
            originalName: uploadedEvidence.originalName,
            mimeType: uploadedEvidence.mimeType,
            size: uploadedEvidence.size,
            publicUrl: null,
          },
        });
        evidenceFileId = fileObj.id;
      }

      return await tx.studentIncident.create({
        data: {
          madrasaId,
          studentId,
          title,
          category,
          severity,
          occurredAt,
          location: data.location ? String(data.location).trim() : null,
          isConfidential,
          reportedDescription,
          reportedByUstadhId,
          reportedByUserId: auditContext.userId,
          reportedAt: now,
          verificationStatus,
          investigatedFindings,
          actionTaken,
          dismissalReason,
          reviewedByUserId: isReviewed ? auditContext.userId || null : null,
          reviewedAt: isReviewed ? now : null,
          resolvedAt: verificationStatus === 'RESOLVED' ? now : null,
          evidenceFileId,
          guardianNotified,
          guardianNotifiedAt: guardianNotified ? now : null,
        },
        include: {
          reportedByUstadh: true,
          reportedByUser: { select: { id: true, name: true } },
          reviewedByUser: { select: { id: true, name: true } },
          evidenceFile: true,
          followUps: { where: { deletedAt: null }, select: { id: true, status: true } },
        },
      });
    });

    await logTenantActivity({
      madrasaId,
      userId: auditContext.userId,
      action: 'STUDENT_INCIDENT_RECORDED',
      entityType: 'StudentIncident',
      entityId: created.id,
      metadata: {
        studentId,
        category: created.category,
        severity: created.severity,
        verificationStatus: created.verificationStatus,
        occurredAt: created.occurredAt.toISOString(),
        hasEvidenceFile: Boolean(created.evidenceFileId),
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });

    return formatIncident(created);
  } catch (err) {
    if (uploadedEvidence) {
      await deleteStudentDocumentFromR2(uploadedEvidence.objectKey).catch(() => {});
    }
    throw err;
  }
}

export async function updateStudentIncident(
  madrasaId,
  studentId,
  incidentId,
  data,
  file,
  auditContext = {}
) {
  await assertStudentInTenant(madrasaId, studentId);

  const existing = await prisma.studentIncident.findFirst({
    where: {
      id: incidentId,
      madrasaId,
      studentId,
      deletedAt: null,
    },
    include: { evidenceFile: true },
  });

  if (!existing) {
    throw new NotFoundError('Incident record not found.');
  }

  const updateData = {};

  if (data.title !== undefined) {
    const title = String(data.title).trim();
    if (!title) throw new BadRequestError('Incident title cannot be empty.');
    updateData.title = title;
  }

  if (data.category !== undefined) {
    if (!INCIDENT_CATEGORIES.has(data.category)) {
      throw new BadRequestError(`Invalid incident category "${data.category}".`);
    }
    updateData.category = data.category;
  }

  if (data.severity !== undefined) {
    if (!INCIDENT_SEVERITIES.has(data.severity)) {
      throw new BadRequestError(`Invalid incident severity "${data.severity}".`);
    }
    updateData.severity = data.severity;
  }

  if (data.occurredAt !== undefined) {
    const occurredAt = parseDateTime(data.occurredAt, 'occurredAt');
    if (!occurredAt) throw new BadRequestError('Valid incident date/time is required.');
    updateData.occurredAt = occurredAt;
  }

  if (data.location !== undefined) {
    updateData.location = data.location ? String(data.location).trim() : null;
  }

  if (data.isConfidential !== undefined) {
    updateData.isConfidential = data.isConfidential === true || data.isConfidential === 'true';
  }

  if (data.reportedDescription !== undefined) {
    const desc = String(data.reportedDescription).trim();
    if (!desc) throw new BadRequestError('Original report description cannot be empty.');
    updateData.reportedDescription = desc;
  }

  if (data.reportedByUstadhId !== undefined) {
    const reportedByUstadhId = data.reportedByUstadhId ? String(data.reportedByUstadhId).trim() : null;
    if (reportedByUstadhId) {
      await assertUstadhInTenant(madrasaId, reportedByUstadhId, 'Reporting Ustadh');
    }
    updateData.reportedByUstadhId = reportedByUstadhId;
  }

  if (data.investigatedFindings !== undefined) {
    updateData.investigatedFindings = data.investigatedFindings ? String(data.investigatedFindings).trim() : null;
  }

  if (data.actionTaken !== undefined) {
    updateData.actionTaken = data.actionTaken ? String(data.actionTaken).trim() : null;
  }

  if (data.dismissalReason !== undefined) {
    updateData.dismissalReason = data.dismissalReason ? String(data.dismissalReason).trim() : null;
  }

  const nextStatus = data.verificationStatus !== undefined ? data.verificationStatus : existing.verificationStatus;
  if (!INCIDENT_VERIFICATION_STATUSES.has(nextStatus)) {
    throw new BadRequestError(`Invalid verificationStatus "${nextStatus}".`);
  }

  const nextFindings =
    updateData.investigatedFindings !== undefined ? updateData.investigatedFindings : existing.investigatedFindings;
  const nextDismissal =
    updateData.dismissalReason !== undefined ? updateData.dismissalReason : existing.dismissalReason;
  const nextAction =
    updateData.actionTaken !== undefined ? updateData.actionTaken : existing.actionTaken;

  if (nextStatus === 'CONFIRMED' && !nextFindings) {
    throw new BadRequestError('Investigated findings are required when status is CONFIRMED.');
  }

  if (nextStatus === 'RESOLVED' && !nextFindings && !nextAction) {
    throw new BadRequestError('Investigated findings or action taken are required when status is RESOLVED.');
  }

  if (nextStatus === 'DISMISSED' && !nextDismissal) {
    throw new BadRequestError('An explicit dismissal reason is required when status is DISMISSED.');
  }

  const now = new Date();
  if (data.verificationStatus !== undefined) {
    updateData.verificationStatus = nextStatus;
    if (nextStatus !== 'REPORTED') {
      updateData.reviewedByUserId = auditContext.userId || null;
      updateData.reviewedAt = now;
    }
    if (nextStatus === 'RESOLVED') {
      updateData.resolvedAt = existing.resolvedAt || now;
    } else {
      updateData.resolvedAt = null;
    }
  }

  if (data.guardianNotified !== undefined) {
    const notified = data.guardianNotified === true || data.guardianNotified === 'true';
    updateData.guardianNotified = notified;
    updateData.guardianNotifiedAt = notified ? existing.guardianNotifiedAt || now : null;
  }

  let uploadedEvidence = null;
  if (file && file.buffer) {
    uploadedEvidence = await uploadPrivateStudentDocumentToR2(madrasaId, studentId, 'incident', file);
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (uploadedEvidence) {
        const fileObj = await tx.fileObject.create({
          data: {
            madrasaId,
            type: 'STUDENT_DOCUMENT',
            objectKey: uploadedEvidence.objectKey,
            originalName: uploadedEvidence.originalName,
            mimeType: uploadedEvidence.mimeType,
            size: uploadedEvidence.size,
            publicUrl: null,
          },
        });
        updateData.evidenceFileId = fileObj.id;
      }

      return await tx.studentIncident.update({
        where: { id: existing.id },
        data: updateData,
        include: {
          reportedByUstadh: true,
          reportedByUser: { select: { id: true, name: true } },
          reviewedByUser: { select: { id: true, name: true } },
          evidenceFile: true,
          followUps: { where: { deletedAt: null }, select: { id: true, status: true } },
        },
      });
    });

    if (uploadedEvidence && existing.evidenceFile?.objectKey) {
      await deleteStudentDocumentFromR2(existing.evidenceFile.objectKey).catch(() => {});
    }

    await logTenantActivity({
      madrasaId,
      userId: auditContext.userId,
      action: 'STUDENT_INCIDENT_UPDATED',
      entityType: 'StudentIncident',
      entityId: updated.id,
      metadata: {
        studentId,
        previousVerificationStatus: existing.verificationStatus,
        newVerificationStatus: updated.verificationStatus,
        evidenceReplaced: Boolean(uploadedEvidence),
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });

    return formatIncident(updated);
  } catch (err) {
    if (uploadedEvidence) {
      await deleteStudentDocumentFromR2(uploadedEvidence.objectKey).catch(() => {});
    }
    throw err;
  }
}

export async function getStudentIncidentEvidenceUrl(
  madrasaId,
  studentId,
  incidentId,
  query = {},
  auditContext = {}
) {
  await assertStudentInTenant(madrasaId, studentId);

  const incident = await prisma.studentIncident.findFirst({
    where: {
      id: incidentId,
      madrasaId,
      studentId,
      deletedAt: null,
    },
    include: {
      evidenceFile: true,
    },
  });

  if (!incident) {
    throw new NotFoundError('Incident record not found.');
  }

  if (!incident.evidenceFileId || !incident.evidenceFile) {
    throw new NotFoundError('No evidence file is attached to this incident.');
  }

  const fileObj = incident.evidenceFile;
  const expectedPrefix = `madrasas/${madrasaId}/documents/`;
  if (fileObj.madrasaId !== madrasaId || !fileObj.objectKey.startsWith(expectedPrefix)) {
    throw new NotFoundError('Evidence file not found.');
  }

  const mode = query.mode === 'download' ? 'download' : 'inline';
  const expiresIn = 120;
  const url = await getSecureStudentDocumentDownloadUrl(fileObj.objectKey, expiresIn, {
    mode,
    filename: fileObj.originalName,
    contentType: fileObj.mimeType,
  });

  if (!url) {
    throw new BadRequestError('Private document storage is currently unavailable.');
  }

  await logTenantActivity({
    madrasaId,
    userId: auditContext.userId,
    action: 'STUDENT_INCIDENT_EVIDENCE_ACCESSED',
    entityType: 'StudentIncident',
    entityId: incident.id,
    metadata: {
      studentId,
      fileId: fileObj.id,
      mode,
    },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  return {
    url,
    expiresIn,
    mode,
    originalName: fileObj.originalName,
    mimeType: fileObj.mimeType,
    size: fileObj.size,
  };
}

export async function deleteStudentIncident(madrasaId, studentId, incidentId, auditContext = {}) {
  await assertStudentInTenant(madrasaId, studentId);

  const existing = await prisma.studentIncident.findFirst({
    where: {
      id: incidentId,
      madrasaId,
      studentId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new NotFoundError('Incident record not found.');
  }

  await prisma.studentIncident.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  await logTenantActivity({
    madrasaId,
    userId: auditContext.userId,
    action: 'STUDENT_INCIDENT_DELETED',
    entityType: 'StudentIncident',
    entityId: existing.id,
    metadata: {
      studentId,
      title: existing.title,
    },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  return { deleted: true, id: existing.id };
}

// ============================================================================
// 3. STUDENT & GUARDIAN MEETINGS
// ============================================================================

function formatMeeting(m) {
  return {
    id: m.id,
    madrasaId: m.madrasaId,
    studentId: m.studentId,
    meetingType: m.meetingType,
    title: m.title,
    meetingAt: m.meetingAt ? m.meetingAt.toISOString() : null,
    location: m.location,
    participantsSummary: m.participantsSummary,
    ustadhId: m.ustadhId,
    ustadh: m.ustadh
      ? {
          id: m.ustadh.id,
          fullName: m.ustadh.fullName,
          ustadhCode: m.ustadh.ustadhCode,
        }
      : null,
    incidentId: m.incidentId,
    incident: m.incident
      ? {
          id: m.incident.id,
          title: m.incident.title,
          verificationStatus: m.incident.verificationStatus,
        }
      : null,
    discussionNotes: m.discussionNotes,
    outcomeSummary: m.outcomeSummary,
    createdByUserId: m.createdByUserId,
    createdByUser: m.createdByUser
      ? {
          id: m.createdByUser.id,
          name: m.createdByUser.name,
        }
      : null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export async function listStudentMeetings(madrasaId, studentId, query = {}) {
  await assertStudentInTenant(madrasaId, studentId);

  const where = {
    madrasaId,
    studentId,
    deletedAt: null,
  };

  if (query.meetingType && query.meetingType !== 'ALL') {
    if (!STUDENT_MEETING_TYPES.has(query.meetingType)) {
      throw new BadRequestError('Invalid meetingType filter.');
    }
    where.meetingType = query.meetingType;
  }

  const meetings = await prisma.studentMeeting.findMany({
    where,
    orderBy: [{ meetingAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      ustadh: true,
      incident: { select: { id: true, title: true, verificationStatus: true } },
      createdByUser: { select: { id: true, name: true } },
    },
  });

  return {
    items: meetings.map(formatMeeting),
    total: meetings.length,
  };
}

export async function createStudentMeeting(madrasaId, studentId, data, auditContext = {}) {
  await assertStudentInTenant(madrasaId, studentId);

  const title = data.title ? String(data.title).trim() : '';
  if (!title) {
    throw new BadRequestError('Meeting title is required.');
  }

  const meetingAt = parseDateTime(data.meetingAt, 'meetingAt');
  if (!meetingAt) {
    throw new BadRequestError('Meeting date and time (meetingAt) is required.');
  }

  const meetingType = data.meetingType || 'GUARDIAN_CONFERENCE';
  if (!STUDENT_MEETING_TYPES.has(meetingType)) {
    throw new BadRequestError(`Invalid meetingType "${meetingType}".`);
  }

  const participantsSummary = data.participantsSummary ? String(data.participantsSummary).trim() : '';
  if (!participantsSummary) {
    throw new BadRequestError('Participants summary is required.');
  }

  const discussionNotes = data.discussionNotes ? String(data.discussionNotes).trim() : '';
  if (!discussionNotes) {
    throw new BadRequestError('Discussion notes are required.');
  }

  const ustadhId = data.ustadhId ? String(data.ustadhId).trim() : null;
  if (ustadhId) {
    await assertUstadhInTenant(madrasaId, ustadhId, 'Participating Ustadh');
  }

  const incidentId = data.incidentId ? String(data.incidentId).trim() : null;
  if (incidentId) {
    const incident = await prisma.studentIncident.findFirst({
      where: { id: incidentId, madrasaId, studentId, deletedAt: null },
    });
    if (!incident) {
      throw new NotFoundError('Linked incident record not found for this student.');
    }
  }

  const created = await prisma.studentMeeting.create({
    data: {
      madrasaId,
      studentId,
      meetingType,
      title,
      meetingAt,
      location: data.location ? String(data.location).trim() : null,
      participantsSummary,
      ustadhId,
      incidentId,
      discussionNotes,
      outcomeSummary: data.outcomeSummary ? String(data.outcomeSummary).trim() : null,
      createdByUserId: auditContext.userId,
    },
    include: {
      ustadh: true,
      incident: { select: { id: true, title: true, verificationStatus: true } },
      createdByUser: { select: { id: true, name: true } },
    },
  });

  await logTenantActivity({
    madrasaId,
    userId: auditContext.userId,
    action: 'STUDENT_MEETING_RECORDED',
    entityType: 'StudentMeeting',
    entityId: created.id,
    metadata: {
      studentId,
      meetingType: created.meetingType,
      title: created.title,
      meetingAt: created.meetingAt.toISOString(),
    },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  return formatMeeting(created);
}

export async function updateStudentMeeting(madrasaId, studentId, meetingId, data, auditContext = {}) {
  await assertStudentInTenant(madrasaId, studentId);

  const existing = await prisma.studentMeeting.findFirst({
    where: {
      id: meetingId,
      madrasaId,
      studentId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new NotFoundError('Meeting record not found.');
  }

  const updateData = {};

  if (data.title !== undefined) {
    const title = String(data.title).trim();
    if (!title) throw new BadRequestError('Meeting title cannot be empty.');
    updateData.title = title;
  }

  if (data.meetingType !== undefined) {
    if (!STUDENT_MEETING_TYPES.has(data.meetingType)) {
      throw new BadRequestError(`Invalid meetingType "${data.meetingType}".`);
    }
    updateData.meetingType = data.meetingType;
  }

  if (data.meetingAt !== undefined) {
    const meetingAt = parseDateTime(data.meetingAt, 'meetingAt');
    if (!meetingAt) throw new BadRequestError('Valid meetingAt date/time is required.');
    updateData.meetingAt = meetingAt;
  }

  if (data.location !== undefined) {
    updateData.location = data.location ? String(data.location).trim() : null;
  }

  if (data.participantsSummary !== undefined) {
    const p = String(data.participantsSummary).trim();
    if (!p) throw new BadRequestError('Participants summary cannot be empty.');
    updateData.participantsSummary = p;
  }

  if (data.discussionNotes !== undefined) {
    const n = String(data.discussionNotes).trim();
    if (!n) throw new BadRequestError('Discussion notes cannot be empty.');
    updateData.discussionNotes = n;
  }

  if (data.outcomeSummary !== undefined) {
    updateData.outcomeSummary = data.outcomeSummary ? String(data.outcomeSummary).trim() : null;
  }

  if (data.ustadhId !== undefined) {
    const ustadhId = data.ustadhId ? String(data.ustadhId).trim() : null;
    if (ustadhId) {
      await assertUstadhInTenant(madrasaId, ustadhId, 'Participating Ustadh');
    }
    updateData.ustadhId = ustadhId;
  }

  if (data.incidentId !== undefined) {
    const incidentId = data.incidentId ? String(data.incidentId).trim() : null;
    if (incidentId) {
      const incident = await prisma.studentIncident.findFirst({
        where: { id: incidentId, madrasaId, studentId, deletedAt: null },
      });
      if (!incident) {
        throw new NotFoundError('Linked incident record not found for this student.');
      }
    }
    updateData.incidentId = incidentId;
  }

  const updated = await prisma.studentMeeting.update({
    where: { id: existing.id },
    data: updateData,
    include: {
      ustadh: true,
      incident: { select: { id: true, title: true, verificationStatus: true } },
      createdByUser: { select: { id: true, name: true } },
    },
  });

  await logTenantActivity({
    madrasaId,
    userId: auditContext.userId,
    action: 'STUDENT_MEETING_UPDATED',
    entityType: 'StudentMeeting',
    entityId: updated.id,
    metadata: { studentId, title: updated.title },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  return formatMeeting(updated);
}

export async function deleteStudentMeeting(madrasaId, studentId, meetingId, auditContext = {}) {
  await assertStudentInTenant(madrasaId, studentId);

  const existing = await prisma.studentMeeting.findFirst({
    where: {
      id: meetingId,
      madrasaId,
      studentId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new NotFoundError('Meeting record not found.');
  }

  await prisma.studentMeeting.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });

  await logTenantActivity({
    madrasaId,
    userId: auditContext.userId,
    action: 'STUDENT_MEETING_DELETED',
    entityType: 'StudentMeeting',
    entityId: existing.id,
    metadata: { studentId, title: existing.title },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  return { deleted: true, id: existing.id };
}

// ============================================================================
// 4. STUDENT FOLLOW-UPS, REMINDERS & DASHBOARD SUMMARY
// ============================================================================

function formatFollowUp(f, todayStr) {
  const dueDateStr = f.dueDate instanceof Date ? f.dueDate.toISOString().split('T')[0] : String(f.dueDate);
  const isOpen = f.status === 'PENDING' || f.status === 'IN_PROGRESS';
  const isOverdue = isOpen && dueDateStr < todayStr;
  const isDueToday = isOpen && dueDateStr === todayStr;
  const isUpcoming = isOpen && dueDateStr > todayStr;

  return {
    id: f.id,
    madrasaId: f.madrasaId,
    studentId: f.studentId,
    student: f.student
      ? {
          id: f.student.id,
          fullName: f.student.fullName,
          admissionNo: f.student.admissionNo,
        }
      : null,
    incidentId: f.incidentId,
    incident: f.incident
      ? {
          id: f.incident.id,
          title: f.incident.title,
          verificationStatus: f.incident.verificationStatus,
        }
      : null,
    qualificationId: f.qualificationId,
    qualification: f.qualification
      ? {
          id: f.qualification.id,
          title: f.qualification.title,
        }
      : null,
    meetingId: f.meetingId,
    meeting: f.meeting
      ? {
          id: f.meeting.id,
          title: f.meeting.title,
        }
      : null,
    title: f.title,
    notes: f.notes,
    dueDate: dueDateStr,
    reminderAt: f.reminderAt ? f.reminderAt.toISOString() : null,
    reminderSentAt: f.reminderSentAt ? f.reminderSentAt.toISOString() : null,
    priority: f.priority,
    status: f.status,
    isOverdue,
    isDueToday,
    isUpcoming,
    assignedToUstadhId: f.assignedToUstadhId,
    assignedToUstadh: f.assignedToUstadh
      ? {
          id: f.assignedToUstadh.id,
          fullName: f.assignedToUstadh.fullName,
          ustadhCode: f.assignedToUstadh.ustadhCode,
          email: f.assignedToUstadh.email,
        }
      : null,
    assignedToUserId: f.assignedToUserId,
    assignedToUser: f.assignedToUser
      ? {
          id: f.assignedToUser.id,
          name: f.assignedToUser.name,
          email: f.assignedToUser.email,
        }
      : null,
    completedAt: f.completedAt ? f.completedAt.toISOString() : null,
    completedByUserId: f.completedByUserId,
    completedByUser: f.completedByUser
      ? {
          id: f.completedByUser.id,
          name: f.completedByUser.name,
        }
      : null,
    outcomeNotes: f.outcomeNotes,
    createdByUserId: f.createdByUserId,
    createdByUser: f.createdByUser
      ? {
          id: f.createdByUser.id,
          name: f.createdByUser.name,
        }
      : null,
    navigationUrl: `/madrasa-admin/students/${f.studentId}?tab=FOLLOW_UPS&followUpId=${f.id}`,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

/**
 * Enqueues an immediate FOLLOW_UP_ASSIGNED notification job when a follow-up is assigned.
 */
async function enqueueFollowUpAssignmentNotification(followUp) {
  let recipientType = null;
  let recipientEntityId = null;
  let recipientName = null;
  let recipientEmail = null;

  if (followUp.assignedToUstadh) {
    recipientType = 'STAFF';
    recipientEntityId = followUp.assignedToUstadh.id;
    recipientName = followUp.assignedToUstadh.fullName;
    recipientEmail = followUp.assignedToUstadh.email
      ? followUp.assignedToUstadh.email.trim().toLowerCase()
      : null;
  } else if (followUp.assignedToUser) {
    recipientType = 'ADMIN_USER';
    recipientEntityId = followUp.assignedToUser.id;
    recipientName = followUp.assignedToUser.name;
    recipientEmail = followUp.assignedToUser.email
      ? followUp.assignedToUser.email.trim().toLowerCase()
      : null;
  }

  if (!recipientEntityId) return null;

  const dedupeKey = `FOLLOW_UP_ASSIGNED:${followUp.id}:${recipientEntityId}:EMAIL`;
  const dueDateStr =
    followUp.dueDate instanceof Date
      ? followUp.dueDate.toISOString().split('T')[0]
      : String(followUp.dueDate);
  const madrasaName = followUp.madrasa?.name || 'Madrasa';
  const studentName = followUp.student?.fullName || 'Student';
  const subject = `Follow-Up Assigned: ${followUp.title} — ${studentName}`;
  const htmlMessage = buildFollowUpEmailHtml({
    madrasaName,
    recipientName,
    studentName,
    admissionNo: followUp.student?.admissionNo || 'N/A',
    followUpTitle: followUp.title,
    dueDateStr,
    reminderAtStr: followUp.reminderAt ? followUp.reminderAt.toISOString() : null,
    priority: followUp.priority,
    notes: followUp.notes,
    isReminder: false,
  });

  try {
    const existing = await prisma.notificationJob.findUnique({
      where: {
        madrasaId_dedupeKey: {
          madrasaId: followUp.madrasaId,
          dedupeKey,
        },
      },
    });

    if (!existing) {
      return await prisma.notificationJob.create({
        data: {
          madrasaId: followUp.madrasaId,
          channel: 'EMAIL',
          eventType: 'FOLLOW_UP_ASSIGNED',
          recipientType,
          recipientEntityId,
          recipientAddress: recipientEmail,
          recipientName,
          subject,
          message: recipientEmail ? htmlMessage : subject,
          payloadJson: {
            followUpId: followUp.id,
            studentId: followUp.studentId,
            dueDate: dueDateStr,
            priority: followUp.priority,
          },
          relatedEntityType: 'StudentFollowUp',
          relatedEntityId: followUp.id,
          dedupeKey,
          status: recipientEmail ? 'PENDING' : 'SKIPPED_NO_RECIPIENT',
          nextAttemptAt: recipientEmail ? new Date() : null,
        },
      });
    }
  } catch {
    // Ignore duplicate key collisions
  }
  return null;
}

export async function listStudentFollowUps(madrasaId, studentId, query = {}) {
  await assertStudentInTenant(madrasaId, studentId);

  const settings = await prisma.madrasaSetting.findUnique({ where: { madrasaId } });
  const todayStr = getTenantDateString(new Date(), settings?.timezone || 'Asia/Colombo');

  const where = {
    madrasaId,
    studentId,
    deletedAt: null,
  };

  if (query.status && query.status !== 'ALL') {
    if (!FOLLOW_UP_STATUSES.has(query.status)) {
      throw new BadRequestError('Invalid follow-up status filter.');
    }
    where.status = query.status;
  }

  const records = await prisma.studentFollowUp.findMany({
    where,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      student: { select: { id: true, fullName: true, admissionNo: true } },
      incident: { select: { id: true, title: true, verificationStatus: true } },
      qualification: { select: { id: true, title: true } },
      meeting: { select: { id: true, title: true } },
      assignedToUstadh: true,
      assignedToUser: { select: { id: true, name: true, email: true } },
      completedByUser: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true } },
    },
  });

  const items = records.map((r) => formatFollowUp(r, todayStr));
  const summary = {
    total: items.length,
    overdueCount: items.filter((i) => i.isOverdue).length,
    dueTodayCount: items.filter((i) => i.isDueToday).length,
    upcomingCount: items.filter((i) => i.isUpcoming).length,
    completedCount: items.filter((i) => i.status === 'COMPLETED').length,
  };

  return { items, summary };
}

export async function createStudentFollowUp(madrasaId, studentId, data, auditContext = {}) {
  await assertStudentInTenant(madrasaId, studentId);

  const title = data.title ? String(data.title).trim() : '';
  if (!title) {
    throw new BadRequestError('Follow-up title is required.');
  }

  const dueDate = parseDateOnly(data.dueDate, 'dueDate');
  if (!dueDate) {
    throw new BadRequestError('Follow-up due date is required.');
  }

  const reminderAt = data.reminderAt ? parseDateTime(data.reminderAt, 'reminderAt') : null;

  const priority = data.priority || 'NORMAL';
  if (!FOLLOW_UP_PRIORITIES.has(priority)) {
    throw new BadRequestError(`Invalid follow-up priority "${priority}".`);
  }

  const status = data.status || 'PENDING';
  if (!FOLLOW_UP_STATUSES.has(status)) {
    throw new BadRequestError(`Invalid follow-up status "${status}".`);
  }

  const incidentId = data.incidentId ? String(data.incidentId).trim() : null;
  if (incidentId) {
    const incident = await prisma.studentIncident.findFirst({
      where: { id: incidentId, madrasaId, studentId, deletedAt: null },
    });
    if (!incident) {
      throw new NotFoundError('Linked incident record not found for this student.');
    }
  }

  const qualificationId = data.qualificationId ? String(data.qualificationId).trim() : null;
  if (qualificationId) {
    const qualification = await prisma.studentQualification.findFirst({
      where: { id: qualificationId, madrasaId, studentId, deletedAt: null },
    });
    if (!qualification) {
      throw new NotFoundError('Linked qualification record not found for this student.');
    }
  }

  const meetingId = data.meetingId ? String(data.meetingId).trim() : null;
  if (meetingId) {
    const meeting = await prisma.studentMeeting.findFirst({
      where: { id: meetingId, madrasaId, studentId, deletedAt: null },
    });
    if (!meeting) {
      throw new NotFoundError('Linked meeting record not found for this student.');
    }
  }

  const assignedToUstadhId = data.assignedToUstadhId ? String(data.assignedToUstadhId).trim() : null;
  if (assignedToUstadhId) {
    await assertUstadhInTenant(madrasaId, assignedToUstadhId, 'Assigned Ustadh');
  }

  const assignedToUserId = data.assignedToUserId ? String(data.assignedToUserId).trim() : null;
  if (assignedToUserId) {
    await assertUserInTenant(madrasaId, assignedToUserId, 'Assigned Admin User');
  }

  const now = new Date();
  const created = await prisma.studentFollowUp.create({
    data: {
      madrasaId,
      studentId,
      incidentId,
      qualificationId,
      meetingId,
      title,
      notes: data.notes ? String(data.notes).trim() : null,
      dueDate,
      reminderAt,
      priority,
      status,
      assignedToUstadhId,
      assignedToUserId,
      completedAt: status === 'COMPLETED' ? now : null,
      completedByUserId: status === 'COMPLETED' ? auditContext.userId || null : null,
      outcomeNotes: data.outcomeNotes ? String(data.outcomeNotes).trim() : null,
      createdByUserId: auditContext.userId,
    },
    include: {
      madrasa: true,
      student: { select: { id: true, fullName: true, admissionNo: true } },
      incident: { select: { id: true, title: true, verificationStatus: true } },
      qualification: { select: { id: true, title: true } },
      meeting: { select: { id: true, title: true } },
      assignedToUstadh: true,
      assignedToUser: { select: { id: true, name: true, email: true } },
      completedByUser: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true } },
    },
  });

  if (created.assignedToUstadhId || created.assignedToUserId) {
    await enqueueFollowUpAssignmentNotification(created);
  }

  // If reminderAt is already due/now, evaluate immediately
  if (created.reminderAt && created.reminderAt <= now && (created.status === 'PENDING' || created.status === 'IN_PROGRESS')) {
    await processFollowUpReminders(now);
  }

  await logTenantActivity({
    madrasaId,
    userId: auditContext.userId,
    action: 'STUDENT_FOLLOW_UP_CREATED',
    entityType: 'StudentFollowUp',
    entityId: created.id,
    metadata: {
      studentId,
      title: created.title,
      dueDate: created.dueDate.toISOString().split('T')[0],
      reminderAt: created.reminderAt ? created.reminderAt.toISOString() : null,
      priority: created.priority,
      incidentId: created.incidentId,
    },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  const settings = await prisma.madrasaSetting.findUnique({ where: { madrasaId } });
  const todayStr = getTenantDateString(now, settings?.timezone || 'Asia/Colombo');

  return formatFollowUp(created, todayStr);
}

export async function updateStudentFollowUp(
  madrasaId,
  studentId,
  followUpId,
  data,
  auditContext = {}
) {
  await assertStudentInTenant(madrasaId, studentId);

  const existing = await prisma.studentFollowUp.findFirst({
    where: {
      id: followUpId,
      madrasaId,
      studentId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new NotFoundError('Follow-up record not found.');
  }

  const updateData = {};
  let reminderRescheduled = false;
  let assigneeChanged = false;

  if (data.title !== undefined) {
    const title = String(data.title).trim();
    if (!title) throw new BadRequestError('Follow-up title cannot be empty.');
    updateData.title = title;
  }

  if (data.notes !== undefined) {
    updateData.notes = data.notes ? String(data.notes).trim() : null;
  }

  if (data.dueDate !== undefined) {
    const dueDate = parseDateOnly(data.dueDate, 'dueDate');
    if (!dueDate) throw new BadRequestError('Valid due date is required.');
    updateData.dueDate = dueDate;
  }

  if (data.reminderAt !== undefined) {
    const nextReminderAt = data.reminderAt ? parseDateTime(data.reminderAt, 'reminderAt') : null;
    const prevIso = existing.reminderAt ? existing.reminderAt.toISOString() : null;
    const nextIso = nextReminderAt ? nextReminderAt.toISOString() : null;
    if (prevIso !== nextIso) {
      updateData.reminderAt = nextReminderAt;
      updateData.reminderSentAt = null;
      reminderRescheduled = true;
    }
  }

  if (data.priority !== undefined) {
    if (!FOLLOW_UP_PRIORITIES.has(data.priority)) {
      throw new BadRequestError(`Invalid priority "${data.priority}".`);
    }
    updateData.priority = data.priority;
  }

  if (data.assignedToUstadhId !== undefined) {
    const assignedToUstadhId = data.assignedToUstadhId ? String(data.assignedToUstadhId).trim() : null;
    if (assignedToUstadhId) {
      await assertUstadhInTenant(madrasaId, assignedToUstadhId, 'Assigned Ustadh');
    }
    if (assignedToUstadhId !== existing.assignedToUstadhId) {
      updateData.assignedToUstadhId = assignedToUstadhId;
      assigneeChanged = true;
    }
  }

  if (data.assignedToUserId !== undefined) {
    const assignedToUserId = data.assignedToUserId ? String(data.assignedToUserId).trim() : null;
    if (assignedToUserId) {
      await assertUserInTenant(madrasaId, assignedToUserId, 'Assigned Admin User');
    }
    if (assignedToUserId !== existing.assignedToUserId) {
      updateData.assignedToUserId = assignedToUserId;
      assigneeChanged = true;
    }
  }

  if (data.outcomeNotes !== undefined) {
    updateData.outcomeNotes = data.outcomeNotes ? String(data.outcomeNotes).trim() : null;
  }

  const now = new Date();
  const nextStatus = data.status !== undefined ? data.status : existing.status;
  if (!FOLLOW_UP_STATUSES.has(nextStatus)) {
    throw new BadRequestError(`Invalid follow-up status "${nextStatus}".`);
  }

  if (data.status !== undefined) {
    updateData.status = nextStatus;
    if (nextStatus === 'COMPLETED') {
      updateData.completedAt = existing.completedAt || now;
      updateData.completedByUserId = auditContext.userId || null;
    } else if (nextStatus === 'PENDING' || nextStatus === 'IN_PROGRESS') {
      updateData.completedAt = null;
      updateData.completedByUserId = null;
    }
  }

  const updated = await prisma.studentFollowUp.update({
    where: { id: existing.id },
    data: updateData,
    include: {
      madrasa: true,
      student: { select: { id: true, fullName: true, admissionNo: true } },
      incident: { select: { id: true, title: true, verificationStatus: true } },
      qualification: { select: { id: true, title: true } },
      meeting: { select: { id: true, title: true } },
      assignedToUstadh: true,
      assignedToUser: { select: { id: true, name: true, email: true } },
      completedByUser: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true } },
    },
  });

  // Cancel any pending reminder jobs if completed, cancelled, or rescheduled
  if (updated.status === 'COMPLETED' || updated.status === 'CANCELLED' || reminderRescheduled) {
    await prisma.notificationJob.updateMany({
      where: {
        madrasaId,
        relatedEntityType: 'StudentFollowUp',
        relatedEntityId: updated.id,
        status: 'PENDING',
        ...(reminderRescheduled && updated.status !== 'COMPLETED' && updated.status !== 'CANCELLED'
          ? { eventType: 'FOLLOW_UP_REMINDER' }
          : {}),
      },
      data: {
        status: 'CANCELLED',
        lastError:
          updated.status === 'COMPLETED' || updated.status === 'CANCELLED'
            ? 'FOLLOW_UP_ALREADY_CLOSED'
            : 'FOLLOW_UP_RESCHEDULED',
        failedAt: now,
        nextAttemptAt: null,
      },
    });
  }

  if (assigneeChanged && (updated.assignedToUstadhId || updated.assignedToUserId)) {
    await enqueueFollowUpAssignmentNotification(updated);
  }

  if (
    reminderRescheduled &&
    updated.reminderAt &&
    updated.reminderAt <= now &&
    (updated.status === 'PENDING' || updated.status === 'IN_PROGRESS')
  ) {
    await processFollowUpReminders(now);
  }

  await logTenantActivity({
    madrasaId,
    userId: auditContext.userId,
    action:
      updated.status === 'COMPLETED' && existing.status !== 'COMPLETED'
        ? 'STUDENT_FOLLOW_UP_COMPLETED'
        : 'STUDENT_FOLLOW_UP_UPDATED',
    entityType: 'StudentFollowUp',
    entityId: updated.id,
    metadata: {
      studentId,
      previousStatus: existing.status,
      newStatus: updated.status,
      reminderRescheduled,
      reminderAt: updated.reminderAt ? updated.reminderAt.toISOString() : null,
    },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  const settings = await prisma.madrasaSetting.findUnique({ where: { madrasaId } });
  const todayStr = getTenantDateString(now, settings?.timezone || 'Asia/Colombo');

  return formatFollowUp(updated, todayStr);
}

export async function deleteStudentFollowUp(madrasaId, studentId, followUpId, auditContext = {}) {
  await assertStudentInTenant(madrasaId, studentId);

  const existing = await prisma.studentFollowUp.findFirst({
    where: {
      id: followUpId,
      madrasaId,
      studentId,
      deletedAt: null,
    },
  });

  if (!existing) {
    throw new NotFoundError('Follow-up record not found.');
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.studentFollowUp.update({
      where: { id: existing.id },
      data: { deletedAt: now },
    }),
    prisma.notificationJob.updateMany({
      where: {
        madrasaId,
        relatedEntityType: 'StudentFollowUp',
        relatedEntityId: existing.id,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
        lastError: 'FOLLOW_UP_ALREADY_CLOSED',
        failedAt: now,
        nextAttemptAt: null,
      },
    }),
  ]);

  await logTenantActivity({
    madrasaId,
    userId: auditContext.userId,
    action: 'STUDENT_FOLLOW_UP_DELETED',
    entityType: 'StudentFollowUp',
    entityId: existing.id,
    metadata: { studentId, title: existing.title },
    ipAddress: auditContext.ipAddress,
    userAgent: auditContext.userAgent,
  });

  return { deleted: true, id: existing.id };
}

/**
 * Returns Madrasa-wide follow-up reminder summary for the Madrasa Admin Dashboard.
 */
export async function getMadrasaFollowUpsSummary(madrasaId, referenceDate = new Date()) {
  const settings = await prisma.madrasaSetting.findUnique({ where: { madrasaId } });
  const todayStr = getTenantDateString(referenceDate, settings?.timezone || 'Asia/Colombo');

  const openFollowUps = await prisma.studentFollowUp.findMany({
    where: {
      madrasaId,
      deletedAt: null,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
    include: {
      student: { select: { id: true, fullName: true, admissionNo: true } },
      incident: { select: { id: true, title: true, verificationStatus: true } },
      qualification: { select: { id: true, title: true } },
      meeting: { select: { id: true, title: true } },
      assignedToUstadh: true,
      assignedToUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true } },
    },
  });

  const formatted = openFollowUps.map((f) => formatFollowUp(f, todayStr));
  const overdueItems = formatted.filter((f) => f.isOverdue);
  const dueTodayItems = formatted.filter((f) => f.isDueToday);
  const upcomingItems = formatted.filter((f) => f.isUpcoming);

  return {
    todayDate: todayStr,
    timezone: settings?.timezone || 'Asia/Colombo',
    overdueCount: overdueItems.length,
    dueTodayCount: dueTodayItems.length,
    upcomingCount: upcomingItems.length,
    totalOpenCount: formatted.length,
    overdueItems: overdueItems.slice(0, 10),
    dueTodayItems: dueTodayItems.slice(0, 10),
    upcomingItems: upcomingItems.slice(0, 10),
    items: formatted.slice(0, 15),
  };
}

// ============================================================================
// 5. UNIFIED STUDENT CHRONOLOGICAL TIMELINE
// ============================================================================

export async function getStudentTimeline(madrasaId, studentId, query = {}) {
  const student = await assertStudentInTenant(madrasaId, studentId);
  const filterCategory = query.category && query.category !== 'ALL' ? String(query.category).toUpperCase() : 'ALL';

  const [qualifications, incidents, meetings, followUps] = await Promise.all([
    prisma.studentQualification.findMany({
      where: { madrasaId, studentId, deletedAt: null },
      include: {
        examinerUstadh: { select: { id: true, fullName: true } },
        reviewedByUser: { select: { id: true, name: true } },
      },
    }),
    prisma.studentIncident.findMany({
      where: { madrasaId, studentId, deletedAt: null },
      include: {
        reportedByUstadh: { select: { id: true, fullName: true } },
        reportedByUser: { select: { id: true, name: true } },
        reviewedByUser: { select: { id: true, name: true } },
      },
    }),
    prisma.studentMeeting.findMany({
      where: { madrasaId, studentId, deletedAt: null },
      include: {
        ustadh: { select: { id: true, fullName: true } },
        createdByUser: { select: { id: true, name: true } },
      },
    }),
    prisma.studentFollowUp.findMany({
      where: { madrasaId, studentId, deletedAt: null },
      include: {
        assignedToUstadh: { select: { id: true, fullName: true } },
        assignedToUser: { select: { id: true, name: true } },
        completedByUser: { select: { id: true, name: true } },
      },
    }),
  ]);

  const events = [];

  // 1. Enrollment milestone
  if (student.admissionDate) {
    events.push({
      id: `enrollment-${student.id}`,
      type: 'ENROLLMENT',
      category: 'ENROLLMENT',
      timestamp: student.admissionDate.toISOString(),
      title: `Enrolled at Madrasa (Admission #${student.admissionNo})`,
      subtitle: `Guardian: ${student.guardianName}`,
      status: student.status,
      metadata: {
        admissionNo: student.admissionNo,
      },
    });
  }

  // 2. Qualifications & Achievements
  for (const q of qualifications) {
    const eventType = q.recordType === 'ACHIEVEMENT' ? 'ACHIEVEMENT' : 'QUALIFICATION';
    const eventDate = q.achievedDate || q.createdAt;
    events.push({
      id: `qual-${q.id}`,
      entityId: q.id,
      type: eventType,
      category: eventType,
      timestamp: eventDate.toISOString(),
      title: q.title,
      subtitle: `${q.category.replace(/_/g, ' ')} • Progress: ${q.progressStatus} • Verification: ${q.verificationStatus}`,
      description: q.description,
      status: q.verificationStatus,
      progressStatus: q.progressStatus,
      verificationStatus: q.verificationStatus,
      metadata: {
        category: q.category,
        gradeOrScore: q.gradeOrScore,
        issuingAuthority: q.issuingAuthority,
        examinerName: q.examinerUstadh?.fullName || null,
        reviewedByName: q.reviewedByUser?.name || null,
        rejectionReason: q.rejectionReason || null,
        hasCertificateFile: Boolean(q.certificateFileId),
      },
    });
  }

  // 3. Incidents (Explicitly distinguishing unconfirmed reports, confirmed findings, resolved, and dismissed)
  for (const inc of incidents) {
    const isUnconfirmedReport =
      inc.verificationStatus === 'REPORTED' || inc.verificationStatus === 'UNDER_REVIEW';
    const isConfirmedMisconduct =
      inc.verificationStatus === 'CONFIRMED' && Boolean(inc.investigatedFindings);
    const isResolved = inc.verificationStatus === 'RESOLVED';
    const isDismissed = inc.verificationStatus === 'DISMISSED';

    const statusLabel = isDismissed
      ? 'Dismissed — Not Proven Misconduct'
      : isConfirmedMisconduct
      ? 'Confirmed Finding'
      : isResolved
      ? 'Resolved Incident'
      : `Unconfirmed Report (${inc.verificationStatus})`;

    events.push({
      id: `incident-${inc.id}`,
      entityId: inc.id,
      type: 'INCIDENT',
      category: 'DISCIPLINE',
      timestamp: inc.occurredAt.toISOString(),
      title: inc.title,
      subtitle: `${inc.category.replace(/_/g, ' ')} • Severity: ${inc.severity} • ${statusLabel}`,
      description: isConfirmedMisconduct
        ? inc.investigatedFindings || inc.reportedDescription
        : isResolved
        ? inc.actionTaken || inc.investigatedFindings || inc.reportedDescription
        : isDismissed
        ? inc.dismissalReason || inc.investigatedFindings || inc.reportedDescription
        : inc.reportedDescription,
      status: inc.verificationStatus,
      metadata: {
        severity: inc.severity,
        verificationStatus: inc.verificationStatus,
        isUnconfirmedReport,
        isConfirmedMisconduct,
        isResolved,
        isDismissed,
        reportedDescription: inc.reportedDescription,
        investigatedFindings: inc.investigatedFindings,
        actionTaken: inc.actionTaken,
        dismissalReason: inc.dismissalReason,
        hasEvidenceFile: Boolean(inc.evidenceFileId),
      },
    });
  }

  // 4. Meetings
  for (const m of meetings) {
    events.push({
      id: `meeting-${m.id}`,
      entityId: m.id,
      type: 'MEETING',
      category: 'MEETING',
      timestamp: m.meetingAt.toISOString(),
      title: m.title,
      subtitle: `${m.meetingType.replace(/_/g, ' ')} • Participants: ${m.participantsSummary}`,
      description: m.outcomeSummary || m.discussionNotes,
      status: 'RECORDED',
      metadata: {
        meetingType: m.meetingType,
        participantsSummary: m.participantsSummary,
        discussionNotes: m.discussionNotes,
        outcomeSummary: m.outcomeSummary,
        ustadhName: m.ustadh?.fullName || null,
        incidentId: m.incidentId,
      },
    });
  }

  // 5. Follow-Ups
  for (const f of followUps) {
    const eventTime = f.completedAt || f.createdAt;
    events.push({
      id: `followup-${f.id}`,
      entityId: f.id,
      type: 'FOLLOW_UP',
      category: 'FOLLOW_UP',
      timestamp: eventTime.toISOString(),
      title: f.title,
      subtitle: `Follow-Up (${f.status}) • Due: ${f.dueDate.toISOString().split('T')[0]} • Priority: ${f.priority}`,
      description: f.outcomeNotes || f.notes,
      status: f.status,
      metadata: {
        dueDate: f.dueDate.toISOString().split('T')[0],
        reminderAt: f.reminderAt ? f.reminderAt.toISOString() : null,
        priority: f.priority,
        assigneeName: f.assignedToUstadh?.fullName || f.assignedToUser?.name || null,
        completedByName: f.completedByUser?.name || null,
        outcomeNotes: f.outcomeNotes,
      },
    });
  }

  const filtered =
    filterCategory === 'ALL'
      ? events
      : events.filter((e) => e.category === filterCategory || e.type === filterCategory);

  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    items: filtered,
    total: filtered.length,
  };
}
