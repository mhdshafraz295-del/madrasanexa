import * as ustadhService from '../services/ustadh.service.js';
import * as scheduleService from '../services/ustadh-schedule.service.js';
import * as attendanceService from '../services/ustadh-attendance.service.js';
import * as salaryService from '../services/ustadh-salary.service.js';
import {
  createUstadhSchema,
  updateUstadhSchema,
  createScheduleSchema,
  updateScheduleSchema,
  getAttendanceSchema,
  saveStaffAttendanceSchema,
  getAttendanceHistorySchema,
  getMonthlyAttendanceSummarySchema,
  generateSalariesSchema,
  getSalariesSchema,
  updateSalaryPayableSchema,
  paySalarySchema,
  sendUstadhEmailSchema,
  sendSalaryEmailSchema,
} from '../validations/ustadh.validation.js';

// ==========================================
// USTADH PROFILES
// ==========================================

export async function createUstadh(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = createUstadhSchema.parse(req.body);
    const data = await ustadhService.createUstadh(madrasaId, userId, validated);
    res.status(201).json({ success: true, message: 'Ustadh created successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function listUstadhs(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const data = await ustadhService.listUstadhs(madrasaId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getUstadh(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id } = req.params;
    const data = await ustadhService.getUstadhById(madrasaId, id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateUstadh(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const validated = updateUstadhSchema.parse(req.body);
    const data = await ustadhService.updateUstadh(madrasaId, id, userId, validated);
    res.json({ success: true, message: 'Ustadh updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function sendUstadhEmail(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const validated = sendUstadhEmailSchema.parse(req.body);
    const data = await salaryService.sendDirectEmail(madrasaId, id, userId, validated);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// WEEKLY TEACHING SCHEDULES
// ==========================================

export async function createSchedule(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = createScheduleSchema.parse(req.body);
    const data = await scheduleService.createSchedule(madrasaId, userId, validated);
    res.status(201).json({ success: true, message: 'Schedule session created successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function listSchedules(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const data = await scheduleService.listSchedules(madrasaId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateSchedule(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const validated = updateScheduleSchema.parse(req.body);
    const data = await scheduleService.updateSchedule(madrasaId, id, userId, validated);
    res.json({ success: true, message: 'Schedule updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function deleteSchedule(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const data = await scheduleService.deleteOrDeactivateSchedule(madrasaId, id, userId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ==========================================
// STAFF ATTENDANCE
// ==========================================

export async function getStaffAttendance(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getAttendanceSchema.parse(req.query);
    const data = await attendanceService.getStaffDailyAttendance(madrasaId, validated.date);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function saveStaffAttendance(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = saveStaffAttendanceSchema.parse(req.body);
    const data = await attendanceService.saveStaffDailyAttendance(madrasaId, userId, validated);
    res.json({ success: true, message: 'Staff attendance recorded successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function getStaffAttendanceHistory(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getAttendanceHistorySchema.parse(req.query);
    const data = await attendanceService.getAttendanceHistory(madrasaId, validated);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMonthlyStaffAttendanceSummary(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getMonthlyAttendanceSummarySchema.parse(req.query);
    const data = await attendanceService.getMonthlyAttendanceSummary(madrasaId, validated);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// MONTHLY SALARIES
// ==========================================

export async function generateSalaries(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = generateSalariesSchema.parse(req.body);
    const data = await salaryService.generateMonthlySalaries(madrasaId, userId, validated.month);
    res.json({ success: true, message: 'Salaries loaded/generated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function listSalaries(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getSalariesSchema.parse(req.query);
    const data = await salaryService.getSalaries(madrasaId, validated);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateSalaryPayable(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const validated = updateSalaryPayableSchema.parse(req.body);
    const data = await salaryService.updateSalaryPayable(madrasaId, id, userId, validated);
    res.json({ success: true, message: 'Payable amount updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function paySalary(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const validated = paySalarySchema.parse(req.body);
    const result = await salaryService.paySalary(madrasaId, id, userId, validated);
    res.json({
      success: true,
      message: result.alreadyPaid ? 'Salary is already recorded as paid.' : 'Salary payment recorded successfully.',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export async function exportSalarySlipPdf(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id } = req.params;
    const pdfBuffer = await salaryService.generateSalarySlipPdf(madrasaId, id);

    const filename = `Salary_Slip_${id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function sendSalaryEmail(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const validated = sendSalaryEmailSchema.parse(req.body || {});
    const result = await salaryService.sendSalaryPaymentEmail(madrasaId, id, userId, validated);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
