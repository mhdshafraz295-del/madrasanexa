import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError,
} from '../utils/errors.js';
import { formatDateOnly } from '../utils/dateTime.js';
import { resolveObjectAccessUrl, getStudentDocumentStream } from './r2.service.js';

/**
 * Reliable Transient Concurrency Error Inspector
 * Differentiates transient deadlock/sequence collisions from application unique violations.
 */
function isTransientSequenceError(err) {
  if (!err) return false;
  if (err.code === 'P2034') return true;

  if (err.code === 'P2002') {
    const target = Array.isArray(err.meta?.target)
      ? err.meta.target.join(',')
      : String(err.meta?.target || '');

    // Retry only if collision happened on the sequence table or generated index number
    if (
      target.includes('madrasaId_year') ||
      target.includes('alumniIndexNumber') ||
      target.includes('alumni_index_sequences')
    ) {
      return true;
    }
    return false;
  }

  if (err.message) {
    const msg = err.message.toLowerCase();
    if (msg.includes('1213') || msg.includes('1205') || msg.includes('deadlock')) {
      return true;
    }
  }

  return false;
}

/**
 * 1. CREATE ALUMNI PROFILE (Atomic Sequence + Profile creation in one transaction)
 */
export async function createAlumniProfileWithSequence(madrasaId, studentId, data, userId, maxRetries = 3) {
  let attempt = 0;
  const currentYear = new Date().getFullYear();

  while (attempt < maxRetries) {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Verify student eligibility and absence of existing alumni profile
        const existingProfile = await tx.alumniProfile.findUnique({
          where: { studentId_madrasaId: { studentId, madrasaId } },
        });

        if (existingProfile) {
          throw new ConflictError('An Alumni Profile already exists for this student in this institution.');
        }

        const student = await tx.student.findFirst({
          where: { id: studentId, madrasaId },
          select: { id: true, admissionDate: true, status: true, fullName: true },
        });

        if (!student) {
          throw new NotFoundError('Student record not found in this institution.');
        }

        const madrasa = await tx.madrasa.findUnique({
          where: { id: madrasaId },
          select: { code: true },
        });

        const madrasaCode = (madrasa?.code || 'NEXA').replace(/[^A-Z0-9]/gi, '').toUpperCase();

        // 2. Atomic sequence generation with row-level mutex
        const sequenceRowId = `seq_${crypto.randomUUID().replace(/-/g, '')}`;
        await tx.$executeRaw`
          INSERT INTO alumni_index_sequences (id, madrasaId, year, lastSequence, updatedAt)
          VALUES (${sequenceRowId}, ${madrasaId}, ${currentYear}, 1, NOW(3))
          ON DUPLICATE KEY UPDATE
            lastSequence = lastSequence + 1,
            updatedAt = NOW(3);
        `;

        const seqRow = await tx.alumniIndexSequence.findUnique({
          where: { madrasaId_year: { madrasaId, year: currentYear } },
          select: { lastSequence: true },
        });

        const seq = seqRow ? seqRow.lastSequence : 1;
        const paddedSeq = seq > 9999 ? String(seq) : String(seq).padStart(4, '0');
        const alumniIndexNumber = `ALM-${madrasaCode}-${currentYear}-${paddedSeq}`;

        // 3. Create Alumni Profile
        const profile = await tx.alumniProfile.create({
          data: {
            madrasaId,
            studentId,
            alumniIndexNumber,
            admissionDate: student.admissionDate,
            leavingDate: new Date(data.leavingDate),
            leavingReason: data.leavingReason || null,
            completedProgrammes: data.completedProgrammes || [],
            academicHighlights: data.academicHighlights || [],
            characterAssessmentRating: data.characterAssessmentRating || data.characterAssessment || null,
            characterAssessmentText: data.characterAssessmentText || data.characterAssessmentNotes || null,
            allowPublicConductShare: Boolean(data.allowPublicConductShare),
            publicationStatus: 'DRAFT',
            consentStatus: 'PENDING',
          },
          include: {
            student: { select: { id: true, fullName: true, admissionNo: true } },
          },
        });

        // 4. Audit Log
        await tx.activityLog.create({
          data: {
            madrasaId,
            userId,
            action: 'ALUMNI_PROFILE_CREATED',
            entityType: 'AlumniProfile',
            entityId: profile.id,
            metadata: {
              alumniIndexNumber: profile.alumniIndexNumber,
              studentId: profile.studentId,
            },
          },
        });

        return profile;
      }, {
        isolationLevel: 'Serializable',
      });
    } catch (err) {
      if (!isTransientSequenceError(err)) {
        throw err;
      }

      attempt++;
      if (attempt >= maxRetries) {
        throw new ServiceUnavailableError(
          'Unable to allocate a unique Alumni Index Number due to concurrent sequence contention. Please retry your request.'
        );
      }

      await new Promise((res) => setTimeout(res, 50 * Math.pow(2, attempt) + Math.random() * 25));
    }
  }
}

/**
 * 2. LIST MADRASA ALUMNI (Tenant-Scoped Roster)
 */
