import sharp from 'sharp';
import prisma from '../lib/prisma.js';
import {
  buildMadrasaKey,
  uploadBufferToR2,
  resolveObjectAccessUrl,
  getR2PublicUrl,
} from './r2.service.js';
import { isR2Configured } from '../config/r2.js';
import { generateInitials } from './branding.service.js';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  AppError,
} from '../utils/errors.js';
import { logTenantActivity } from './tenant.service.js';
import { DEFAULT_THEME_TOKENS } from './madrasa-theme.service.js';
import { buildAdmissionEmailTemplate } from './admission-email.service.js';


const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Generates an applicant reference number (e.g. APP-2026-84920).
 */
async function generateUniqueApplicationNo(madrasaId, academicYear) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const candidateNo = `APP-${academicYear}-${randomDigits}`;

    const existing = await prisma.studentApplication.findFirst({
      where: { madrasaId, applicationNo: candidateNo },
      select: { id: true },
    });

    if (!existing) {
      return candidateNo;
    }
  }
  // Fallback timestamp-based suffix
  return `APP-${academicYear}-${Date.now().toString().slice(-6)}`;
}

/**
 * Public Endpoint: Fetches active admission intake periods and active classes for a madrasa.
 */
export async function getPublicAdmissionsData(slug) {
  if (!slug || typeof slug !== 'string') {
    throw new NotFoundError('Invalid madrasa slug.');
  }

  const madrasa = await prisma.madrasa.findUnique({
    where: { slug },
    include: {
      profile: true,
      admissionPeriods: {
        where: { isOpen: true },
        orderBy: { startDate: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          academicYear: true,
          startDate: true,
          endDate: true,
          isOpen: true,
          instructions: true,
          capacity: true,
        },
      },
      classes: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          academicSection: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!madrasa || madrasa.status !== 'ACTIVE') {
    throw new NotFoundError('Madrasa not found or is currently inactive.');
  }

  if (!madrasa.profile || !madrasa.profile.isPublished) {
    throw new NotFoundError('Madrasa portal has not been published yet.');
  }

  let logoUrl = null;
  if (madrasa.logoFileId) {
    const logoFile = await prisma.fileObject.findFirst({
      where: {
        id: madrasa.logoFileId,
        madrasaId: madrasa.id,
        type: 'MADRASA_LOGO',
      },
    });
    if (logoFile) {
      logoUrl = await resolveObjectAccessUrl(logoFile.objectKey);
    }
  }

  let heroImageUrl = null;
  if (madrasa.profile.heroImageFileId) {
    const heroFile = await prisma.fileObject.findFirst({
      where: {
        id: madrasa.profile.heroImageFileId,
        madrasaId: madrasa.id,
        type: 'MADRASA_HERO_IMAGE',
      },
    });
    if (heroFile) {
      heroImageUrl = await resolveObjectAccessUrl(heroFile.objectKey);
    }
  }

  return {
    madrasa: {
      id: madrasa.id,
      name: madrasa.name,
      code: madrasa.code,
      slug: madrasa.slug,
      logoUrl,
      initials: generateInitials(madrasa.name),
      contactPhone: madrasa.profile.contactPhone || madrasa.phone,
      contactEmail: madrasa.profile.contactEmail || madrasa.email,
    },
    heroTitle: madrasa.profile.heroTitle,
    heroSubtitle: madrasa.profile.heroSubtitle,
    heroImageUrl,
    theme: madrasa.profile.themePublishedJson || DEFAULT_THEME_TOKENS,
    activeAdmissionPeriods: madrasa.admissionPeriods,
    availableClasses: madrasa.classes,
  };
}

/**
 * Public Endpoint: Uploads a supporting document for an application.
 */
export async function uploadApplicationDocument(slug, fileBuffer, originalName, mimeType) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new BadRequestError('No file provided. Please upload a valid document or image.');
  }

  if (fileBuffer.length > MAX_DOC_SIZE) {
    throw new BadRequestError('Document must be smaller than 5 MB.');
  }

  const madrasa = await prisma.madrasa.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });

  if (!madrasa || madrasa.status !== 'ACTIVE') {
    throw new NotFoundError('Madrasa not found or is currently inactive.');
  }

  // Reject SVG strictly
  const nameLower = (originalName || '').toLowerCase();
  const bufferPrefix = fileBuffer.slice(0, 100).toString('utf8').toLowerCase();
  if (nameLower.endsWith('.svg') || bufferPrefix.includes('<svg') || bufferPrefix.includes('<?xml')) {
    throw new BadRequestError('SVG files are not permitted for security reasons.');
  }

  // Validate MIME and content
  let detectedMime = mimeType;
  let extension = 'bin';

  if (fileBuffer.slice(0, 4).toString() === '%PDF') {
    detectedMime = 'application/pdf';
    extension = 'pdf';
  } else {
    try {
      const probe = sharp(fileBuffer, { limitInputPixels: 16777216, failOnError: true });
      const meta = await probe.metadata();
      if (meta.format === 'svg') {
        throw new BadRequestError('SVG files are not permitted for security reasons.');
      }
      if (meta.format === 'jpeg') {
        detectedMime = 'image/jpeg';
        extension = 'jpg';
      } else if (meta.format === 'png') {
        detectedMime = 'image/png';
        extension = 'png';
      } else if (meta.format === 'webp') {
        detectedMime = 'image/webp';
        extension = 'webp';
      } else {
        throw new BadRequestError('Unsupported image format. Allowed formats: PDF, JPG, PNG, WebP.');
      }
    } catch (imgErr) {
      if (detectedMime !== 'application/pdf') {
        throw new BadRequestError('Corrupt or invalid document. Please upload a valid PDF, JPG, PNG, or WebP file.');
      }
    }
  }

  if (!ALLOWED_DOC_MIMES.has(detectedMime)) {
    throw new BadRequestError('Unsupported document format. Allowed formats: PDF, JPG, PNG, WebP.');
  }

  const uniqueId = `app_doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const objectKey = buildMadrasaKey(madrasa.id, 'documents', `${uniqueId}.${extension}`);

  try {
    await uploadBufferToR2(objectKey, fileBuffer, detectedMime);
  } catch (storageErr) {
    console.error('[AdmissionService] Document storage upload failed:', storageErr.message);
    if (!isR2Configured()) {
      throw new AppError('File storage is not configured.', 500);
    }
    throw new AppError('File storage service is currently unavailable.', 500);
  }

  const fileRecord = await prisma.fileObject.create({
    data: {
      madrasaId: madrasa.id,
      type: 'STUDENT_DOCUMENT',
      objectKey,
      originalName: originalName ? originalName.slice(0, 100) : `document.${extension}`,
      mimeType: detectedMime,
      size: fileBuffer.length,
      publicUrl: getR2PublicUrl(objectKey) || null,
    },
  });

  const fileUrl = await resolveObjectAccessUrl(objectKey);

  return {
    fileId: fileRecord.id,
    objectKey,
    fileUrl,
    name: fileRecord.originalName,
    originalName: fileRecord.originalName,
    mimeType: detectedMime,
    size: fileBuffer.length,
  };
}

/**
 * Public Endpoint: Submits an online admission application.
 */
export async function submitPublicApplication(slug, data) {
  const madrasa = await prisma.madrasa.findUnique({
    where: { slug },
    include: {
      profile: true,
    },
  });

  if (!madrasa || madrasa.status !== 'ACTIVE') {
    throw new NotFoundError('Madrasa not found or is currently inactive.');
  }

  if (!madrasa.profile || !madrasa.profile.isPublished) {
    throw new NotFoundError('Madrasa portal has not been published yet.');
  }

  const period = await prisma.admissionPeriod.findFirst({
    where: {
      id: data.admissionPeriodId,
      madrasaId: madrasa.id,
    },
  });

  if (!period) {
    throw new NotFoundError('Selected admission intake period was not found for this madrasa.');
  }

  if (!period.isOpen) {
    throw new BadRequestError('This admission intake period is currently closed for new applications.');
  }

  // Check capacity if set
  if (period.capacity && period.capacity > 0) {
    const activeCount = await prisma.studentApplication.count({
      where: {
        madrasaId: madrasa.id,
        admissionPeriodId: period.id,
        status: { in: ['PENDING', 'APPROVED', 'CONVERTED'] },
      },
    });

    if (activeCount >= period.capacity) {
      throw new BadRequestError('This admission intake period has reached maximum application capacity.');
    }
  }

  // Validate applied class if provided
  let appliedClass = null;
  if (data.appliedClassId) {
    appliedClass = await prisma.class.findFirst({
      where: {
        id: data.appliedClassId,
        madrasaId: madrasa.id,
        isActive: true,
      },
    });
    if (!appliedClass) {
      throw new BadRequestError('Selected class is invalid or currently inactive.');
    }
  }

  // Duplicate Prevention: Check identical applicant name and DOB in same period
  const dob = new Date(data.dateOfBirth);
  const normalizedName = data.applicantName.trim().toLowerCase();

  const existingDuplicate = await prisma.studentApplication.findFirst({
    where: {
      madrasaId: madrasa.id,
      admissionPeriodId: period.id,
      dateOfBirth: dob,
      applicantName: {
        equals: data.applicantName.trim(),
      },
      status: { in: ['PENDING', 'APPROVED', 'CONVERTED'] },
    },
  });

  if (existingDuplicate) {
    throw new ConflictError(
      `An application for "${data.applicantName}" has already been submitted for this intake (Reference: ${existingDuplicate.applicationNo}).`
    );
  }

  // Generate unique application number
  const applicationNo = await generateUniqueApplicationNo(madrasa.id, period.academicYear);

  // Filter and associate valid documents
  const validatedDocs = Array.isArray(data.documents) ? data.documents : [];

  const application = await prisma.studentApplication.create({
    data: {
      madrasaId: madrasa.id,
      admissionPeriodId: period.id,
      applicationNo,
      applicantName: data.applicantName.trim(),
      dateOfBirth: dob,
      gender: data.gender,
      guardianName: data.guardianName.trim(),
      guardianRelationship: data.guardianRelationship.trim(),
      guardianPhone: data.guardianPhone.trim(),
      guardianEmail: data.guardianEmail || null,
      address: data.address.trim(),
      appliedClassId: appliedClass ? appliedClass.id : null,
      previousSchool: data.previousSchool || null,
      documentsJson: validatedDocs,
      status: 'PENDING',
    },
    include: {
      admissionPeriod: {
        select: {
          id: true,
          name: true,
          code: true,
          academicYear: true,
        },
      },
      appliedClass: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  // Queue acknowledgment notification to applicant/guardian (EMAIL ONLY per strict admissions policy)
  const now = new Date();
  if (data.guardianEmail && data.guardianEmail.trim()) {
    try {
      let logoUrl = null;
      if (madrasa.logoFileId) {
        const logoFile = await prisma.fileObject.findFirst({
          where: { id: madrasa.logoFileId, madrasaId: madrasa.id },
        });
        if (logoFile) {
          logoUrl = await resolveObjectAccessUrl(logoFile.objectKey);
        }
      }

      const emailData = buildAdmissionEmailTemplate({
        subType: 'SUBMITTED',
        madrasaName: madrasa.name,
        logoUrl,
        recipientName: data.guardianName.trim(),
        applicantName: data.applicantName.trim(),
        applicationNo,
        intakeName: period.name,
        academicYear: period.academicYear,
        className: appliedClass ? appliedClass.name : '',
        status: 'PENDING',
        submittedAt: now,
        contactPhone: madrasa.profile?.contactPhone || madrasa.phone,
        contactEmail: madrasa.profile?.contactEmail || madrasa.email,
        address: madrasa.profile?.address || madrasa.address,
      });

      await prisma.notificationJob.create({
        data: {
          madrasaId: madrasa.id,
          channel: 'EMAIL',
          eventType: 'APPLICATION_STATUS_UPDATE',
          recipientType: 'GUARDIAN',
          recipientEntityId: application.id,
          recipientAddress: data.guardianEmail.trim(),
          recipientName: data.guardianName.trim(),
          subject: emailData.subject,
          message: emailData.html,
          payloadJson: {
            applicationId: application.id,
            applicationNo,
            applicantName: data.applicantName.trim(),
            guardianName: data.guardianName.trim(),
            intakeName: period.name,
            academicYear: period.academicYear,
            className: appliedClass ? appliedClass.name : null,
            status: 'PENDING',
            subType: 'SUBMITTED',
            submittedAt: now.toISOString(),
            textMessage: emailData.text,
          },
          relatedEntityType: 'StudentApplication',
          relatedEntityId: application.id,
          dedupeKey: `APPLICATION_SUBMITTED:${application.id}:EMAIL`,
          status: 'PENDING',
          nextAttemptAt: now,
        },
      });
    } catch (err) {
      console.warn('[AdmissionService] Email ACK creation failed:', err.message);
    }
  }

  return {
    id: application.id,
    applicationNo: application.applicationNo,
    applicantName: application.applicantName,
    intakeName: period.name,
    academicYear: period.academicYear,
    appliedClassName: appliedClass ? appliedClass.name : null,
    submittedAt: application.submittedAt,
    madrasaName: madrasa.name,
  };
}

/**
 * Admin: Lists all admission intake periods for a tenant madrasa.
 */
export async function listAdmissionPeriods(madrasaId) {
  const periods = await prisma.admissionPeriod.findMany({
    where: { madrasaId },
    orderBy: [{ academicYear: 'desc' }, { startDate: 'desc' }],
    include: {
      _count: {
        select: {
          applications: true,
        },
      },
    },
  });

  return periods.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    academicYear: p.academicYear,
    startDate: p.startDate,
    endDate: p.endDate,
    isOpen: p.isOpen,
    instructions: p.instructions,
    capacity: p.capacity,
    totalApplications: p._count.applications,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

/**
 * Admin: Creates a new admission intake period.
 */
export async function createAdmissionPeriod(madrasaId, data, userId = null) {
  const code = data.code.trim().toUpperCase();

  const existingCode = await prisma.admissionPeriod.findFirst({
    where: {
      madrasaId,
      academicYear: data.academicYear,
      code,
    },
  });

  if (existingCode) {
    throw new ConflictError(
      `An intake period with code "${code}" already exists for academic year ${data.academicYear}.`
    );
  }

  const period = await prisma.admissionPeriod.create({
    data: {
      madrasaId,
      code,
      name: data.name.trim(),
      academicYear: data.academicYear,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      isOpen: data.isOpen !== undefined ? data.isOpen : true,
      instructions: data.instructions ? data.instructions.trim() : null,
      capacity: data.capacity || null,
    },
  });

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'CREATE_ADMISSION_PERIOD',
      details: `Created admission period "${period.name}" (${period.code}) for year ${period.academicYear}.`,
    });
  }

  return period;
}

/**
 * Admin: Toggles intake period open/closed status.
 */
export async function toggleAdmissionPeriod(madrasaId, periodId, userId = null) {
  const period = await prisma.admissionPeriod.findFirst({
    where: { id: periodId, madrasaId },
  });

  if (!period) {
    throw new NotFoundError('Admission period not found.');
  }

  const updated = await prisma.admissionPeriod.update({
    where: { id: period.id },
    data: {
      isOpen: !period.isOpen,
    },
  });

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'TOGGLE_ADMISSION_PERIOD',
      details: `Admission period "${period.name}" is now ${updated.isOpen ? 'OPEN' : 'CLOSED'}.`,
    });
  }

  return updated;
}

/**
 * Admin: Lists student applications with status filtering, search, and pagination.
 */
export async function listApplications(madrasaId, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const skip = (page - 1) * pageSize;

  const where = { madrasaId };

  if (query.status && query.status !== 'ALL') {
    where.status = query.status;
  }

  if (query.admissionPeriodId && query.admissionPeriodId !== 'ALL') {
    where.admissionPeriodId = query.admissionPeriodId;
  }

  if (query.search && query.search.trim()) {
    const s = query.search.trim();
    where.OR = [
      { applicationNo: { contains: s } },
      { applicantName: { contains: s } },
      { guardianName: { contains: s } },
      { guardianPhone: { contains: s } },
      { guardianEmail: { contains: s } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.studentApplication.count({ where }),
    prisma.studentApplication.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { submittedAt: 'desc' },
      include: {
        admissionPeriod: {
          select: {
            id: true,
            name: true,
            code: true,
            academicYear: true,
          },
        },
        appliedClass: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        convertedStudent: {
          select: {
            id: true,
            admissionNo: true,
            fullName: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

/**
 * Admin: Fetches full application record with resolved document URLs.
 */
export async function getApplicationById(madrasaId, applicationId) {
  const application = await prisma.studentApplication.findFirst({
    where: { id: applicationId, madrasaId },
    include: {
      admissionPeriod: true,
      appliedClass: true,
      convertedStudent: true,
      reviewedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!application) {
    throw new NotFoundError('Student application not found.');
  }

  // Resolve signed/access URLs for documents
  const rawDocs = Array.isArray(application.documentsJson) ? application.documentsJson : [];
  const resolvedDocs = [];

  for (const doc of rawDocs) {
    let resolvedUrl = doc.fileUrl || null;
    if (doc.fileId) {
      const fileObj = await prisma.fileObject.findFirst({
        where: { id: doc.fileId, madrasaId },
      });
      if (fileObj) {
        resolvedUrl = await resolveObjectAccessUrl(fileObj.objectKey);
      }
    }
    resolvedDocs.push({
      ...doc,
      fileUrl: resolvedUrl,
    });
  }

  return {
    ...application,
    documents: resolvedDocs,
  };
}

/**
 * Admin: Reviews application (updates status to APPROVED or REJECTED with remarks).
 */
export async function reviewApplication(madrasaId, applicationId, data, userId = null) {
  const application = await prisma.studentApplication.findFirst({
    where: { id: applicationId, madrasaId },
    include: {
      admissionPeriod: true,
      appliedClass: true,
      madrasa: {
        include: { profile: true },
      },
    },
  });

  if (!application) {
    throw new NotFoundError('Student application not found.');
  }

  if (application.status === 'CONVERTED') {
    throw new BadRequestError('Cannot change status of an application that has already been converted to an enrolled student.');
  }

  const updated = await prisma.studentApplication.update({
    where: { id: application.id },
    data: {
      status: data.status,
      reviewRemarks: data.reviewRemarks || null,
      reviewedByUserId: userId || null,
      reviewedAt: new Date(),
    },
    include: {
      admissionPeriod: true,
      appliedClass: true,
    },
  });

  if (userId) {
    await logTenantActivity({
      madrasaId,
      userId,
      action: 'REVIEW_STUDENT_APPLICATION',
      details: `Application ${application.applicationNo} (${application.applicantName}) updated to ${data.status}.`,
    });
  }

  // Notification Job to Guardian (EMAIL ONLY per strict admissions policy)
  const now = new Date();
  const isApproved = data.status === 'APPROVED';
  const decisionText = isApproved ? 'APPROVED' : 'REJECTED';

  if (application.guardianEmail) {
    try {
      let logoUrl = null;
      if (application.madrasa?.logoFileId) {
        const logoFile = await prisma.fileObject.findFirst({
          where: { id: application.madrasa.logoFileId, madrasaId },
        });
        if (logoFile) {
          logoUrl = await resolveObjectAccessUrl(logoFile.objectKey);
        }
      }

      const emailData = buildAdmissionEmailTemplate({
        subType: isApproved ? 'APPROVED' : 'REJECTED',
        madrasaName: application.madrasa.name,
        logoUrl,
        recipientName: application.guardianName,
        applicantName: application.applicantName,
        applicationNo: application.applicationNo,
        intakeName: application.admissionPeriod?.name || '',
        academicYear: application.admissionPeriod?.academicYear || '',
        className: application.appliedClass?.name || '',
        status: data.status,
        decisionText,
        remarks: data.reviewRemarks || '',
        submittedAt: application.submittedAt,
        contactPhone: application.madrasa.profile?.contactPhone || application.madrasa.phone,
        contactEmail: application.madrasa.profile?.contactEmail || application.madrasa.email,
        address: application.madrasa.profile?.address || application.madrasa.address,
      });

      await prisma.notificationJob.create({
        data: {
          madrasaId,
          channel: 'EMAIL',
          eventType: 'APPLICATION_STATUS_UPDATE',
          recipientType: 'GUARDIAN',
          recipientEntityId: application.id,
          recipientAddress: application.guardianEmail,
          recipientName: application.guardianName,
          subject: emailData.subject,
          message: emailData.html,
          payloadJson: {
            applicationId: application.id,
            applicationNo: application.applicationNo,
            applicantName: application.applicantName,
            guardianName: application.guardianName,
            intakeName: application.admissionPeriod?.name || null,
            academicYear: application.admissionPeriod?.academicYear || null,
            className: application.appliedClass?.name || null,
            status: data.status,
            subType: isApproved ? 'APPROVED' : 'REJECTED',
            decisionText,
            remarks: data.reviewRemarks,
            textMessage: emailData.text,
          },
          relatedEntityType: 'StudentApplication',
          relatedEntityId: application.id,
          dedupeKey: `APPLICATION_REVIEW:${application.id}:${data.status}:EMAIL`,
          status: 'PENDING',
          nextAttemptAt: now,
        },
      });
    } catch (err) {
      console.warn('[AdmissionService] Email review notification failed:', err.message);
    }
  }

  return updated;
}

/**
 * Admin: Converts an approved application into an active enrolled student.
 * Guarantees zero duplicate conversion and strictly unique admission numbers.
 */
export async function convertApplicationToStudent(madrasaId, applicationId, data, userId = null) {
  const application = await prisma.studentApplication.findFirst({
    where: { id: applicationId, madrasaId },
    include: {
      admissionPeriod: true,
      appliedClass: true,
      madrasa: {
        include: { profile: true },
      },
    },
  });

  if (!application) {
    throw new NotFoundError('Student application not found.');
  }

  if (application.convertedStudentId || application.status === 'CONVERTED') {
    throw new ConflictError('This application has already been converted to an enrolled student.');
  }

  if (application.status !== 'APPROVED') {
    throw new BadRequestError('Only approved applications can be converted to enrolled students.');
  }

  const admissionNo = data.admissionNo.trim();

  // Validate admission number uniqueness within tenant
  const existingStudent = await prisma.student.findFirst({
    where: { madrasaId, admissionNo },
    select: { id: true },
  });

  if (existingStudent) {
    throw new ConflictError(
      `A student with admission number "${admissionNo}" already exists in your madrasa.`
    );
  }

  // Validate class if provided
  const targetClassId = data.classId || application.appliedClassId || null;
  let targetClass = null;
  if (targetClassId) {
    targetClass = await prisma.class.findFirst({
      where: { id: targetClassId, madrasaId, isActive: true },
    });
    if (!targetClass) {
      throw new BadRequestError('Assigned class does not exist or is currently inactive.');
    }
  }

  const admissionDate = data.admissionDate ? new Date(data.admissionDate) : new Date();

  // Execute atomic conversion transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Student
    const student = await tx.student.create({
      data: {
        madrasaId,
        admissionNo,
        fullName: application.applicantName,
        classId: targetClassId,
        guardianName: application.guardianName,
        guardianPhone: application.guardianPhone,
        guardianEmail: application.guardianEmail,
        whatsappNumber: application.guardianPhone,
        whatsappOptIn: true,
        whatsappOptInAt: new Date(),
        address: application.address,
        admissionDate,
        status: 'ACTIVE',
      },
    });

    // 2. Update StudentApplication
    const updatedApplication = await tx.studentApplication.update({
      where: { id: application.id },
      data: {
        status: 'CONVERTED',
        convertedStudentId: student.id,
        convertedAt: new Date(),
        reviewedByUserId: userId || application.reviewedByUserId || null,
      },
    });

    // 3. Activity Log
    await tx.activityLog.create({
      data: {
        madrasaId,
        userId: userId || null,
        action: 'CONVERT_STUDENT_APPLICATION',
        entityType: 'STUDENT',
        entityId: student.id,
        metadata: {
          applicationId: application.id,
          applicationNo: application.applicationNo,
          studentId: student.id,
          admissionNo,
        },
      },
    });

    return { student, updatedApplication };
  });

  // Notification to guardian (EMAIL ONLY per strict admissions policy)
  const now = new Date();
  if (application.guardianEmail && application.guardianEmail.trim()) {
    try {
      let logoUrl = null;
      if (application.madrasa?.logoFileId) {
        const logoFile = await prisma.fileObject.findFirst({
          where: { id: application.madrasa.logoFileId, madrasaId },
        });
        if (logoFile) {
          logoUrl = await resolveObjectAccessUrl(logoFile.objectKey);
        }
      }

      const assignedClassName = targetClass?.name || application.appliedClass?.name || '';
      const emailData = buildAdmissionEmailTemplate({
        subType: 'CONVERTED',
        madrasaName: application.madrasa.name,
        logoUrl,
        recipientName: application.guardianName,
        applicantName: application.applicantName,
        applicationNo: application.applicationNo,
        admissionNo,
        className: assignedClassName,
        intakeName: application.admissionPeriod?.name || '',
        academicYear: application.admissionPeriod?.academicYear || '',
        status: 'CONVERTED',
        contactPhone: application.madrasa.profile?.contactPhone || application.madrasa.phone,
        contactEmail: application.madrasa.profile?.contactEmail || application.madrasa.email,
        address: application.madrasa.profile?.address || application.madrasa.address,
      });

      await prisma.notificationJob.create({
        data: {
          madrasaId,
          channel: 'EMAIL',
          eventType: 'APPLICATION_STATUS_UPDATE',
          recipientType: 'GUARDIAN',
          recipientEntityId: result.student.id,
          recipientAddress: application.guardianEmail.trim(),
          recipientName: application.guardianName,
          subject: emailData.subject,
          message: emailData.html,
          payloadJson: {
            studentId: result.student.id,
            admissionNo,
            applicationNo: application.applicationNo,
            applicantName: application.applicantName,
            guardianName: application.guardianName,
            className: assignedClassName,
            status: 'CONVERTED',
            subType: 'CONVERTED',
            textMessage: emailData.text,
          },
          relatedEntityType: 'Student',
          relatedEntityId: result.student.id,
          dedupeKey: `ENROLLMENT_CONFIRMED:${result.student.id}:EMAIL`,
          status: 'PENDING',
          nextAttemptAt: now,
        },
      });
    } catch (err) {
      console.warn('[AdmissionService] Email enrollment notification failed:', err.message);
    }
  }

  return {
    student: result.student,
    application: result.updatedApplication,
  };
}
