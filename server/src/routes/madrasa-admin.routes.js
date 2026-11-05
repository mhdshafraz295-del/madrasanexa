import { Router } from 'express';
import { authenticateToken, requirePasswordChanged } from '../middleware/auth.middleware.js';
import { requireMadrasaAdmin } from '../middleware/role.middleware.js';
import { requireTenantContext } from '../middleware/tenant.middleware.js';
import { requireActiveSubscription } from '../middleware/subscription.middleware.js';
import { requireFeature } from '../middleware/feature-entitlement.middleware.js';
import { emailTestRateLimiter } from '../middleware/rateLimiter.js';
import {
  getEmailSenderSettingsHandler,
  updateEmailSenderSettingsHandler,
  testEmailSenderConnectionHandler,
} from '../controllers/email-sender.controller.js';
import {
  getDashboard,
  getSettings,
  updateSettings,
  getProfile,
  updateProfile,
  getActivity,
  getSubscription,
} from '../controllers/madrasa-admin.controller.js';
import {
  getMyProfile as getMyMadrasaProfile,
  updateMyProfile as updateMyMadrasaProfile,
  generateSummary as generateMadrasaSummary,
  publishProfile as publishMadrasaProfile,
  unpublishProfile as unpublishMadrasaProfile,
  broadcastNotice as broadcastMadrasaNotice,
  uploadHeroImageMiddleware,
  uploadHeroImage,
  removeHeroImage,
  uploadPosterMiddleware,
  uploadPoster,
  removePoster,
  uploadEventImagesMiddleware,
  uploadEventImages,
} from '../controllers/madrasa-profile.controller.js';
import {
  getTheme,
  saveDraft,
  publish as publishTheme,
  reset as resetTheme,
  discard as discardTheme,
} from '../controllers/madrasa-theme.controller.js';
import {
  getBranding,
  uploadLogo,
  removeLogo,
  uploadLogoMiddleware,
} from '../controllers/branding.controller.js';
import {
  listPeriods,
  createPeriod,
  togglePeriod,
  listApplications,
  getApplication,
  reviewApplication,
  convertApplication,
} from '../controllers/admission.controller.js';
import * as interviewController from '../controllers/interview.controller.js';
import {
  listMadrasaAnnouncements,
  getMadrasaAnnouncement,
  markAnnouncementAsRead,
  markAllAnnouncementsAsRead,
  getMadrasaUnreadCount,
  getMadrasaLatestAnnouncements,
} from '../controllers/announcement.controller.js';
import {
  getActivePlans,
  getBankDetails,
  getMadrasaSubmissions,
  getMadrasaSubmissionReceipt,
  submitPaymentSubmission,
  uploadReceiptMiddleware,
} from '../controllers/subscription-payment.controller.js';
import {
  listSections,
  getSection,
  createSection,
  updateSection,
  activateSection,
  deactivateSection,
} from '../controllers/academic-section.controller.js';
import {
  listClasses,
  getClass,
  createClass,
  updateClass,
  activateClass,
  deactivateClass,
} from '../controllers/class.controller.js';
import {
  listStudents,
  getStudent,
  createStudent,
  updateStudent,
  activateStudent,
  inactivateStudent,
  archiveStudent,
  getFeeHistory,
  setFeeOverride,
  useClassDefault,
} from '../controllers/student.controller.js';
import {
  previewInvoices,
  generateInvoices,
  listInvoices,
  getInvoice,
  voidInvoice,
  getStudentInvoices,
} from '../controllers/invoice.controller.js';
import {
  createPayment,
  voidPayment,
  getStudentMonthlyLedger,
  getStudentUnpaidInvoices,
  searchStudentsForPOS,
  listPayments,
  getPayment,
  getReceipt,
  getStudentPayments,
} from '../controllers/payment.controller.js';
import {
  getPaidStudentsReport,
  getUnpaidStudentsReport,
  getPartialPaymentsReport,
  getOverdueStudentsReport,
  getOutstandingReport,
  getMonthlyCollectionReport,
  getSectionWiseCollectionReport,
  getClassWiseCollectionReport,
  getCashCollectionReport,
  getPaymentMethodSummaryReport,
  getPaymentHistoryReport,
  getMissingInvoicesReport,
  getStudentStatementReport,
} from '../controllers/report.controller.js';
import {
  listAssessments,
  createAssessment,
  getAssessment,
  updateAssessment,
  finalizeAssessment,
  reopenAssessment,
  addAssessmentSubject,
  removeAssessmentSubject,
  getAssessmentMarks,
  saveAssessmentMarks,
  getGpaSettings,
  updateGpaSettings,
  exportAllStudentsPdf,
  exportClassCsv,
  listSubjects,
  createSubject,
} from '../controllers/marking-hub.controller.js';
import {
  getDailyAttendance,
  saveDailyAttendance,
  getAttendanceHistory,
  getMonthlySummary,
  getStudentAttendance,
  exportDailyPdf,
  exportMonthlyPdf,
  exportDailyCsv,
  exportMonthlyCsv,
} from '../controllers/attendance.controller.js';
import {
  createUstadh,
  listUstadhs,
  getUstadh,
  updateUstadh,
  sendUstadhEmail,
  createSchedule,
  listSchedules,
  updateSchedule,
  deleteSchedule,
  getStaffAttendance,
  saveStaffAttendance,
  getStaffAttendanceHistory,
  getMonthlyStaffAttendanceSummary,
  generateSalaries,
  listSalaries,
  updateSalaryPayable,
  paySalary,
  exportSalarySlipPdf,
  sendSalaryEmail,
} from '../controllers/ustadh.controller.js';
import {
  getClassTimetable,
  getStaffTimetable,
  getFullTimetable,
  listBreaks,
  createBreak,
  updateBreak,
  deleteBreak,
  exportClassPdf,
  exportStaffPdf,
  exportFullPdf,
} from '../controllers/timetable.controller.js';
import {
  createCategory,
  updateCategory,
  listCategories,
  createExpense,
  updateExpense,
  voidExpense,
  listExpenses,
  upsertBudgets,
  getBudgets,
  upsertInsight,
  getMonthlySummary as getExpenseMonthlySummary,
  getCategoryComparison,
  getCostReview,
  getExpenseTrend,
  exportPdf,
  exportDetailedCsv,
  exportSummaryCsv,
} from '../controllers/expense-analysis.controller.js';
import {
  getSettings as getNotificationSettings,
  updateSettings as updateNotificationSettings,
  listJobs as listNotificationJobs,
  getJobById as getNotificationJobById,
  retryJob as retryNotificationJob,
  listPublications as listTimetablePublications,
  finalizeTimetable,
} from '../controllers/notification.controller.js';
import {
  uploadCertificateMiddleware,
  uploadEvidenceMiddleware,
  listStudentQualifications,
  createStudentQualification,
  updateStudentQualification,
  verifyOrRejectStudentQualification,
  getStudentQualificationCertificateUrl,
  deleteStudentQualification,
  listStudentIncidents,
  createStudentIncident,
  updateStudentIncident,
  getStudentIncidentEvidenceUrl,
  deleteStudentIncident,
  listStudentMeetings,
  createStudentMeeting,
  updateStudentMeeting,
  deleteStudentMeeting,
  listStudentFollowUps,
  createStudentFollowUp,
  updateStudentFollowUp,
  deleteStudentFollowUp,
  getMadrasaFollowUpsSummary,
  getStudentTimeline,
} from '../controllers/student-records.controller.js';
import {
  listEligibleStudents,
  createAlumniProfile,
  listMadrasaAlumni,
  getMadrasaAlumniDetails,
  updateAlumniProfile,
  recordConsent,
  renewConsent,
  withdrawConsent,
  publishAlumniProfile,
  unpublishAlumniProfile,
  revokeAlumniProfile,
  searchGlobalDirectory,
  getGlobalAlumniProfile,
  createVerificationRequest,
  listIncomingVerificationRequests,
  listOutgoingVerificationRequests,
  respondToVerificationRequest,
  streamAlumniCertificate,
  uploadConsentFileMiddleware,
} from '../controllers/alumni.controller.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';