export async function listMadrasaAlumni(madrasaId, query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const where = { madrasaId };
  if (query.status) {
    where.publicationStatus = query.status;
  }
  if (query.consentStatus) {
    where.consentStatus = query.consentStatus;
  }
  if (query.q && query.q.trim()) {
    const q = query.q.trim();
    where.OR = [
      { alumniIndexNumber: { contains: q } },
      { student: { fullName: { contains: q } } },
      { student: { admissionNo: { contains: q } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.alumniProfile.count({ where }),
    prisma.alumniProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            admissionNo: true,
            photoFileId: true,
            status: true,
          },
        },
        _count: {
          select: { verificationRequests: true, consentRecords: true },
        },
      },
    }),
  ]);

  // Resolve photos
  const enriched = await Promise.all(
    items.map(async (item) => {
      let photoUrl = null;
      if (item.student.photoFileId) {
        try {
          const fileObj = await prisma.fileObject.findUnique({
            where: { id: item.student.photoFileId },
            select: { objectKey: true, publicUrl: true },
          });
          if (fileObj) {
            photoUrl = fileObj.publicUrl || (await resolveObjectAccessUrl(fileObj.objectKey));
          }
        } catch {
          photoUrl = null;
        }
      }

      return {
        id: item.id,
        alumniIndexNumber: item.alumniIndexNumber,
        studentId: item.studentId,
        studentName: item.student.fullName,
        admissionNo: item.student.admissionNo,
        student: {
          id: item.studentId,
          fullName: item.student.fullName,
          admissionNumber: item.student.admissionNo,
          admissionNo: item.student.admissionNo,
        },
        photoUrl,
        admissionDate: formatDateOnly(item.admissionDate),
        leavingDate: formatDateOnly(item.leavingDate),
        leavingReason: item.leavingReason,
        completedProgrammes: item.completedProgrammes || [],
        characterAssessmentRating: item.characterAssessmentRating,
        allowPublicConductShare: item.allowPublicConductShare,
        publicationStatus: item.publicationStatus,
        publishedAt: item.publishedAt,
        consentStatus: item.consentStatus,
        consentVersion: item.consentVersion,
        consentGrantedAt: item.consentGrantedAt,
        consentWithdrawnAt: item.consentWithdrawnAt,
        verificationRequestCount: item._count.verificationRequests,
        consentRecordCount: item._count.consentRecords,
        createdAt: item.createdAt,
      };
    })
  );

  return {
    data: enriched,
    items: enriched,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 3. GET MADRASA ALUMNI DETAILS (Internal View for Issuing Madrasa Admin)
 */
export async function getMadrasaAlumniDetails(madrasaId, alumniId) {
  const alumni = await prisma.alumniProfile.findFirst({
    where: { id: alumniId, madrasaId },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          admissionNo: true,
          photoFileId: true,
          qualifications: {
            where: { deletedAt: null },
            include: { certificateFile: true },
            orderBy: { achievedDate: 'desc' },
          },
        },
      },
      consentRecords: {
        orderBy: { createdAt: 'desc' },
        include: {
          recordedByUser: { select: { id: true, name: true } },
          evidenceFile: { select: { id: true, originalName: true, mimeType: true } },
        },
      },
      verificationRequests: {
        orderBy: { createdAt: 'desc' },
        include: {
          requestingMadrasa: { select: { id: true, name: true, code: true } },
          requestedByUser: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!alumni) {
    throw new NotFoundError('Alumni profile not found.');
  }

  let photoUrl = null;
  if (alumni.student.photoFileId) {
    try {
      const fileObj = await prisma.fileObject.findUnique({
        where: { id: alumni.student.photoFileId },
        select: { objectKey: true, publicUrl: true },
      });
      if (fileObj) {
        photoUrl = fileObj.publicUrl || (await resolveObjectAccessUrl(fileObj.objectKey));
      }
    } catch {
      photoUrl = null;
    }
  }

  return {
    id: alumni.id,
    madrasaId: alumni.madrasaId,
    alumniIndexNumber: alumni.alumniIndexNumber,
    studentId: alumni.studentId,
    studentName: alumni.student.fullName,
    admissionNo: alumni.student.admissionNo,
    photoUrl,
    admissionDate: formatDateOnly(alumni.admissionDate),
    leavingDate: formatDateOnly(alumni.leavingDate),
    leavingReason: alumni.leavingReason,
    completedProgrammes: alumni.completedProgrammes || [],
    academicHighlights: alumni.academicHighlights || [],
    characterAssessmentRating: alumni.characterAssessmentRating,
    characterAssessmentText: alumni.characterAssessmentText,
    allowPublicConductShare: alumni.allowPublicConductShare,
    publicationStatus: alumni.publicationStatus,
    publishedAt: alumni.publishedAt,
    consentStatus: alumni.consentStatus,
    consentGivenBy: alumni.consentGivenBy,
    consentSignerName: alumni.consentSignerName,
    consentGrantedAt: alumni.consentGrantedAt,
    consentWithdrawnAt: alumni.consentWithdrawnAt,
    consentWithdrawnReason: alumni.consentWithdrawnReason,
    consentVersion: alumni.consentVersion,
    consentProofType: alumni.consentProofType,
    consentFileId: alumni.consentFileId,
    consentNotes: alumni.consentNotes,
    qualifications: alumni.student.qualifications.map((q) => ({
      id: q.id,
      title: q.title,
      category: q.category,
      recordType: q.recordType,
      issuingAuthority: q.issuingAuthority,
      certificateNumber: q.certificateNumber,
      progressStatus: q.progressStatus,
      verificationStatus: q.verificationStatus,
      achievedDate: formatDateOnly(q.achievedDate),
      gradeOrScore: q.gradeOrScore,
      hasCertificateDocument: Boolean(q.certificateFileId),
    })),
    consentHistory: alumni.consentRecords.map((r) => ({
      id: r.id,
      action: r.action,
      consentParty: r.consentParty,
      signerName: r.signerName,
      consentVersion: r.consentVersion,
      proofType: r.proofType,
      withdrawalReason: r.withdrawalReason,
      recordedBy: r.recordedByUser?.name,
      recordedAt: r.createdAt,
      evidenceFileName: r.evidenceFile?.originalName || null,
    })),
    verificationRequests: alumni.verificationRequests.map((v) => ({
      id: v.id,
      requestingMadrasa: v.requestingMadrasa.name,
      requestingMadrasaCode: v.requestingMadrasa.code,
      purpose: v.purpose,
      specificInquiry: v.specificInquiry,
      includeCharacter: v.includeCharacter,
      status: v.status,
      responseNotes: v.responseNotes,
      createdAt: v.createdAt,
      respondedAt: v.respondedAt,
    })),
    createdAt: alumni.createdAt,
    updatedAt: alumni.updatedAt,
  };
}

/**
 * 4. UPDATE ALUMNI PROFILE (Only original issuing madrasa)
 */
export async function updateAlumniProfile(madrasaId, alumniId, data, userId) {
  const existing = await prisma.alumniProfile.findFirst({
    where: { id: alumniId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Alumni profile not found.');
  }

  // Immutable safety guard: Never allow changing alumniIndexNumber or studentId
  const updateData = {};
  if (data.leavingDate) updateData.leavingDate = new Date(data.leavingDate);
  if (data.leavingReason !== undefined) updateData.leavingReason = data.leavingReason;
  if (data.completedProgrammes !== undefined) updateData.completedProgrammes = data.completedProgrammes;
  if (data.academicHighlights !== undefined) updateData.academicHighlights = data.academicHighlights;
  if (data.characterAssessmentRating !== undefined) updateData.characterAssessmentRating = data.characterAssessmentRating;
  if (data.characterAssessmentText !== undefined) updateData.characterAssessmentText = data.characterAssessmentText;
  if (data.allowPublicConductShare !== undefined) updateData.allowPublicConductShare = Boolean(data.allowPublicConductShare);

  const updated = await prisma.$transaction(async (tx) => {
    const profile = await tx.alumniProfile.update({
      where: { id: alumniId },
      data: updateData,
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'ALUMNI_PROFILE_UPDATED',
        entityType: 'AlumniProfile',
        entityId: alumniId,
        metadata: {
          updatedFields: Object.keys(updateData),
        },
      },
    });

    return profile;
  });

  return updated;
}

/**
 * 5. RECORD INITIAL CONSENT (Creates immutable audit record)
 */
export async function recordConsent(madrasaId, alumniId, data, userId) {
  const existing = await prisma.alumniProfile.findFirst({
    where: { id: alumniId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Alumni profile not found.');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Create immutable audit record
    await tx.alumniConsentRecord.create({
      data: {
        alumniProfileId: alumniId,
        madrasaId,
        action: 'INITIAL_GRANT',
        consentParty: data.consentParty,
        signerName: data.signerName,
        consentVersion: data.consentVersion || 'v1.0-2026',
        proofType: data.proofType,
        evidenceFileId: data.consentFileId || null,
        recordedByUserId: userId,
      },
    });

    // 2. Update AlumniProfile active consent state
    const updated = await tx.alumniProfile.update({
      where: { id: alumniId },
      data: {
        consentStatus: 'GRANTED',
        consentGivenBy: data.consentParty,
        consentSignerName: data.signerName,
        consentGrantedAt: new Date(),
        consentVersion: data.consentVersion || 'v1.0-2026',
        consentProofType: data.proofType,
        consentFileId: data.consentFileId || null,
        consentNotes: data.consentNotes || null,
        consentWithdrawnAt: null,
        consentWithdrawnReason: null,
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'ALUMNI_CONSENT_GRANTED',
        entityType: 'AlumniProfile',
        entityId: alumniId,
        metadata: {
          consentParty: data.consentParty,
          proofType: data.proofType,
          consentVersion: data.consentVersion || 'v1.0-2026',
        },
      },
    });

    return updated;
  });
}

/**
 * 6. WITHDRAW CONSENT (Immediate blocking & exclusion)
 */
export async function withdrawConsent(madrasaId, alumniId, reason, userId) {
  const existing = await prisma.alumniProfile.findFirst({
    where: { id: alumniId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Alumni profile not found.');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Record immutable withdrawal audit event
    await tx.alumniConsentRecord.create({
      data: {
        alumniProfileId: alumniId,
        madrasaId,
        action: 'WITHDRAWAL',
        consentParty: existing.consentGivenBy || 'GUARDIAN',
        signerName: existing.consentSignerName || 'Unknown',
        consentVersion: existing.consentVersion,
        proofType: existing.consentProofType,
        evidenceFileId: existing.consentFileId,
        withdrawalReason: reason,
        recordedByUserId: userId,
      },
    });

    // 2. Atomically block and unpublish
    const updated = await tx.alumniProfile.update({
      where: { id: alumniId },
      data: {
        consentStatus: 'WITHDRAWN',
        consentWithdrawnAt: new Date(),
        consentWithdrawnReason: reason,
        publicationStatus: 'UNPUBLISHED',
        allowPublicConductShare: false,
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'ALUMNI_CONSENT_WITHDRAWN',
        entityType: 'AlumniProfile',
        entityId: alumniId,
        metadata: {
          reason,
          previousPublicationStatus: existing.publicationStatus,
        },
      },
    });

    return updated;
  });
}

/**
 * 7. RENEW CONSENT (Fresh legal document required)
 */
export async function renewConsent(madrasaId, alumniId, data, userId) {
  const existing = await prisma.alumniProfile.findFirst({
    where: { id: alumniId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Alumni profile not found.');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Append renewal audit record
    await tx.alumniConsentRecord.create({
      data: {
        alumniProfileId: alumniId,
        madrasaId,
        action: 'RENEWAL',
        consentParty: data.consentParty,
        signerName: data.signerName,
        consentVersion: data.consentVersion,
        proofType: data.proofType,
        evidenceFileId: data.consentFileId,
        recordedByUserId: userId,
      },
    });

    // 2. Update profile consent state
    const updated = await tx.alumniProfile.update({
      where: { id: alumniId },
      data: {
        consentStatus: 'GRANTED',
        consentGivenBy: data.consentParty,
        consentSignerName: data.signerName,
        consentGrantedAt: new Date(),
        consentWithdrawnAt: null,
        consentWithdrawnReason: null,
        consentVersion: data.consentVersion,
        consentProofType: data.proofType,
        consentFileId: data.consentFileId,
        consentNotes: data.consentNotes || null,
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'ALUMNI_CONSENT_RENEWED',
        entityType: 'AlumniProfile',
        entityId: alumniId,
        metadata: {
          consentVersion: data.consentVersion,
          proofType: data.proofType,
        },
      },
    });

    return updated;
  });
}

/**
 * 8. PUBLISH ALUMNI PROFILE (Strict gate: consent must be GRANTED)
 */
export async function publishAlumniProfile(madrasaId, alumniId, userId) {
  const existing = await prisma.alumniProfile.findFirst({
    where: { id: alumniId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Alumni profile not found.');
  }

  if (existing.consentStatus !== 'GRANTED') {
    throw new BadRequestError('Cannot publish alumni profile: Valid student/guardian consent is strictly mandatory.');
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.alumniProfile.update({
      where: { id: alumniId },
      data: {
        publicationStatus: 'PUBLISHED',
        publishedAt: new Date(),
        publishedByUserId: userId,
        revokedAt: null,
        revocationReason: null,
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'ALUMNI_PROFILE_PUBLISHED',
        entityType: 'AlumniProfile',
        entityId: alumniId,
        metadata: {
          alumniIndexNumber: existing.alumniIndexNumber,
        },
      },
    });

    return updated;
  });
}

/**
 * 9. UNPUBLISH / REVOKE ALUMNI PROFILE
 */
export async function unpublishAlumniProfile(madrasaId, alumniId, userId) {
  const existing = await prisma.alumniProfile.findFirst({
    where: { id: alumniId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Alumni profile not found.');
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.alumniProfile.update({
      where: { id: alumniId },
      data: {
        publicationStatus: 'UNPUBLISHED',
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'ALUMNI_PROFILE_UNPUBLISHED',
        entityType: 'AlumniProfile',
        entityId: alumniId,
        metadata: {
          alumniIndexNumber: existing.alumniIndexNumber,
        },
      },
    });

    return updated;
  });
}

export async function revokeAlumniProfile(madrasaId, alumniId, reason, userId) {
  const existing = await prisma.alumniProfile.findFirst({
    where: { id: alumniId, madrasaId },
  });

  if (!existing) {
    throw new NotFoundError('Alumni profile not found.');
  }

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.alumniProfile.update({
      where: { id: alumniId },
      data: {
        publicationStatus: 'REVOKED',
        revokedAt: new Date(),
        revocationReason: reason || null,
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'ALUMNI_PROFILE_REVOKED',
        entityType: 'AlumniProfile',
        entityId: alumniId,
        metadata: {
          alumniIndexNumber: existing.alumniIndexNumber,
          reason,
        },
      },
    });

    return updated;
  });
}

/**
 * 10. SEARCH GLOBAL ALUMNI DIRECTORY (Cross-Tenant Authenticated)
 * Strict Privacy: Never queries or returns guardian names, phones, addresses, or disciplinary records.
 */
export async function searchGlobalDirectory(requestingMadrasaId, query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(20, Math.max(1, parseInt(query.limit, 10) || 12)); // Hard capped at 20
  const skip = (page - 1) * limit;

  // Normalize leading/trailing spaces and letter casing safely
  const rawIndex = (query.indexNumber || query.alumniIndexNumber || query.q || '').trim();

  // If no index number is provided, return empty results immediately (prevents enumeration / listing all profiles)
  if (!rawIndex) {
    return {
      data: [],
      items: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const normalizedIndexNumber = rawIndex.toUpperCase();

  // Strict baseline filter: Only published profiles with active consent, matching exact Alumni Index Number
  const where = {
    publicationStatus: 'PUBLISHED',
    consentStatus: 'GRANTED',
    alumniIndexNumber: normalizedIndexNumber,
  };

  const [total, items] = await Promise.all([
    prisma.alumniProfile.count({ where }),
    prisma.alumniProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { leavingDate: 'desc' },
      select: {
        id: true,
        alumniIndexNumber: true,
        admissionDate: true,
        leavingDate: true,
        completedProgrammes: true,
        characterAssessmentRating: true,
        allowPublicConductShare: true,
        madrasa: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            logoFileId: true,
          },
        },
        student: {
          select: {
            id: true,
            fullName: true,
            photoFileId: true,
            qualifications: {
              where: { verificationStatus: 'VERIFIED', deletedAt: null },
              select: {
                id: true,
                title: true,
                category: true,
                achievedDate: true,
                gradeOrScore: true,
              },
            },
          },
        },
      },
    }),
  ]);

  // Resolve safe photos
  const results = await Promise.all(
    items.map(async (item) => {
      let photoUrl = null;
      if (item.student.photoFileId) {
        try {
          const f = await prisma.fileObject.findUnique({
            where: { id: item.student.photoFileId },
            select: { objectKey: true, publicUrl: true },
          });
          if (f) photoUrl = f.publicUrl || (await resolveObjectAccessUrl(f.objectKey));
        } catch {
          photoUrl = null;
        }
      }

      let madrasaLogoUrl = null;
      if (item.madrasa.logoFileId) {
        try {
          const f = await prisma.fileObject.findUnique({
            where: { id: item.madrasa.logoFileId },
            select: { objectKey: true, publicUrl: true },
          });
          if (f) madrasaLogoUrl = f.publicUrl || (await resolveObjectAccessUrl(f.objectKey));
        } catch {
          madrasaLogoUrl = null;
        }
      }

      const featuredQualifications = item.student.qualifications.slice(0, 3).map((q) => ({
        title: q.title,
        category: q.category,
        completionYear: q.achievedDate ? new Date(q.achievedDate).getFullYear() : null,
      }));

      // Tier 1 & Tier 3 payload (Strictly zero Tier 0 guardian/contact/incident fields)
      return {
        id: item.id,
        alumniIndexNumber: item.alumniIndexNumber,
        studentName: item.student.fullName,
        fullName: item.student.fullName,
        photoUrl,
        admissionDate: formatDateOnly(item.admissionDate),
        leavingDate: formatDateOnly(item.leavingDate),
        leavingYear: item.leavingDate ? new Date(item.leavingDate).getFullYear() : null,
        completedProgrammes: item.completedProgrammes || [],
        qualificationsCount: item.student.qualifications.length,
        verifiedQualificationsCount: item.student.qualifications.length,
        featuredQualifications,
        topQualifications: featuredQualifications,
        hasVerifiedCertificates: item.student.qualifications.some((q) => Boolean(q.certificateFileId)),
        characterAssessmentRating: item.allowPublicConductShare
          ? item.characterAssessmentRating
          : null, // Gated Tier 3
        madrasaName: item.madrasa.name,
        madrasaCode: item.madrasa.code,
        issuingMadrasa: {
          id: item.madrasa.id,
          name: item.madrasa.name,
          code: item.madrasa.code,
          logoUrl: madrasaLogoUrl,
        },
      };
    })
  );

  return {
    data: results,
    items: results,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 11. GET GLOBAL ALUMNI PROFILE (Full Authorized View)
 * Audit logged upon access.
 */
export async function getGlobalAlumniProfile(requestingUser, alumniIndexNumber) {
  const normalizedIndexNumber = (alumniIndexNumber || '').trim().toUpperCase();
  const alumni = await prisma.alumniProfile.findUnique({
    where: { alumniIndexNumber: normalizedIndexNumber },
    include: {
      madrasa: {
        select: {
          id: true,
          name: true,
          code: true,
          email: true,
          phone: true,
          address: true,
          logoFileId: true,
        },
      },
      student: {
        select: {
          id: true,
          fullName: true,
          photoFileId: true,
          qualifications: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              category: true,
              recordType: true,
              issuingAuthority: true,
              certificateNumber: true,
              progressStatus: true,
              verificationStatus: true,
              achievedDate: true,
              gradeOrScore: true,
              certificateFileId: true,
            },
            orderBy: { achievedDate: 'desc' },
          },
        },
      },
    },
  });

  if (!alumni) {
    throw new NotFoundError('Alumni profile not found.');
  }

  // Cross-tenant access requires published status and active consent
  const isOwnerMadrasa = requestingUser.madrasaId === alumni.madrasaId;
  const isSuperAdmin = requestingUser.role === 'SUPER_ADMIN';

  if (!isOwnerMadrasa && !isSuperAdmin) {
    if (alumni.publicationStatus !== 'PUBLISHED' || alumni.consentStatus !== 'GRANTED') {
      throw new NotFoundError('Alumni profile not found or is currently unpublished.');
    }
  }

  // Check if an approved verification exists for this requesting madrasa
  let hasApprovedVerification = false;
  if (!isOwnerMadrasa && requestingUser.madrasaId) {
    const verifiedReq = await prisma.alumniVerificationRequest.findFirst({
      where: {
        alumniProfileId: alumni.id,
        targetMadrasaId: alumni.madrasaId,
        requestingMadrasaId: requestingUser.madrasaId,
        status: 'APPROVED_VERIFIED',
      },
      select: { id: true },
    });
    hasApprovedVerification = Boolean(verifiedReq);
  }

  // Audit log profile lookup
  await prisma.activityLog.create({
    data: {
      madrasaId: requestingUser.madrasaId || alumni.madrasaId,
      userId: requestingUser.id,
      action: 'ALUMNI_PROFILE_VIEWED',
      entityType: 'AlumniProfile',
      entityId: alumni.id,
      metadata: {
        alumniIndexNumber: alumni.alumniIndexNumber,
        issuingMadrasaId: alumni.madrasaId,
        isCrossTenant: !isOwnerMadrasa,
      },
    },
  });

  let photoUrl = null;
  if (alumni.student.photoFileId) {
    try {
      const f = await prisma.fileObject.findUnique({
        where: { id: alumni.student.photoFileId },
        select: { objectKey: true, publicUrl: true },
      });
      if (f) photoUrl = f.publicUrl || (await resolveObjectAccessUrl(f.objectKey));
    } catch {
      photoUrl = null;
    }
  }

  let madrasaLogoUrl = null;
  if (alumni.madrasa.logoFileId) {
    try {
      const f = await prisma.fileObject.findUnique({
        where: { id: alumni.madrasa.logoFileId },
        select: { objectKey: true, publicUrl: true },
      });
      if (f) madrasaLogoUrl = f.publicUrl || (await resolveObjectAccessUrl(f.objectKey));
    } catch {
      madrasaLogoUrl = null;
    }
  }

  // Tier 3 Evaluation gating
  const showCharacterAssessment =
    isOwnerMadrasa || isSuperAdmin || alumni.allowPublicConductShare || hasApprovedVerification;

  // Compute verification access status for requesting madrasa
  let verificationAccessStatus = 'NONE';
  if (isOwnerMadrasa) {
    verificationAccessStatus = 'OWNER';
  } else if (hasApprovedVerification) {
    verificationAccessStatus = 'APPROVED';
  } else if (requestingUser.madrasaId) {
    const pendingReq = await prisma.alumniVerificationRequest.findFirst({
      where: {
        alumniProfileId: alumni.id,
        targetMadrasaId: alumni.madrasaId,
        requestingMadrasaId: requestingUser.madrasaId,
        status: 'PENDING',
      },
      select: { id: true },
    });
    if (pendingReq) {
      verificationAccessStatus = 'PENDING';
    }
  }

  const madrasaPayload = {
    id: alumni.madrasa.id,
    name: alumni.madrasa.name,
    code: alumni.madrasa.code,
    email: alumni.madrasa.email,
    phone: alumni.madrasa.phone,
    address: alumni.madrasa.address,
    city: alumni.madrasa.address ? alumni.madrasa.address.split(',').pop()?.trim() : null,
    logoUrl: madrasaLogoUrl,
  };

  const admissionYear = alumni.admissionDate ? new Date(alumni.admissionDate).getFullYear() : null;
  const leavingYear = alumni.leavingDate ? new Date(alumni.leavingDate).getFullYear() : null;

  return {
    id: alumni.id,
    alumniIndexNumber: alumni.alumniIndexNumber,
    studentName: alumni.student.fullName,
    fullName: alumni.student.fullName,
    photoUrl,
    admissionDate: formatDateOnly(alumni.admissionDate),
    leavingDate: formatDateOnly(alumni.leavingDate),
    admissionYear,
    leavingYear,
    leavingReason: alumni.leavingReason,
    completedProgrammes: alumni.completedProgrammes || [],
    academicHighlights: alumni.academicHighlights || [],
    characterAssessment: showCharacterAssessment && alumni.characterAssessmentRating
      ? {
          rating: alumni.characterAssessmentRating,
          conductRating: alumni.characterAssessmentRating,
          remarks: alumni.characterAssessmentText,
          officialNotes: alumni.characterAssessmentText,
          assessedByAuthority: Boolean(alumni.characterAssessmentRating),
        }
      : null,
    issuingMadrasa: madrasaPayload,
    madrasa: madrasaPayload,
    qualifications: alumni.student.qualifications.map((q) => ({
      id: q.id,
      title: q.title,
      category: q.category,
      recordType: q.recordType,
      issuingAuthority: q.issuingAuthority,
      certificateNumber: q.certificateNumber,
      progressStatus: q.progressStatus,
      verificationStatus: q.verificationStatus,
      achievedDate: formatDateOnly(q.achievedDate),
      completionYear: q.achievedDate ? new Date(q.achievedDate).getFullYear() : null,
      gradeOrScore: q.gradeOrScore,
      hasCertificateDocument: Boolean(q.certificateFileId),
      hasCertificateFile: Boolean(q.certificateFileId),
      // Can access raw document stream if owner or has approved verification
      canStreamCertificate: isOwnerMadrasa || isSuperAdmin || hasApprovedVerification,
    })),
    hasApprovedVerification,
    verificationAccessStatus,
    publishedAt: alumni.publishedAt,
  };
}

/**
 * 12. CREATE VERIFICATION REQUEST (Inquiring Madrasa -> Issuing Madrasa)
 */
export async function createVerificationRequest(requestingMadrasaId, requestingUserId, alumniIndexNumber, data) {
  const alumni = await prisma.alumniProfile.findUnique({
    where: { alumniIndexNumber },
    select: { id: true, madrasaId: true, publicationStatus: true, consentStatus: true },
  });

  if (!alumni) {
    throw new NotFoundError('Alumni profile not found.');
  }

  if (alumni.publicationStatus !== 'PUBLISHED' || alumni.consentStatus !== 'GRANTED') {
    throw new BadRequestError('Cannot request verification: This alumni profile is not published with active consent.');
  }

  // Anti-collusion guard: Institution cannot request verification for its own alumni
  if (alumni.madrasaId === requestingMadrasaId) {
    throw new BadRequestError('You cannot request verification for an alumni record belonging to your own institution.');
  }

  // Check for existing pending request
  const existingPending = await prisma.alumniVerificationRequest.findFirst({
    where: {
      alumniProfileId: alumni.id,
      targetMadrasaId: alumni.madrasaId,
      requestingMadrasaId,
      status: 'PENDING',
    },
  });

  if (existingPending) {
    throw new ConflictError('A pending verification request already exists for this alumni record.');
  }

  return await prisma.$transaction(async (tx) => {
    const request = await tx.alumniVerificationRequest.create({
      data: {
        alumniProfileId: alumni.id,
        targetMadrasaId: alumni.madrasaId,
        requestingMadrasaId,
        requestedByUserId: requestingUserId,
        purpose: data.purpose,
        specificInquiry: data.specificInquiry || null,
        includeCharacter: Boolean(data.includeCharacter),
        status: 'PENDING',
      },
      include: {
        targetMadrasa: { select: { id: true, name: true, code: true } },
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId: requestingMadrasaId,
        userId: requestingUserId,
        action: 'ALUMNI_VERIFICATION_REQUESTED',
        entityType: 'AlumniVerificationRequest',
        entityId: request.id,
        metadata: {
          alumniIndexNumber,
          targetMadrasaId: alumni.madrasaId,
          purpose: data.purpose,
        },
      },
    });

    return request;
  });
}

/**
 * 13. LIST INCOMING VERIFICATION REQUESTS (Issuing Madrasa Inbox)
 */
export async function listIncomingVerificationRequests(madrasaId, query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const where = { targetMadrasaId: madrasaId };
  if (query.status) {
    where.status = query.status;
  }

  const [total, items] = await Promise.all([
    prisma.alumniVerificationRequest.count({ where }),
    prisma.alumniVerificationRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        requestingMadrasa: { select: { id: true, name: true, code: true } },
        requestedByUser: { select: { id: true, name: true, email: true } },
        alumniProfile: {
          select: {
            id: true,
            alumniIndexNumber: true,
            student: { select: { fullName: true } },
          },
        },
      },
    }),
  ]);

  const mapped = items.map((r) => ({
    id: r.id,
    alumniIndexNumber: r.alumniProfile.alumniIndexNumber,
    studentName: r.alumniProfile.student.fullName,
    requestingMadrasaName: r.requestingMadrasa.name,
    requestingMadrasaCode: r.requestingMadrasa.code,
    requestedByName: r.requestedByUser.name,
    purpose: r.purpose,
    specificInquiry: r.specificInquiry,
    includeCharacter: r.includeCharacter,
    status: r.status,
    responseNotes: r.responseNotes,
    createdAt: r.createdAt,
    respondedAt: r.respondedAt,
  }));

  return {
    data: mapped,
    items: mapped,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 14. LIST OUTGOING VERIFICATION REQUESTS (Inquiring Madrasa Tracking)
 */
export async function listOutgoingVerificationRequests(madrasaId, query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const where = { requestingMadrasaId: madrasaId };
  if (query.status) {
    where.status = query.status;
  }

  const [total, items] = await Promise.all([
    prisma.alumniVerificationRequest.count({ where }),
    prisma.alumniVerificationRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        targetMadrasa: { select: { id: true, name: true, code: true } },
        alumniProfile: {
          select: {
            id: true,
            alumniIndexNumber: true,
            student: { select: { fullName: true } },
          },
        },
      },
    }),
  ]);

  const mapped = items.map((r) => ({
    id: r.id,
    alumniIndexNumber: r.alumniProfile.alumniIndexNumber,
    studentName: r.alumniProfile.student.fullName,
    targetMadrasaName: r.targetMadrasa.name,
    targetMadrasaCode: r.targetMadrasa.code,
    purpose: r.purpose,
    specificInquiry: r.specificInquiry,
    includeCharacter: r.includeCharacter,
    status: r.status,
    responseNotes: r.responseNotes,
    createdAt: r.createdAt,
    respondedAt: r.respondedAt,
  }));

  return {
    data: mapped,
    items: mapped,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 15. RESPOND TO VERIFICATION REQUEST (Original Issuing Madrasa Admin Only)
 */
export async function respondToVerificationRequest(madrasaId, requestId, data, userId) {
  const request = await prisma.alumniVerificationRequest.findFirst({
    where: { id: requestId, targetMadrasaId: madrasaId },
  });

  if (!request) {
    throw new NotFoundError('Verification request not found.');
  }

  const newStatus =
    data.status ||
    (data.action === 'APPROVE'
      ? 'APPROVED_VERIFIED'
      : data.action === 'REJECT'
      ? 'REJECTED'
      : 'REJECTED');

  const notes = data.responseNotes || data.notes || null;

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.alumniVerificationRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        responseNotes: notes,
        respondedByUserId: userId,
        respondedAt: new Date(),
      },
    });

    await tx.activityLog.create({
      data: {
        madrasaId,
        userId,
        action: 'ALUMNI_VERIFICATION_RESOLVED',
        entityType: 'AlumniVerificationRequest',
        entityId: requestId,
        metadata: {
          status: data.status,
          requestingMadrasaId: request.requestingMadrasaId,
        },
      },
    });

    return updated;
  });
}

