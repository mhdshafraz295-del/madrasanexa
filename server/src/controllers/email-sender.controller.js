import { prisma } from '../lib/prisma.js';
import {
  updateEmailSenderSettingsSchema,
  testEmailSenderConnectionSchema,
} from '../validations/email-sender.validation.js';
import {
  getMadrasaEmailSettings,
  updateMadrasaEmailSettings,
  testMadrasaEmailSenderConnection,
} from '../services/madrasa-email-setting.service.js';
import { successResponse } from '../utils/response.js';

/**
 * GET /api/madrasa-admin/settings/email-sender
 */
export async function getEmailSenderSettingsHandler(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.auth?.madrasaId;
    const settings = await getMadrasaEmailSettings(madrasaId);
    return successResponse(res, 'Email sender settings fetched successfully.', settings);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/madrasa-admin/settings/email-sender
 */
export async function updateEmailSenderSettingsHandler(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.auth?.madrasaId;
    const userId = req.auth?.userId;
    const validatedData = updateEmailSenderSettingsSchema.parse(req.body);
    const updated = await updateMadrasaEmailSettings(madrasaId, validatedData, userId);
    return successResponse(res, 'Email sender settings updated successfully.', updated);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/madrasa-admin/settings/email-sender/test
 */
export async function testEmailSenderConnectionHandler(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.auth?.madrasaId;
    const userId = req.auth?.userId;

    let userEmail = req.user?.email;
    if (!userEmail && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      userEmail = user?.email;
    }

    const validatedData = testEmailSenderConnectionSchema.parse(req.body);
    const result = await testMadrasaEmailSenderConnection(
      madrasaId,
      validatedData,
      userEmail,
      userId
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        data: result,
      });
    }

    return successResponse(res, result.message, result);
  } catch (err) {
    next(err);
  }
}