// Rate limiter instances for Alumni Network
const alumniSearchLimiter = createRateLimiter({
  prefix: 'alumni_search',
  maxLimit: 30,
  windowMs: 60 * 1000, // 30 requests / 1 minute
});

const alumniProfileLimiter = createRateLimiter({
  prefix: 'alumni_profile',
  maxLimit: 60,
  windowMs: 60 * 1000, // 60 requests / 1 minute
});

const alumniVerificationLimiter = createRateLimiter({
  prefix: 'alumni_verify',
  maxLimit: 10,
  windowMs: 60 * 60 * 1000, // 10 requests / 1 hour
});


const router = Router();

/**
 * Global pipeline for all Madrasa Admin routes:
 * 1. authenticateToken: verifies JWT and active user status
 * 2. requirePasswordChanged: enforces mandatory password change
 * 3. requireMadrasaAdmin: restricts role strictly to MADRASA_ADMIN
 * 4. requireTenantContext: asserts and attaches trusted req.tenant.madrasaId
 */
router.use(authenticateToken);
router.use(requirePasswordChanged);
router.use(requireMadrasaAdmin);
router.use(requireTenantContext);

/**
 * Route: GET /api/madrasa-admin/subscription
 *
 * MANDATORY CORRECTION 1:
 * Exempt from requireActiveSubscription. Expired/suspended/cancelled Madrasa Admins
 * must be able to inspect subscription terms, days remaining, and historical payments.
 */
