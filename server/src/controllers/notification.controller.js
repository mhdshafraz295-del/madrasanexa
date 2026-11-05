import * as notificationService from '../services/notification.service.js';
import * as timetableService from '../services/timetable.service.js';
import {
  updateNotificationSettingsSchema,
  listNotificationJobsQuerySchema,
  finalizeTimetableSchema,
} from '../validations/notification.validation.js';

export async function getSettings(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const data = await notificationService.getNotificationSettings(madrasaId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = updateNotificationSettingsSchema.parse(req.body);
    const data = await notificationService.updateNotificationSettings(madrasaId, validated, userId);
    res.json({ success: true, message: 'Notification settings updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function listJobs(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const validated = listNotificationJobsQuerySchema.parse(req.query);
    const result = await notificationService.listNotificationJobs(madrasaId, validated);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function getJobById(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const data = await notificationService.getNotificationJobById(madrasaId, req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function retryJob(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const data = await notificationService.retryNotificationJob(madrasaId, req.params.id, userId);
    res.json({ success: true, message: 'Notification job queued for retry.', data });
  } catch (err) {
    next(err);
  }
}

export async function listPublications(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const data = await notificationService.listTimetablePublications(madrasaId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function finalizeTimetable(req, res, next) {
  try {
    const madrasaId = req.tenant?.madrasaId || req.user?.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = finalizeTimetableSchema.parse(req.body);
    const data = await timetableService.finalizeTimetable(madrasaId, validated, userId);
    res.json({ success: true, message: 'Timetable finalized successfully.', data });
  } catch (err) {
    next(err);
  }
}
