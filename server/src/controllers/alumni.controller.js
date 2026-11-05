import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import * as alumniService from '../services/alumni.service.js';
import { uploadPrivateStudentDocumentToR2 } from '../services/student-records.service.js';
import {
  createAlumniProfileSchema,
  updateAlumniProfileSchema,
  recordConsentSchema,
  renewConsentSchema,
  withdrawConsentSchema,
  directorySearchSchema,
  requestVerificationSchema,
  respondVerificationSchema,
} from '../validations/alumni.validation.js';
import { BadRequestError, UnauthorizedError, ForbiddenError } from '../utils/errors.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB hard limit
    files: 1,
  },
});

function createSingleFileUploadMiddleware(fieldName, label) {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    singleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `${label} file must be 5 MB or smaller.`,
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: `Please upload a single file using the form field '${fieldName}'.`,
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error.',
        });
      }
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error.',
        });
      }
      next();
    });
  };
}

export const uploadConsentFileMiddleware = createSingleFileUploadMiddleware(
  'consentFile',
  'Consent Evidence'
);

/**
 * Extracts and strictly validates the authenticated context established by authenticateToken and requireTenantContext.
 * Guaranteed to return trusted { userId, madrasaId, role }.
 * Never allows undefined property crashes; returns 401/403 controlled errors.
 */
function getAuthenticatedContext(req) {
  const userId = req.auth?.userId || req.user?.id || null;
  const madrasaId = req.tenant?.madrasaId || req.auth?.madrasaId || req.user?.madrasaId || null;
  const role = req.auth?.role || req.user?.role || 'MADRASA_ADMIN';

  if (!userId) {
    throw new UnauthorizedError('Authentication token is required.');
  }

  if (!madrasaId) {
    throw new ForbiddenError('Tenant madrasa context is missing or unauthorized.');
  }

  return { userId, madrasaId, role };
}

function getAuditContext(req) {
  return {
    userId: req.auth?.userId || req.user?.id || null,
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null,
  };
}

// ============================================================================
// 1. Institution Alumni Management (Original Madrasa Admin)
// ============================================================================

export async function listEligibleStudents(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const search = req.query.search || '';
    const students = await alumniService.listEligibleStudents(madrasaId, search);
    res.json({ success: true, data: students });
  } catch (err) {
    next(err);
  }
}

export async function createAlumniProfile(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const validated = createAlumniProfileSchema.parse(req.body);

    const profile = await alumniService.createAlumniProfileWithSequence(
      madrasaId,
      validated.studentId,
      validated,
      userId
    );

    res.status(201).json({
      success: true,
      message: 'Alumni Profile created successfully with permanent index sequence.',
      data: profile,
    });
  } catch (err) {
    next(err);
  }
}