router.get('/subscription', getSubscription);
router.get('/subscription/plans', getActivePlans);
router.get('/subscription/bank-details', getBankDetails);
router.get('/subscription/payment-submissions', getMadrasaSubmissions);
router.get('/subscription/payment-submissions/:id/receipt', getMadrasaSubmissionReceipt);
router.post('/subscription/payment-submissions', uploadReceiptMiddleware, submitPaymentSubmission);

// Branding identity read is exempt from requireActiveSubscription so expired admins retain identity visibility
router.get('/branding', getBranding);

// In-App Platform Announcements (Exempt from requireActiveSubscription so all authenticated admins receive notices)
router.get('/announcements', listMadrasaAnnouncements);
router.get('/announcements/unread-count', getMadrasaUnreadCount);
router.get('/announcements/latest', getMadrasaLatestAnnouncements);
router.post('/announcements/mark-all-read', markAllAnnouncementsAsRead);
router.get('/announcements/:id', getMadrasaAnnouncement);
router.post('/announcements/:id/read', markAnnouncementAsRead);

/**
 * Business workspace routes: strictly gated by requireActiveSubscription.
 * Expired/unsubscribed tenants are rejected with 403 Forbidden.
 */
router.use(requireActiveSubscription);

// Core Workspace, Branding & Settings
router.get('/dashboard', getDashboard);
router.get('/settings', getSettings);
router.patch('/settings', updateSettings);
router.post('/branding/logo', uploadLogoMiddleware, uploadLogo);
router.delete('/branding/logo', removeLogo);
router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.get('/activity', getActivity);

// Madrasa Public Portal / Homepage CMS
router.get('/homepage-profile', getMyMadrasaProfile);
router.patch('/homepage-profile', updateMyMadrasaProfile);
router.post('/homepage-profile/hero-image', uploadHeroImageMiddleware, uploadHeroImage);
router.delete('/homepage-profile/hero-image', removeHeroImage);
router.post('/homepage-profile/poster', uploadPosterMiddleware, uploadPoster);
router.delete('/homepage-profile/poster/:fileId', removePoster);
router.post('/homepage-profile/event-images', uploadEventImagesMiddleware, uploadEventImages);
router.post('/homepage-profile/generate-summary', generateMadrasaSummary);
router.post('/homepage-profile/publish', publishMadrasaProfile);
router.post('/homepage-profile/unpublish', unpublishMadrasaProfile);
router.post('/homepage-profile/broadcast-notice', broadcastMadrasaNotice);

// Portal CMS Theme Customization
router.get('/portal-cms/theme', getTheme);
router.put('/portal-cms/theme/draft', saveDraft);
router.post('/portal-cms/theme/publish', publishTheme);
router.post('/portal-cms/theme/reset', resetTheme);
router.post('/portal-cms/theme/discard', discardTheme);

// Online Admissions & Applications Management
router.get('/admissions/periods', listPeriods);
router.post('/admissions/periods', createPeriod);
router.patch('/admissions/periods/:id/toggle', togglePeriod);
router.get('/admissions/applications', listApplications);
router.get('/admissions/applications/:id', getApplication);
router.patch('/admissions/applications/:id/status', reviewApplication);
router.post('/admissions/applications/:id/convert', convertApplication);

// Admissions Interview Management (Protected by requireFeature('ADMISSIONS_INTERVIEW'))
const interviewRouter = Router();
interviewRouter.use(requireFeature('ADMISSIONS_INTERVIEW'));

