/**
 * MadrasaNexa Phase 02 – Student Scan Token Controller
 *
 * Exposes tenant-isolated endpoints for Student ID Card tokens:
 * - Listing card token statuses with pagination & search (never exposing secrets)
 * - Single-student token issuance (fresh cards)
 * - Additive batch token generation (skips existing active cards)
 * - Single-card print data retrieval (POST, Cache-Control: no-store)
 * - Batch card print data retrieval (POST, Cache-Control: no-store)
 * - Token regeneration with mandatory reason >= 3 chars (POST, Cache-Control: no-store)
 * - Token revocation with mandatory reason >= 3 chars (POST)
 * - Token lifecycle audit history (GET)
 */

import * as studentTokenService from '../services/student-token.service.js';
import { prisma } from '../lib/prisma.js';
import { renderCardSheetPdf } from '../services/pdf-report.service.js';
import {
  listCardTokensQuerySchema,
  batchGenerateTokensSchema,
  batchPrintTokensSchema,
  regenerateTokenSchema,
  revokeTokenSchema,
  renderSheetPdfSchema,
} from '../validations/student-token.validation.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

function setNoStoreHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

/**
 * GET /api/madrasa-admin/students/card-tokens
 * Lists students and card statuses. Never exposes raw tokens or ciphertext.
 */
export async function listCardTokens(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = listCardTokensQuerySchema.parse(req.query);
    const data = await studentTokenService.listCardTokens({
      madrasaId,
      ...validated,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/madrasa-admin/students/:id/card-tokens/issue
 * Issues initial card token for student without existing active token.
 */
export async function issueCardToken(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const studentId = req.params.id;
    const issuedById = req.auth?.userId || req.user?.id;

    if (!studentId || typeof studentId !== 'string') {
      throw new BadRequestError('Student ID is required in route parameter.');
    }

    const { tokenRecord, rawToken } = await studentTokenService.issueStudentToken({
      madrasaId,
      studentId,
      issuedById,
    });

    setNoStoreHeaders(res);
    res.status(201).json({
      success: true,
      message: 'Card token issued successfully.',
      data: {
        tokenId: tokenRecord.id,
        tokenHint: tokenRecord.tokenHint,
        version: tokenRecord.version,
        rawToken,
        issuedAt: tokenRecord.issuedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/madrasa-admin/students/card-tokens/batch-generate
 * Generates tokens for all students missing active cards. Skips existing.
 */
export async function batchGenerateTokens(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const issuedById = req.auth?.userId || req.user?.id;
    const validated = batchGenerateTokensSchema.parse(req.body);

    const result = await studentTokenService.batchGenerateMissingTokens({
      madrasaId,
      classId: validated.classId,
      issuedById,
    });

    res.json({
      success: true,
      message: `Batch token generation complete: ${result.generatedCount} generated, ${result.skippedCount} skipped.`,
      data: {
        totalEligible: result.totalEligible,
        generatedCount: result.generatedCount,
        skippedCount: result.skippedCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/madrasa-admin/students/:id/card-tokens/print-data
 * Retrieves active decrypted card data for single student print.
 * Uses POST and strict Cache-Control: no-store to prevent caching.
 */
export async function getCardPrintData(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const studentId = req.params.id;

    if (!studentId || typeof studentId !== 'string') {
      throw new BadRequestError('Student ID is required in route parameter.');
    }

    // 1. Verify student exists in tenant
    const student = await prisma.student.findFirst({
      where: { id: studentId, madrasaId },
      select: {
        id: true,
        admissionNo: true,
        fullName: true,
        status: true,
        admissionDate: true,
        photoFileId: true,
        classId: true,
        class: {
          select: { id: true, name: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundError('Student not found in this institution.');
    }

    // 2. Fetch and decrypt active token
    const { tokenRecord, rawToken } = await studentTokenService.getActiveTokenForPrint({
      madrasaId,
      studentId,
    });

    setNoStoreHeaders(res);
    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          admissionNo: student.admissionNo,
          fullName: student.fullName,
          className: student.class?.name || null,
          classId: student.classId,
          admissionDate: student.admissionDate,
          photoFileId: student.photoFileId,
          status: student.status,
        },
        card: {
          tokenId: tokenRecord.id,
          tokenHint: tokenRecord.tokenHint,
          version: tokenRecord.version,
          issuedAt: tokenRecord.issuedAt,
          rawToken,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/madrasa-admin/students/card-tokens/batch-print-data
 * Retrieves and decrypts active tokens for a batch of students.
 * Uses POST and strict Cache-Control: no-store.
 */
export async function getBatchCardPrintData(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = batchPrintTokensSchema.parse(req.body);

    const data = await studentTokenService.getBatchCardPrintData({
      madrasaId,
      studentIds: validated.studentIds,
      classId: validated.classId,
    });

    setNoStoreHeaders(res);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/madrasa-admin/students/:id/card-tokens/regenerate
 * Atomically revokes existing active card token and issues a replacement.
 * Requires mandatory reason >= 3 characters.
 */
export async function regenerateCardToken(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const studentId = req.params.id;
    const issuedById = req.auth?.userId || req.user?.id;

    if (!studentId || typeof studentId !== 'string') {
      throw new BadRequestError('Student ID is required in route parameter.');
    }

    const validated = regenerateTokenSchema.parse(req.body);

    const { tokenRecord, rawToken, previousTokenId } = await studentTokenService.regenerateStudentToken({
      madrasaId,
      studentId,
      reason: validated.reason,
      issuedById,
    });

    setNoStoreHeaders(res);
    res.json({
      success: true,
      message: 'Scan token regenerated successfully.',
      data: {
        tokenId: tokenRecord.id,
        tokenHint: tokenRecord.tokenHint,
        version: tokenRecord.version,
        rawToken,
        previousTokenId,
        issuedAt: tokenRecord.issuedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/madrasa-admin/students/:id/card-tokens/revoke
 * Revokes active card token with mandatory reason >= 3 characters.
 */
export async function revokeCardToken(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const studentId = req.params.id;
    const revokedById = req.auth?.userId || req.user?.id;

    if (!studentId || typeof studentId !== 'string') {
      throw new BadRequestError('Student ID is required in route parameter.');
    }

    const validated = revokeTokenSchema.parse(req.body);

    const revokedRecord = await studentTokenService.revokeStudentToken({
      madrasaId,
      studentId,
      reason: validated.reason,
      revokedById,
    });

    res.json({
      success: true,
      message: 'Card token revoked successfully.',
      data: revokedRecord,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/madrasa-admin/students/:id/card-tokens/history
 * Returns full token version history for student audit.
 */
export async function getCardTokenHistory(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const studentId = req.params.id;

    if (!studentId || typeof studentId !== 'string') {
      throw new BadRequestError('Student ID is required in route parameter.');
    }

    const history = await studentTokenService.listStudentTokenHistory({
      madrasaId,
      studentId,
    });

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/madrasa-admin/students/card-tokens/render-sheet-pdf
 * Renders batch A4 card sheets into PDF using Puppeteer shared singleton.
 * Uses POST and strict Cache-Control: no-store.
 */
export async function renderCardSheetPdfEndpoint(req, res, next) {
  try {
    const validated = renderSheetPdfSchema.parse(req.body);
    const pdfBuffer = await renderCardSheetPdf({ html: validated.html });

    setNoStoreHeaders(res);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${validated.title || 'student-id-cards-a4'}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

