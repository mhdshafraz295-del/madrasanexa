import * as staffNoticeService from '../services/staff-notice.service.js';
import {
  createStaffNoticeSchema,
  listStaffNoticesQuerySchema,
} from '../validations/staff-notice.validation.js';

export async function createNotice(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;
    const validated = createStaffNoticeSchema.parse(req.body);

    const data = await staffNoticeService.createStaffNotice({
      madrasaId,
      userId,
      payload: validated,
    });

    return res.status(201).json({
      success: true,
      message: 'Staff notice published successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function listAdminNotices(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = listStaffNoticesQuerySchema.parse(req.query);

    const data = await staffNoticeService.getAdminStaffNotices({
      madrasaId,
      query: validated,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteNotice(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;
    const { id } = req.params;

    const data = await staffNoticeService.deleteStaffNotice({
      madrasaId,
      userId,
      noticeId: id,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTeacherNotices(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;
    const ustadhId = req.teacher ? req.teacher.ustadhId : null;

    const data = await staffNoticeService.getTeacherStaffNotices({
      madrasaId,
      userId,
      ustadhId,
      query: req.query,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function markNoticeRead(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;
    const ustadhId = req.teacher ? req.teacher.ustadhId : null;
    const { id } = req.params;

    const data = await staffNoticeService.markTeacherNoticeRead({
      madrasaId,
      userId,
      ustadhId,
      noticeId: id,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllNoticesRead(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;
    const ustadhId = req.teacher ? req.teacher.ustadhId : null;

    const data = await staffNoticeService.markAllTeacherNoticesRead({
      madrasaId,
      userId,
      ustadhId,
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