interviewRouter.get('/eligible-applicants', interviewController.getEligibleApplicants);
interviewRouter.post('/schedule', interviewController.createBulkSchedule);
interviewRouter.get('/appointments', interviewController.getAppointments);
interviewRouter.get('/appointments/:id', interviewController.getAppointmentById);
interviewRouter.post('/appointments/:id/reschedule', interviewController.rescheduleAppointment);
interviewRouter.post('/appointments/:id/cancel', interviewController.cancelAppointment);
interviewRouter.post('/appointments/:id/evaluate', interviewController.evaluateAppointment);
interviewRouter.get('/stats', interviewController.getDashboardStats);
interviewRouter.get('/history/:applicationId', interviewController.getApplicantHistory);
interviewRouter.get('/appointments/:id/preview-pdf', interviewController.previewPdf);
interviewRouter.get('/appointments/:id/download-pdf', interviewController.downloadPdf);
interviewRouter.post('/appointments/:id/send-email', interviewController.sendEmailNotification);
interviewRouter.post('/notifications/retry', interviewController.retryNotifications);
interviewRouter.post('/notifications/:notificationId/mark-delivered', interviewController.markUncertainDelivered);
interviewRouter.post('/notifications/:notificationId/confirm-failed', interviewController.confirmUncertainFailed);

router.use('/admissions/interviews', interviewRouter);

// Academic Structure: Sections Management
router.get('/academic-sections', listSections);
router.get('/academic-sections/:id', getSection);
router.post('/academic-sections', createSection);
router.patch('/academic-sections/:id', updateSection);
router.post('/academic-sections/:id/activate', activateSection);
router.post('/academic-sections/:id/deactivate', deactivateSection);

// Phase 8: Class Management
router.get('/classes', listClasses);
router.get('/classes/:id', getClass);
router.post('/classes', createClass);
router.patch('/classes/:id', updateClass);
router.post('/classes/:id/activate', activateClass);
router.post('/classes/:id/deactivate', deactivateClass);

// Phase 8: Student Management & Status Actions
router.get('/students', listStudents);
router.get('/students/:id', getStudent);
router.post('/students', createStudent);
router.patch('/students/:id', updateStudent);
router.post('/students/:id/activate', activateStudent);
router.post('/students/:id/inactivate', inactivateStudent);
router.post('/students/:id/archive', archiveStudent);

// Phase 8: Student Fee Overrides & History
router.get('/students/:id/fee-history', getFeeHistory);
router.post('/students/:id/fee-settings', setFeeOverride);
router.post('/students/:id/fee-settings/use-class-default', useClassDefault);

// Phase 9: Monthly Tuition Fee Invoice Engine
router.post('/invoices/preview', previewInvoices);
router.post('/invoices/generate', generateInvoices);
router.get('/invoices', listInvoices);
router.get('/invoices/:id', getInvoice);
router.post('/invoices/:id/void', voidInvoice);
router.get('/students/:id/invoices', getStudentInvoices);

// Phase 10: Fee Collection, POS, Payments, Receipts & Student Ledger
router.get('/students/:studentId/monthly-fees', getStudentMonthlyLedger);
router.get('/students/:studentId/unpaid-invoices', getStudentUnpaidInvoices);
router.get('/students/:studentId/payments', getStudentPayments);
router.get('/pos/search', searchStudentsForPOS);
router.post('/payments', createPayment);
router.get('/payments', listPayments);
router.get('/payments/:id', getPayment);
router.post('/payments/:id/void', voidPayment);
router.get('/receipts/:id', getReceipt);

// Fee Reports & Export Center
router.get('/reports/paid', getPaidStudentsReport);
router.get('/reports/unpaid', getUnpaidStudentsReport);
router.get('/reports/partial', getPartialPaymentsReport);
router.get('/reports/overdue', getOverdueStudentsReport);
router.get('/reports/outstanding', getOutstandingReport);
router.get('/reports/monthly-collection', getMonthlyCollectionReport);
router.get('/reports/section-collection', getSectionWiseCollectionReport);
router.get('/reports/class-collection', getClassWiseCollectionReport);
router.get('/reports/cash-collection', getCashCollectionReport);
router.get('/reports/payment-method-summary', getPaymentMethodSummaryReport);
router.get('/reports/payment-history', getPaymentHistoryReport);
router.get('/reports/missing-invoices', getMissingInvoicesReport);
router.get('/reports/student/:studentId/statement', getStudentStatementReport);

// Academic Subjects & Class-Based Marking Hub
router.get('/subjects', listSubjects);
router.post('/subjects', createSubject);

