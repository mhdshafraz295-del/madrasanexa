import * as aiService from '../services/ai.service.js';
import { BadRequestError } from '../utils/errors.js';

/**
 * Get AI Assistant status and configuration for current user's Madrasa
 */
export async function getAiStatus(req, res, next) {
  try {
    const madrasaId = req.auth.role === 'SUPER_ADMIN'
      ? (req.query.madrasaId || null)
      : req.auth.madrasaId;

    if (!madrasaId) {
      if (req.auth.role === 'SUPER_ADMIN') {
        const settings = await aiService.getPlatformAiSettings();
        return res.json({
          success: true,
          data: {
            aiEnabled: true,
            isSuperAdmin: true,
            settings,
          },
        });
      }
      throw new BadRequestError('Madrasa tenant identifier is required.');
    }

    const status = await aiService.getTenantAiStatus(madrasaId);
    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Madrasa Admin: Upload bank payment receipt for AI subscription activation
 */
export async function submitSubscriptionReceipt(req, res, next) {
  try {
    const madrasaId = req.auth.madrasaId;
    const userId = req.auth.userId;

    const { planName, amount, transactionRef } = req.body;
    const file = req.file;

    const request = await aiService.submitAiSubscriptionReceipt({
      madrasaId,
      userId,
      planName,
      amount,
      transactionRef,
      file,
    });

    return res.status(201).json({
      success: true,
      message: 'Bank payment receipt submitted successfully. Our team will review and activate your AI Assistant within 2-4 hours.',
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * AI Tool: Zero-Storage PDF Exam Paper Generator
 */
export async function generateExamPaper(req, res, next) {
  try {
    const {
      pastedText,
      topic,
      subject,
      gradeLevel,
      language,
      examTitle,
      durationMinutes,
      totalMarks,
      mcqCount,
      shortCount,
      essayCount,
    } = req.body;

    const madrasaName = req.tenant?.name || 'Islamic Madrasa';
    const pdfBuffer = req.file?.buffer || null;

    const result = await aiService.generateExamPaper({
      pdfBuffer,
      pastedText,
      topic,
      subject,
      gradeLevel,
      language: language || 'English',
      madrasaName,
      examTitle,
      durationMinutes: Number(durationMinutes) || 60,
      totalMarks: Number(totalMarks) || 50,
      mcqCount: Number(mcqCount) || 5,
      shortCount: Number(shortCount) || 4,
      essayCount: Number(essayCount) || 2,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * AI Tool: Ustadh 30-Min Lesson Planner
 */
export async function generateLessonPlan(req, res, next) {
  try {
    const {
      pastedText,
      topic,
      subject,
      gradeLevel,
      durationMinutes,
      language,
    } = req.body;

    const pdfBuffer = req.file?.buffer || null;

    const result = await aiService.generateLessonPlan({
      pdfBuffer,
      pastedText,
      topic,
      subject,
      gradeLevel,
      durationMinutes: Number(durationMinutes) || 30,
      language: language || 'English',
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * AI Tool: Madrasa Event Poster & Flyer Maker
 */
export async function generatePoster(req, res, next) {
  try {
    const {
      title,
      themePrompt,
      category,
      dateText,
      venue,
      language,
    } = req.body;

    const madrasaName = req.tenant?.name || '';

    const result = await aiService.generatePoster({
      title,
      themePrompt,
      category,
      dateText,
      venue,
      madrasaName,
      language,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * AI Tool: Multilingual Translator
 */
export async function translateContent(req, res, next) {
  try {
    const { text, sourceLanguage, targetLanguage, language } = req.body;

    const result = await aiService.translateContent({
      text,
      sourceLanguage: sourceLanguage || 'Auto-Detect',
      targetLanguage: targetLanguage || language || 'English',
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * AI Tool: Conversational Copilot Chat (Multi-Turn Chat & Mode Routing)
 */
export async function chatWithCopilot(req, res, next) {
  try {
    const {
      message,
      history,
      language,
      pastedText,
      pdfText,
      mode,
    } = req.body;

    const pdfBuffer = req.file?.buffer || null;
    const madrasaName = req.tenant?.name || '';
    const role = req.auth?.role || 'MADRASA_ADMIN';

    let parsedHistory = [];
    if (history) {
      if (typeof history === 'string') {
        try {
          parsedHistory = JSON.parse(history);
        } catch {
          parsedHistory = [];
        }
      } else if (Array.isArray(history)) {
        parsedHistory = history;
      }
    }

    const result = await aiService.chatWithCopilot({
      message: message || '',
      history: parsedHistory,
      language: language || 'English',
      pdfBuffer,
      pastedText: pastedText || pdfText || '',
      madrasaName,
      role,
      mode: mode || 'auto',
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: List all AI Subscription Requests
 */
export async function listAllAiSubscriptionRequests(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await aiService.listAllAiSubscriptionRequests({ status, page, limit });
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: Approve an AI Subscription Request
 */
export async function approveAiSubscriptionRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { adminNote, customExpiresAt } = req.body;

    const result = await aiService.approveAiSubscriptionRequest({
      requestId: id,
      adminUserId: req.auth.userId,
      adminNote,
      customExpiresAt,
    });

    return res.json({
      success: true,
      message: 'AI Assistant subscription approved and enabled successfully for the tenant.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: Reject an AI Subscription Request
 */
export async function rejectAiSubscriptionRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { adminNote } = req.body;

    const result = await aiService.rejectAiSubscriptionRequest({
      requestId: id,
      adminUserId: req.auth.userId,
      adminNote,
    });

    return res.json({
      success: true,
      message: 'Subscription request rejected.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: Manually toggle AI access for any Madrasa
 */
export async function toggleMadrasaAiAccess(req, res, next) {
  try {
    const { madrasaId } = req.params;
    const { enabled, expiresAt, note } = req.body;

    const result = await aiService.toggleMadrasaAiAccess({
      madrasaId,
      enabled,
      expiresAt,
      adminUserId: req.auth.userId,
      note,
    });

    return res.json({
      success: true,
      message: `AI Assistant successfully ${enabled ? 'enabled' : 'disabled'} for Madrasa.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: Get platform AI settings
 */
export async function getPlatformAiSettings(req, res, next) {
  try {
    const settings = await aiService.getPlatformAiSettings();
    return res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Super Admin: Update platform AI settings
 */
export async function updatePlatformAiSettings(req, res, next) {
  try {
    const settings = await aiService.updatePlatformAiSettings(req.body);
    return res.json({
      success: true,
      message: 'AI pricing and platform bank account details updated successfully.',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}
