import * as attendanceService from '../services/attendance.service.js';
import {
  getDailyAttendanceSchema,
  saveDailyAttendanceSchema,
  getAttendanceHistorySchema,
  getMonthlySummarySchema,
  getStudentAttendanceSchema,
  verifyScanTokenSchema,
  ingestScannedAttendanceSchema,
  verifyAdmissionBarcodeSchema,
  ingestAdmissionBarcodeSchema,
} from '../validations/attendance.validation.js';
import { logTenantActivity } from '../services/tenant.service.js';

export async function getDailyAttendance(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getDailyAttendanceSchema.parse(req.query);
    const data = await attendanceService.getClassDailyAttendance(madrasaId, validated);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function saveDailyAttendance(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = saveDailyAttendanceSchema.parse(req.body);
    const data = await attendanceService.saveClassDailyAttendance(madrasaId, userId, validated);
    res.json({
      success: true,
      message: 'Attendance saved successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyScanToken(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = verifyScanTokenSchema.parse(req.body);
    const data = await attendanceService.verifyScanTokenForAttendance({
      madrasaId,
      token: validated.token,
      classId: validated.classId,
      date: validated.date,
      academicYear: validated.academicYear,
    });

    // Enforce anti-caching for sensitive token verification responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      message: 'Student scan verified successfully.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function ingestScannedAttendance(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = ingestScannedAttendanceSchema.parse(req.body);
    const data = await attendanceService.ingestScannedAttendanceRecord({
      madrasaId,
      userId,
      token: validated.token,
      classId: validated.classId,
      date: validated.date,
      academicYear: validated.academicYear,
      status: validated.status,
      overwrite: validated.overwrite,
      reason: validated.reason,
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      message: data.message,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyAdmissionBarcode(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = verifyAdmissionBarcodeSchema.parse(req.body);
    const data = await attendanceService.verifyAdmissionBarcodeForAttendance({
      madrasaId,
      userId,
      admissionNo: validated.admissionNo,
      classId: validated.classId,
      date: validated.date,
      academicYear: validated.academicYear,
      overwrite: validated.overwrite,
      reason: validated.reason,
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      message: 'Student barcode verified successfully via 1D fallback.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function ingestAdmissionBarcode(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = ingestAdmissionBarcodeSchema.parse(req.body);
    const data = await attendanceService.ingestAdmissionBarcodeAttendanceRecord({
      madrasaId,
      userId,
      admissionNo: validated.admissionNo,
      classId: validated.classId,
      date: validated.date,
      academicYear: validated.academicYear,
      status: validated.status,
      overwrite: validated.overwrite,
      reason: validated.reason,
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      message: data.message,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAttendanceHistory(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getAttendanceHistorySchema.parse(req.query);
    const data = await attendanceService.getAttendanceHistory(madrasaId, validated);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getMonthlySummary(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getMonthlySummarySchema.parse(req.query);
    const data = await attendanceService.getMonthlySummary(madrasaId, validated);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getStudentAttendance(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { studentId } = req.params;
    const validated = getStudentAttendanceSchema.parse(req.query);
    const data = await attendanceService.getStudentAttendanceSummary(madrasaId, studentId, validated);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function exportDailyPdf(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getDailyAttendanceSchema.parse(req.query);
    const pdfBuffer = await attendanceService.generateDailyAttendancePdf(madrasaId, validated);

    const safeDate = validated.date.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Attendance_${safeDate}.pdf`;

    logTenantActivity({
      madrasaId,
      userId: req.auth?.userId || req.user?.id,
      action: 'ATTENDANCE_DAILY_PDF_EXPORTED',
      entityType: 'AttendanceSession',
      entityId: validated.classId,
      metadata: { date: validated.date, filename },
    }).catch(() => {});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

export async function exportMonthlyPdf(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getMonthlySummarySchema.parse(req.query);
    const pdfBuffer = await attendanceService.generateMonthlyAttendancePdf(madrasaId, validated);

    const safeMonth = validated.month.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Attendance_Monthly_${safeMonth}.pdf`;

    logTenantActivity({
      madrasaId,
      userId: req.auth?.userId || req.user?.id,
      action: 'ATTENDANCE_MONTHLY_PDF_EXPORTED',
      entityType: 'AttendanceSession',
      entityId: validated.classId,
      metadata: { month: validated.month, filename },
    }).catch(() => {});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

export async function exportDailyCsv(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getDailyAttendanceSchema.parse(req.query);
    const csvString = await attendanceService.generateDailyAttendanceCsv(madrasaId, validated);

    const safeDate = validated.date.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Attendance_${safeDate}.csv`;

    logTenantActivity({
      madrasaId,
      userId: req.auth?.userId || req.user?.id,
      action: 'ATTENDANCE_DAILY_CSV_EXPORTED',
      entityType: 'AttendanceSession',
      entityId: validated.classId,
      metadata: { date: validated.date, filename },
    }).catch(() => {});

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(csvString, 'utf8'));
  } catch (error) {
    next(error);
  }
}

export async function exportMonthlyCsv(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getMonthlySummarySchema.parse(req.query);
    const csvString = await attendanceService.generateMonthlyAttendanceCsv(madrasaId, validated);

    const safeMonth = validated.month.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Attendance_Monthly_${safeMonth}.csv`;

    logTenantActivity({
      madrasaId,
      userId: req.auth?.userId || req.user?.id,
      action: 'ATTENDANCE_MONTHLY_CSV_EXPORTED',
      entityType: 'AttendanceSession',
      entityId: validated.classId,
      metadata: { month: validated.month, filename },
    }).catch(() => {});

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(csvString, 'utf8'));
  } catch (error) {
    next(error);
  }
}