router.get('/marking-hub/assessments', listAssessments);
router.post('/marking-hub/assessments', createAssessment);
router.get('/marking-hub/assessments/:id', getAssessment);
router.patch('/marking-hub/assessments/:id', updateAssessment);
router.post('/marking-hub/assessments/:id/finalize', finalizeAssessment);
router.post('/marking-hub/assessments/:id/reopen', reopenAssessment);
router.post('/marking-hub/assessments/:id/subjects', addAssessmentSubject);
router.delete('/marking-hub/assessments/:id/subjects/:subjectId', removeAssessmentSubject);
router.get('/marking-hub/assessments/:id/marks', getAssessmentMarks);
router.put('/marking-hub/assessments/:id/marks', saveAssessmentMarks);
router.get('/marking-hub/assessments/:id/export/pdf', exportAllStudentsPdf);
router.get('/marking-hub/assessments/:id/export/csv', exportClassCsv);
router.get('/marking-hub/gpa-settings', getGpaSettings);
router.put('/marking-hub/gpa-settings', updateGpaSettings);

// Academic Attendance Module
router.get('/attendance', getDailyAttendance);
router.put('/attendance', saveDailyAttendance);
router.get('/attendance/history', getAttendanceHistory);
router.get('/attendance/monthly-summary', getMonthlySummary);
router.get('/attendance/students/:studentId', getStudentAttendance);
router.get('/attendance/export/daily/pdf', exportDailyPdf);
router.get('/attendance/export/monthly/pdf', exportMonthlyPdf);
router.get('/attendance/export/daily/csv', exportDailyCsv);
router.get('/attendance/export/monthly/csv', exportMonthlyCsv);

// Ustadh Management Module
router.post('/ustadhs', createUstadh);
router.get('/ustadhs', listUstadhs);
router.get('/ustadhs/:id', getUstadh);
router.patch('/ustadhs/:id', updateUstadh);
router.post('/ustadhs/:id/email', sendUstadhEmail);

// Weekly Schedules
router.post('/ustadh-schedules', createSchedule);
router.get('/ustadh-schedules', listSchedules);
router.patch('/ustadh-schedules/:id', updateSchedule);
router.delete('/ustadh-schedules/:id', deleteSchedule);

// Staff Attendance
router.get('/ustadh-attendance', getStaffAttendance);
router.put('/ustadh-attendance', saveStaffAttendance);
router.get('/ustadh-attendance/history', getStaffAttendanceHistory);
router.get('/ustadh-attendance/monthly-summary', getMonthlyStaffAttendanceSummary);

// Monthly Salaries
router.post('/ustadh-salaries/generate', generateSalaries);
router.get('/ustadh-salaries', listSalaries);
router.patch('/ustadh-salaries/:id', updateSalaryPayable);
router.post('/ustadh-salaries/:id/pay', paySalary);
router.get('/ustadh-salaries/:id/slip', exportSalarySlipPdf);
router.post('/ustadh-salaries/:id/send-email', sendSalaryEmail);

// Unified Timetable Module
router.get('/timetable/class', getClassTimetable);
router.get('/timetable/staff', getStaffTimetable);
router.get('/timetable/full', getFullTimetable);
router.get('/timetable/breaks', listBreaks);
router.post('/timetable/breaks', createBreak);
router.patch('/timetable/breaks/:id', updateBreak);
router.delete('/timetable/breaks/:id', deleteBreak);
router.get('/timetable/export/class/pdf', exportClassPdf);
router.get('/timetable/export/staff/pdf', exportStaffPdf);
router.get('/timetable/export/full/pdf', exportFullPdf);

// ==========================================
// Finance: Expense Analysis Module
// ==========================================
router.get('/expense-analysis/categories', listCategories);
router.post('/expense-analysis/categories', createCategory);
router.patch('/expense-analysis/categories/:id', updateCategory);

router.get('/expense-analysis/expenses', listExpenses);
router.post('/expense-analysis/expenses', createExpense);
router.patch('/expense-analysis/expenses/:id', updateExpense);
router.post('/expense-analysis/expenses/:id/void', voidExpense);

router.get('/expense-analysis/summary', getExpenseMonthlySummary);
router.get('/expense-analysis/comparison', getCategoryComparison);
router.get('/expense-analysis/cost-review', getCostReview);
router.get('/expense-analysis/trend', getExpenseTrend);

router.get('/expense-analysis/budgets', getBudgets);
router.put('/expense-analysis/budgets', upsertBudgets);

router.put('/expense-analysis/insights', upsertInsight);

router.get('/expense-analysis/export/pdf', exportPdf);
router.get('/expense-analysis/export/details.csv', exportDetailedCsv);
router.get('/expense-analysis/export/summary.csv', exportSummaryCsv);

