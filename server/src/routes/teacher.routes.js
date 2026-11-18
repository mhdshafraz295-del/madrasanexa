import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  requireTeacherContext,
  rejectClientSuppliedTeacherOverride,
} from '../middleware/tenant.middleware.js';
import { requireTeacher } from '../middleware/role.middleware.js';
import {
  getTeacherDashboard,
  getTeacherProfile,
  updateTeacherProfile,
  uploadTeacherPhoto,
  getTeacherTimetable,
  getAssignedClasses,
  getAssignedClassDetail,
  getTodayTeacherAttendance,
  verifyTeacherClassroomQr,
  getStudentPeriodSession,
  getDailyStudentRoster,
  scanDailyStudentAttendance,
  markStudentPeriodAttendance,
  scanStudentPeriodAttendance,
  sealStudentPeriodSession,
  getAttendanceHistory,
  getSalarySummary,
  getPaymentHistory,
  listPayslips,
  getPayslipDetail,
  getTeacherNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getTeacherSettings,
  changeTeacherPassword,
  updateTeacherPreferences,
} from '../controllers/teacher.controller.js';
import * as pollController from '../controllers/poll.controller.js';
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

const uploadPhotoMiddleware = (req, res, next) => {
  const singleUpload = upload.single('photo');
  singleUpload(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    }
    next();
  });
};

const router = Router();

/**
 * Teacher Portal Security Pipeline:
 * 1. authenticateToken: Live JWT verification, active user check, and tokenVersion verification.
 * 2. requireTeacher: Validates req.auth.role === 'TEACHER'.
 * 3. requireTeacherContext: Live tenant & active ustadh verification; attaches frozen req.tenant and req.teacher.
 * 4. rejectClientSuppliedTeacherOverride: Rejects any attempt to inject madrasaId, ustadhId, or role.
 */
router.use(authenticateToken);
router.use(requireTeacher);
router.use(requireTeacherContext);
router.use(rejectClientSuppliedTeacherOverride);

// =============================================================================
// Module 1: Teacher Dashboard
// =============================================================================
router.get('/dashboard', getTeacherDashboard);

// =============================================================================
// Module 2: Teacher Profile
// =============================================================================
router.get('/profile', getTeacherProfile);
router.patch('/profile', updateTeacherProfile);
router.post('/profile/photo', uploadPhotoMiddleware, uploadTeacherPhoto);

// =============================================================================
// Module 3: Timetable
// =============================================================================
router.get('/timetable', getTeacherTimetable);

// =============================================================================
// Module 4: Assigned Classes and Subjects
// =============================================================================
router.get('/classes', getAssignedClasses);
router.get('/classes/:classId', getAssignedClassDetail);

// =============================================================================
// Module 5: Teacher Classroom Attendance
// =============================================================================
router.get('/attendance/teacher/today', getTodayTeacherAttendance);
router.post('/attendance/teacher/verify-qr', verifyTeacherClassroomQr);

// =============================================================================
// Module 6: Student Period Attendance (Option A: Full Isolation)
router.get('/attendance/student/daily-roster', getDailyStudentRoster);
router.post('/attendance/student/daily-scan', scanDailyStudentAttendance);
router.get('/attendance/student/session', getStudentPeriodSession);
router.post('/attendance/student/scan', scanStudentPeriodAttendance);
router.post('/attendance/student/mark', markStudentPeriodAttendance);
router.post('/attendance/student/seal', sealStudentPeriodSession);

// =============================================================================
// Module 7: Attendance History
// =============================================================================
router.get('/attendance/history', getAttendanceHistory);

// =============================================================================
// Module 8: Salary Summary
// =============================================================================
router.get('/salary/summary', getSalarySummary);

// =============================================================================
// Module 9: Payment History
// =============================================================================
router.get('/salary/history', getPaymentHistory);

// =============================================================================
// Module 10: Payslips
// =============================================================================
router.get('/salary/payslips', listPayslips);
router.get('/salary/payslips/:payslipId', getPayslipDetail);

// =============================================================================
// Module 11: Notifications
// =============================================================================
router.get('/notifications', getTeacherNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.patch('/notifications/read-all', markAllNotificationsRead);

// =============================================================================
// Module 12: Account Settings
// =============================================================================
router.get('/settings', getTeacherSettings);
router.put('/settings/password', changeTeacherPassword);
router.put('/settings/preferences', updateTeacherPreferences);

// =============================================================================
// Module 13: Community Polls & Governance
// =============================================================================
router.get('/polls', pollController.getUserPolls);
router.post('/polls/:id/vote', pollController.submitVote);

export default router;