/**
 * 16. STREAM ALUMNI CERTIFICATE DOCUMENT (Enforces all 5 security checks)
 */
export async function getAlumniCertificateStream(user, alumniId, qualificationId) {
  if (!user) {
    throw new ForbiddenError('Authentication required.');
  }

  // 1. Fetch Alumni Profile & exact StudentQualification
  const alumni = await prisma.alumniProfile.findUnique({
    where: { id: alumniId },
    include: {
      student: {
        select: {
          id: true,
          madrasaId: true,
          qualifications: {
            where: { id: qualificationId, deletedAt: null },
            include: {
              certificateFile: true,
            },
          },
        },
      },
    },
  });

  if (!alumni) {
    throw new NotFoundError('Alumni profile not found.');
  }

  const qualification = alumni.student.qualifications[0];
  if (!qualification || !qualification.certificateFileId || !qualification.certificateFile) {
    throw new NotFoundError('Certificate document not found on this profile.');
  }

  const file = qualification.certificateFile;

  // 2. Strict Document-to-Student-to-Tenant Binding
  if (
    qualification.madrasaId !== alumni.madrasaId ||
    qualification.studentId !== alumni.studentId ||
    (file.madrasaId && file.madrasaId !== alumni.madrasaId) ||
    file.id !== qualification.certificateFileId
  ) {
    throw new ForbiddenError('Security Violation: Document does not match alumni identity or issuing madrasa.');
  }

  // 3. Authorization Branching
  if (user.role === 'SUPER_ADMIN') {
    // Platform Audit access permitted
  } else if (user.role === 'MADRASA_ADMIN') {
    const isIssuingAdmin = user.madrasaId === alumni.madrasaId;

    if (isIssuingAdmin) {
      // Direct Owner Access
    } else {
      // Cross-Tenant Access: Enforce active consent, publication, and approved verification
      if (alumni.consentStatus !== 'GRANTED') {
        throw new ForbiddenError('Access Denied: Student/guardian consent is not active or has been withdrawn.');
      }

      if (alumni.publicationStatus !== 'PUBLISHED') {
        throw new ForbiddenError('Access Denied: Alumni profile is not published to the Global Directory.');
      }

      if (qualification.verificationStatus !== 'VERIFIED') {
        throw new ForbiddenError('Access Denied: Only institutionally verified certificates are accessible cross-tenant.');
      }

      // Enforce approved verification request
      const approvedVerification = await prisma.alumniVerificationRequest.findFirst({
        where: {
          alumniProfileId: alumni.id,
          targetMadrasaId: alumni.madrasaId,
          requestingMadrasaId: user.madrasaId,
          status: 'APPROVED_VERIFIED',
        },
        select: { id: true },
      });

      if (!approvedVerification) {
        throw new ForbiddenError(
          'Cross-tenant document access requires an approved academic verification request from the issuing institution.'
        );
      }
    }
  } else {
    throw new ForbiddenError('Insufficient permissions.');
  }

  // 4. Resolve stream
  const stream = await getStudentDocumentStream(file.objectKey);

  // 5. Audit Log
  await prisma.activityLog.create({
    data: {
      madrasaId: user.madrasaId || alumni.madrasaId,
      userId: user.id,
      action: 'ALUMNI_CERTIFICATE_ACCESSED',
      entityType: 'StudentQualification',
      entityId: qualification.id,
      metadata: {
        alumniIndexNumber: alumni.alumniIndexNumber,
        issuingMadrasaId: alumni.madrasaId,
        isCrossTenant: user.madrasaId !== alumni.madrasaId,
      },
    },
  });

  return {
    stream,
    mimeType: file.mimeType || 'application/pdf',
    originalName: file.originalName || 'certificate.pdf',
  };
}