// ==========================================
// Automatic Notification Engine & Logs
// ==========================================
router.get('/notifications/settings', getNotificationSettings);
router.patch('/notifications/settings', updateNotificationSettings);
router.get('/notifications/jobs', listNotificationJobs);
router.get('/notifications/jobs/:id', getNotificationJobById);
router.post('/notifications/jobs/:id/retry', retryNotificationJob);

// Madrasa Email Sender Settings
router.get('/settings/email-sender', getEmailSenderSettingsHandler);
router.put('/settings/email-sender', updateEmailSenderSettingsHandler);
router.post('/settings/email-sender/test', emailTestRateLimiter, testEmailSenderConnectionHandler);

// Timetable Publication & Finalization
router.get('/timetable/publications', listTimetablePublications);
router.post('/timetable/finalize', finalizeTimetable);

// ==========================================
// Student Qualifications, Discipline, Meetings, Follow-Ups & Timeline
// ==========================================
router.get('/students-follow-ups/summary', getMadrasaFollowUpsSummary);

router.get('/students/:studentId/qualifications', listStudentQualifications);
router.post('/students/:studentId/qualifications', uploadCertificateMiddleware, createStudentQualification);
router.patch('/students/:studentId/qualifications/:qualificationId', uploadCertificateMiddleware, updateStudentQualification);
router.post('/students/:studentId/qualifications/:qualificationId/verify', verifyOrRejectStudentQualification);
router.get('/students/:studentId/qualifications/:qualificationId/certificate', getStudentQualificationCertificateUrl);
router.delete('/students/:studentId/qualifications/:qualificationId', deleteStudentQualification);

router.get('/students/:studentId/incidents', listStudentIncidents);
router.post('/students/:studentId/incidents', uploadEvidenceMiddleware, createStudentIncident);
router.patch('/students/:studentId/incidents/:incidentId', uploadEvidenceMiddleware, updateStudentIncident);
router.get('/students/:studentId/incidents/:incidentId/evidence', getStudentIncidentEvidenceUrl);
router.delete('/students/:studentId/incidents/:incidentId', deleteStudentIncident);

router.get('/students/:studentId/meetings', listStudentMeetings);
router.post('/students/:studentId/meetings', createStudentMeeting);
router.patch('/students/:studentId/meetings/:meetingId', updateStudentMeeting);
router.delete('/students/:studentId/meetings/:meetingId', deleteStudentMeeting);

router.get('/students/:studentId/follow-ups', listStudentFollowUps);
router.post('/students/:studentId/follow-ups', createStudentFollowUp);
router.patch('/students/:studentId/follow-ups/:followUpId', updateStudentFollowUp);
router.delete('/students/:studentId/follow-ups/:followUpId', deleteStudentFollowUp);

router.get('/students/:studentId/timeline', getStudentTimeline);

// ==========================================
// Alumni & Academic Verification Network
// ==========================================
// 1. Institution Alumni Management
router.get('/alumni/eligible-students', listEligibleStudents);
router.get('/alumni', listMadrasaAlumni);
router.post('/alumni', createAlumniProfile);
router.get('/alumni/:alumniId', getMadrasaAlumniDetails);
router.patch('/alumni/:alumniId', updateAlumniProfile);
router.post('/alumni/:alumniId/consent', uploadConsentFileMiddleware, recordConsent);
router.post('/alumni/:alumniId/consent/renew', uploadConsentFileMiddleware, renewConsent);
router.post('/alumni/:alumniId/consent/withdraw', withdrawConsent);
router.post('/alumni/:alumniId/publish', publishAlumniProfile);
router.post('/alumni/:alumniId/unpublish', unpublishAlumniProfile);
router.post('/alumni/:alumniId/revoke', revokeAlumniProfile);

// 2. Global Alumni Directory (Rate-limited, tiered exposure)
router.get('/alumni-network/directory', alumniSearchLimiter, searchGlobalDirectory);
router.get('/alumni-network/directory/:indexNumber', alumniProfileLimiter, getGlobalAlumniProfile);

// 3. Academic Verification Hub
router.post('/alumni-network/verifications', alumniVerificationLimiter, createVerificationRequest);
router.get('/alumni-network/verifications/incoming', listIncomingVerificationRequests);
router.get('/alumni-network/verifications/outgoing', listOutgoingVerificationRequests);
router.post('/alumni-network/verifications/:requestId/respond', respondToVerificationRequest);

// 4. Secure Backend Streaming Proxy for Certificates
router.get('/alumni-network/:alumniId/qualifications/:qualificationId/certificate/stream', streamAlumniCertificate);

export default router;
