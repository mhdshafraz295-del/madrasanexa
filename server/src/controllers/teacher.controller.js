import * as teacherService from '../services/teacher.service.js';
import {
  teacherProfileUpdateSchema,
  teacherTimetableQuerySchema,
  teacherVerifyQrSchema,
  studentPeriodSessionQuerySchema,
  studentPeriodMarkSchema,
  studentPeriodScanSchema,
  studentPeriodSealSchema,
  teacherAttendanceHistoryQuerySchema,
  teacherPaymentHistoryQuerySchema,
  teacherNotificationsQuerySchema,
  teacherPasswordChangeSchema,
  teacherPreferencesUpdateSchema,
} from '../validations/teacher.validation.js';

// =============================================================================
// Module 1: Teacher Dashboard
// =============================================================================

export async function getTeacherDashboard(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const userId = req.auth.userId;

    const data = await teacherService.getDashboardData({ madrasaId, ustadhId, userId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Module 2: Teacher Profile
// =============================================================================

export async function getTeacherProfile(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const userId = req.auth.userId;

    const data = await teacherService.getTeacherProfile({ madrasaId, ustadhId, userId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateTeacherProfile(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const validated = teacherProfileUpdateSchema.parse(req.body);

    const data = await teacherService.updateTeacherProfile({
      madrasaId,
      ustadhId,
      data: validated,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function uploadTeacherPhoto(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const userId = req.auth.userId;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo provided. Please upload an image file.',
      });
    }

    const data = await teacherService.uploadTeacherProfilePhoto({
      madrasaId,
      ustadhId,
      userId,
      file: req.file,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Module 3: Timetable
// =============================================================================

export async function getTeacherTimetable(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const validated = teacherTimetableQuerySchema.parse(req.query);

    const data = await teacherService.getTimetable({
      madrasaId,
      ustadhId,
      day: validated.day,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Module 4: Assigned Classes and Subjects
// =============================================================================

export async function getAssignedClasses(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;

    const data = await teacherService.getAssignedClasses({ madrasaId, ustadhId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getAssignedClassDetail(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const { classId } = req.params;

    const data = await teacherService.getClassDetail({ madrasaId, ustadhId, classId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Module 5: Teacher Classroom Attendance
// =============================================================================

export async function getTodayTeacherAttendance(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;

    const data = await teacherService.getTodayTeacherAttendance({ madrasaId, ustadhId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function verifyTeacherClassroomQr(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const userId = req.auth.userId;
    const validated = teacherVerifyQrSchema.parse(req.body);

    const data = await teacherService.recordTeacherClassroomCheckIn({
      madrasaId,
      ustadhId,
      userId,
      payload: validated,
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Module 6: Student Period Attendance (Option A: Full Isolation)
// =============================================================================

export async function getStudentPeriodSession(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const validated = studentPeriodSessionQuerySchema.parse(req.query);

    const data = await teacherService.getPeriodAttendanceSession({
      madrasaId,
      ustadhId,
      scheduleId: validated.scheduleId,
      date: validated.date,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function markStudentPeriodAttendance(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const userId = req.auth.userId;
    const validated = studentPeriodMarkSchema.parse(req.body);

    const data = await teacherService.markPeriodAttendance({
      madrasaId,
      ustadhId,
      userId,
      payload: validated,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function sealStudentPeriodSession(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const userId = req.auth.userId;
    const validated = studentPeriodSealSchema.parse(req.body);

    const data = await teacherService.sealPeriodSession({
      madrasaId,
      ustadhId,
      userId,
      scheduleId: validated.scheduleId,
      date: validated.date,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function scanStudentPeriodAttendance(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const userId = req.auth.userId;
    const validated = studentPeriodScanSchema.parse(req.body);

    const data = await teacherService.scanStudentPeriodAttendance({
      madrasaId,
      ustadhId,
      userId,
      scheduleId: validated.scheduleId,
      sessionId: validated.sessionId,
      scanInput: validated.scanInput,
      date: validated.date,
      periodNumber: validated.periodNumber,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Module 7: Attendance History
// =============================================================================

export async function getAttendanceHistory(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const validated = teacherAttendanceHistoryQuerySchema.parse(req.query);

    const data = await teacherService.getAttendanceHistory({
      madrasaId,
      ustadhId,
      query: validated,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Module 8: Salary Summary
// =============================================================================

export async function getSalarySummary(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;

    const data = await teacherService.getSalarySummary({ madrasaId, ustadhId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Module 9: Payment History
// =============================================================================

export async function getPaymentHistory(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const validated = teacherPaymentHistoryQuerySchema.parse(req.query);

    const data = await teacherService.getPaymentHistory({
      madrasaId,
      ustadhId,
      query: validated,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Module 10: Payslips
// =============================================================================

export async function listPayslips(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;

    const data = await teacherService.listPayslips({ madrasaId, ustadhId, query: req.query });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getPayslipDetail(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const { payslipId } = req.params;

    const data = await teacherService.getPayslipDetail({
      madrasaId,
      ustadhId,
      payslipId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Module 11: Notifications
// =============================================================================

export async function getTeacherNotifications(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;
    const validated = teacherNotificationsQuerySchema.parse(req.query);

    const data = await teacherService.getNotifications({
      madrasaId,
      userId,
      query: validated,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const userId = req.auth.userId;
    const { id } = req.params;

    const data = await teacherService.markNotificationRead({
      userId,
      announcementId: id,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth.userId;

    const data = await teacherService.markAllNotificationsRead({ madrasaId, userId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// Module 12: Account Settings
// =============================================================================

export async function getTeacherSettings(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const ustadhId = req.teacher.ustadhId;
    const userId = req.auth.userId;

    const data = await teacherService.getTeacherSettings({ madrasaId, ustadhId, userId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function changeTeacherPassword(req, res, next) {
  try {
    const userId = req.auth.userId;
    const validated = teacherPasswordChangeSchema.parse(req.body);

    const data = await teacherService.changePassword({ userId, data: validated });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateTeacherPreferences(req, res, next) {
  try {
    const userId = req.auth.userId;
    const ustadhId = req.teacher.ustadhId;
    const validated = teacherPreferencesUpdateSchema.parse(req.body);

    const data = await teacherService.updatePreferences({
      userId,
      ustadhId,
      data: validated,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