/**
 * 18. LIST ELIGIBLE STUDENTS (Students without existing Alumni Profile)
 */
export async function listEligibleStudents(madrasaId, search = '') {
  const where = {
    madrasaId,
    alumniProfile: null,
  };

  if (search && search.trim().length > 0) {
    const s = search.trim();
    where.OR = [
      { fullName: { contains: s } },
      { admissionNo: { contains: s } },
    ];
  }

  const students = await prisma.student.findMany({
    where,
    select: {
      id: true,
      admissionNo: true,
      fullName: true,
      status: true,
      admissionDate: true,
      class: {
        select: { name: true },
      },
      qualifications: {
        where: { verificationStatus: 'VERIFIED' },
        select: { id: true, title: true, category: true, achievedDate: true },
      },
    },
    orderBy: { fullName: 'asc' },
    take: 100,
  });

  return students.map((s) => ({
    id: s.id,
    admissionNo: s.admissionNo,
    admissionNumber: s.admissionNo,
    fullName: s.fullName,
    status: s.status,
    admissionDate: s.admissionDate,
    className: s.class?.name || null,
    qualificationsCount: s.qualifications?.length || 0,
    displayName: `${s.fullName} (${s.admissionNo}) – ${s.status}${s.class?.name ? ` [${s.class.name}]` : ''}`,
  }));
}