export async function listMadrasaAlumni(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const result = await alumniService.listMadrasaAlumni(madrasaId, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getMadrasaAlumniDetails(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const { alumniId } = req.params;
    const profile = await alumniService.getMadrasaAlumniDetails(madrasaId, alumniId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function updateAlumniProfile(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const { alumniId } = req.params;
    const validated = updateAlumniProfileSchema.parse(req.body);

    const updated = await alumniService.updateAlumniProfile(madrasaId, alumniId, validated, userId);
    res.json({
      success: true,
      message: 'Alumni Profile updated successfully.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function recordConsent(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const { alumniId } = req.params;
    const validated = recordConsentSchema.parse(req.body);

    let consentFileId = validated.consentFileId || null;

    if (req.file) {
      const existing = await prisma.alumniProfile.findFirst({
        where: { id: alumniId, madrasaId },
        select: { studentId: true },
      });
      if (!existing) {
        throw new BadRequestError('Alumni profile not found.');
      }

      const uploaded = await uploadPrivateStudentDocumentToR2(
        madrasaId,
        existing.studentId,
        'alumni-consent',
        req.file
      );

      const fileObj = await prisma.fileObject.create({
        data: {
          madrasaId,
          type: 'STUDENT_DOCUMENT',
          objectKey: uploaded.objectKey,
          originalName: uploaded.originalName,
          mimeType: uploaded.mimeType,
          size: uploaded.size,
          publicUrl: null,
        },
      });
      consentFileId = fileObj.id;
    }

    const updated = await alumniService.recordConsent(
      madrasaId,
      alumniId,
      { ...validated, consentFileId },
      userId
    );

    res.json({
      success: true,
      message: 'Student consent recorded and verified.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function renewConsent(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const { alumniId } = req.params;

    // Validate request body metadata before file processing to avoid orphaned storage uploads
    renewConsentSchema.omit({ consentFileId: true }).parse(req.body);

    let consentFileId = req.body?.consentFileId;

    if (req.file) {
      const existing = await prisma.alumniProfile.findFirst({
        where: { id: alumniId, madrasaId },
        select: { studentId: true },
      });
      if (!existing) {
        throw new BadRequestError('Alumni profile not found.');
      }

      const uploaded = await uploadPrivateStudentDocumentToR2(
        madrasaId,
        existing.studentId,
        'alumni-consent-renewal',
        req.file
      );

      const fileObj = await prisma.fileObject.create({
        data: {
          madrasaId,
          type: 'STUDENT_DOCUMENT',
          objectKey: uploaded.objectKey,
          originalName: uploaded.originalName,
          mimeType: uploaded.mimeType,
          size: uploaded.size,
          publicUrl: null,
        },
      });
      consentFileId = fileObj.id;
    }

    const validated = renewConsentSchema.parse({
      ...req.body,
      consentFileId,
    });

    const updated = await alumniService.renewConsent(
      madrasaId,
      alumniId,
      validated,
      userId
    );

    res.json({
      success: true,
      message: 'Consent renewed successfully.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function withdrawConsent(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const { alumniId } = req.params;
    const validated = withdrawConsentSchema.parse(req.body);

    const updated = await alumniService.withdrawConsent(
      madrasaId,
      alumniId,
      validated.reason,
      userId
    );

    res.json({
      success: true,
      message: 'Consent withdrawn. Profile unpublished and restricted documents blocked immediately.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function publishAlumniProfile(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const { alumniId } = req.params;

    const published = await alumniService.publishAlumniProfile(madrasaId, alumniId, userId);
    res.json({
      success: true,
      message: 'Alumni profile published to Global Alumni Directory.',
      data: published,
    });
  } catch (err) {
    next(err);
  }
}

export async function unpublishAlumniProfile(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const { alumniId } = req.params;

    const unpublished = await alumniService.unpublishAlumniProfile(madrasaId, alumniId, userId);
    res.json({
      success: true,
      message: 'Alumni profile unpublished from Global Alumni Directory.',
      data: unpublished,
    });
  } catch (err) {
    next(err);
  }
}

export async function revokeAlumniProfile(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const { alumniId } = req.params;
    const reason = req.body?.reason || 'Administrative revocation';

    const revoked = await alumniService.revokeAlumniProfile(madrasaId, alumniId, reason, userId);
    res.json({
      success: true,
      message: 'Alumni profile publication revoked.',
      data: revoked,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 2. Global Alumni Directory & Tiered Profile View
// ============================================================================

export async function searchGlobalDirectory(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const validatedQuery = directorySearchSchema.parse(req.query);

    const results = await alumniService.searchGlobalDirectory(madrasaId, validatedQuery);
    res.json({ success: true, ...results });
  } catch (err) {
    next(err);
  }
}

export async function getGlobalAlumniProfile(req, res, next) {
  try {
    const authUser = getAuthenticatedContext(req);
    const { indexNumber } = req.params;
    const profile = await alumniService.getGlobalAlumniProfile(
      { id: authUser.userId, userId: authUser.userId, role: authUser.role, madrasaId: authUser.madrasaId },
      indexNumber
    );
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 3. Academic Verification Hub
// ============================================================================

export async function createVerificationRequest(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const validated = requestVerificationSchema.parse(req.body);

    const request = await alumniService.createVerificationRequest(
      madrasaId,
      userId,
      validated.alumniIndexNumber,
      validated
    );

    res.status(201).json({
      success: true,
      message: 'Verification request dispatched to issuing madrasa administration.',
      data: request,
    });
  } catch (err) {
    next(err);
  }
}

export async function listIncomingVerificationRequests(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const results = await alumniService.listIncomingVerificationRequests(madrasaId, req.query);
    res.json({ success: true, ...results });
  } catch (err) {
    next(err);
  }
}

export async function listOutgoingVerificationRequests(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const results = await alumniService.listOutgoingVerificationRequests(madrasaId, req.query);
    res.json({ success: true, ...results });
  } catch (err) {
    next(err);
  }
}

export async function respondToVerificationRequest(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const { requestId } = req.params;
    const validated = respondVerificationSchema.parse(req.body);

    const updated = await alumniService.respondToVerificationRequest(
      madrasaId,
      requestId,
      validated,
      userId
    );

    res.json({
      success: true,
      message: `Verification request ${validated.action === 'APPROVE' ? 'approved' : 'rejected'}.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 4. Secure Backend Proxy Certificate Streaming
// ============================================================================

export async function streamAlumniCertificate(req, res, next) {
  try {
    const authUser = getAuthenticatedContext(req);
    const { alumniId, qualificationId } = req.params;

    const { stream, mimeType, originalName } = await alumniService.getAlumniCertificateStream(
      { id: authUser.userId, userId: authUser.userId, role: authUser.role, madrasaId: authUser.madrasaId },
      alumniId,
      qualificationId
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalName)}"`);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}
