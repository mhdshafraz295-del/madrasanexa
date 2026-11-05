import * as interviewService from '../services/interview.service.js';
import * as pdfService from '../services/interview-pdf.service.js';
import * as emailService from '../services/interview-email.service.js';
import {
  scheduleInterviewSchema,
  rescheduleInterviewSchema,
  cancelInterviewSchema,
  evaluateInterviewSchema,
  queryAppointmentsSchema,
  retryEmailNotificationSchema,
} from '../validations/interview.validation.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

/**
 * Extracts and strictly validates the authenticated context established by authenticateToken and requireTenantContext.
 * Guaranteed to return trusted { userId, madrasaId }.
 * Never allows undefined property crashes; returns 401/403 controlled errors.
 */
function getAuthenticatedContext(req) {
  const userId = req.auth?.userId || req.user?.id || null;
  const madrasaId = req.tenant?.madrasaId || req.tenantId || req.auth?.madrasaId || req.user?.madrasaId || null;

  if (!userId) {
    throw new UnauthorizedError('Authentication token is required.');
  }

  if (!madrasaId) {
    throw new ForbiddenError('Tenant madrasa context is missing or unauthorized.');
  }

  return { userId, madrasaId };
}

export async function getEligibleApplicants(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const { admissionPeriodId, interviewRound, search } = req.query;

    const applicants = await interviewService.getEligibleApplicants(madrasaId, {
      admissionPeriodId,
      interviewRound,
      search,
    });

    res.json({
      success: true,
      data: applicants,
    });
  } catch (err) {
    next(err);
  }
}

export async function createBulkSchedule(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const validated = scheduleInterviewSchema.parse(req.body);

    const result = await interviewService.createBulkSchedule(madrasaId, validated, userId);

    res.status(201).json({
      success: true,
      message: `Successfully scheduled interviews for ${result.appointmentsCount} applicant(s).`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAppointments(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const validated = queryAppointmentsSchema.parse(req.query);

    const result = await interviewService.getAppointments(madrasaId, validated);

    res.json({
      success: true,
      data: result.appointments,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAppointmentById(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const appointment = await interviewService.getAppointmentById(madrasaId, req.params.id);

    res.json({
      success: true,
      data: appointment,
    });
  } catch (err) {
    next(err);
  }
}

export async function rescheduleAppointment(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const validated = rescheduleInterviewSchema.parse(req.body);

    const appointment = await interviewService.rescheduleAppointment(
      madrasaId,
      req.params.id,
      validated,
      userId
    );

    res.json({
      success: true,
      message: 'Interview appointment rescheduled successfully.',
      data: appointment,
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelAppointment(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const validated = cancelInterviewSchema.parse(req.body);

    const appointment = await interviewService.cancelAppointment(
      madrasaId,
      req.params.id,
      validated,
      userId
    );

    res.json({
      success: true,
      message: 'Interview appointment cancelled successfully.',
      data: appointment,
    });
  } catch (err) {
    next(err);
  }
}

export async function evaluateAppointment(req, res, next) {
  try {
    const { madrasaId, userId } = getAuthenticatedContext(req);
    const validated = evaluateInterviewSchema.parse(req.body);

    const evaluation = await interviewService.evaluateAppointment(
      madrasaId,
      req.params.id,
      validated,
      userId
    );

    res.json({
      success: true,
      message: 'Interview evaluation recorded successfully.',
      data: evaluation,
    });
  } catch (err) {
    next(err);
  }
}

export async function getDashboardStats(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const { admissionPeriodId } = req.query;

    const stats = await interviewService.getDashboardStats(madrasaId, { admissionPeriodId });

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
}

export async function getApplicantHistory(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const history = await interviewService.getApplicantInterviewHistory(madrasaId, req.params.applicationId);

    res.json({
      success: true,
      data: history,
    });
  } catch (err) {
    next(err);
  }
}

export async function previewPdf(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const pdfBuffer = await pdfService.getInterviewInvitationPdfBuffer(madrasaId, req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Interview_Invitation.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function downloadPdf(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const result = await pdfService.resolveInterviewInvitationPdfUrl(madrasaId, req.params.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function sendEmailNotification(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const forceRetry = Boolean(req.body?.forceRetry);

    const result = await emailService.sendInterviewAppointmentEmail(madrasaId, req.params.id, { forceRetry });

    res.json({
      success: result.success,
      message: result.success ? 'Interview email notification dispatched successfully.' : result.error,
      data: result.notification,
    });
  } catch (err) {
    next(err);
  }
}

export async function retryNotifications(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const validated = retryEmailNotificationSchema.parse(req.body);

    const result = await emailService.retryFailedInterviewNotifications(madrasaId, validated);

    res.json({
      success: true,
      message: `Processed retry for ${result.attempted} notification(s): ${result.successful} successful, ${result.failed} failed.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function markUncertainDelivered(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const { notificationId } = req.params;
    const { smtpMessageId } = req.body || {};

    const updated = await emailService.markUncertainNotificationAsDelivered(
      madrasaId,
      notificationId,
      smtpMessageId
    );

    res.json({
      success: true,
      message: 'Notification marked as delivered.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function confirmUncertainFailed(req, res, next) {
  try {
    const { madrasaId } = getAuthenticatedContext(req);
    const { notificationId } = req.params;

    const updated = await emailService.confirmUncertainNotificationAsFailed(
      madrasaId,
      notificationId
    );

    res.json({
      success: true,
      message: 'Notification confirmed failed and reset for retry.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}
