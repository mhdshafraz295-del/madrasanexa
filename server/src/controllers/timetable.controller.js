import { prisma } from '../lib/prisma.js';
import * as timetableService from '../services/timetable.service.js';
import {
  createBreakSchema,
  updateBreakSchema,
  getClassTimetableQuerySchema,
  getStaffTimetableQuerySchema,
  getFullTimetableQuerySchema,
  listBreaksQuerySchema,
} from '../validations/timetable.validation.js';

// ==========================================
// TIMETABLE VIEWS
// ==========================================

export async function getClassTimetable(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getClassTimetableQuerySchema.parse(req.query);
    const data = await timetableService.getClassTimetable(madrasaId, validated);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getStaffTimetable(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getStaffTimetableQuerySchema.parse(req.query);
    const data = await timetableService.getStaffTimetable(madrasaId, validated);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getFullTimetable(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getFullTimetableQuerySchema.parse(req.query);
    const data = await timetableService.getFullTimetable(madrasaId, validated);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// TIMETABLE BREAKS CRUD
// ==========================================

export async function listBreaks(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = listBreaksQuerySchema.parse(req.query);
    const data = await timetableService.listBreaks(madrasaId, validated);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createBreak(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = createBreakSchema.parse(req.body);
    const data = await timetableService.createBreak(madrasaId, userId, validated);
    res.status(201).json({ success: true, message: 'Timetable break created successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function updateBreak(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const validated = updateBreakSchema.parse(req.body);
    const data = await timetableService.updateBreak(madrasaId, id, userId, validated);
    res.json({ success: true, message: 'Timetable break updated successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function deleteBreak(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const result = await timetableService.deleteBreak(madrasaId, id, userId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ==========================================
// TIMETABLE PDF EXPORTS
// ==========================================

export async function exportClassPdf(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getClassTimetableQuerySchema.parse(req.query);
    const pdfBuffer = await timetableService.exportClassTimetablePdf(madrasaId, validated);

    // Look up canonical class name for professional file naming (Requirement 27)
    const targetClass = await prisma.class.findFirst({
      where: { id: validated.classId, madrasaId },
      select: { name: true, code: true },
    });
    const rawName = targetClass
      ? `${targetClass.name}${targetClass.code ? `-${targetClass.code}` : ''}`
      : validated.classId;
    const safeClassName = rawName.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
    const refDate = validated.referenceDate || new Date().toISOString().slice(0, 10);
    const filename = `${safeClassName}_Weekly-Timetable_${refDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function exportStaffPdf(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getStaffTimetableQuerySchema.parse(req.query);
    const pdfBuffer = await timetableService.exportStaffTimetablePdf(madrasaId, validated);

    let rawStaff = 'All-Staff';
    if (validated.ustadhId) {
      const u = await prisma.ustadh.findFirst({
        where: { id: validated.ustadhId, madrasaId },
        select: { fullName: true, ustadhCode: true },
      });
      if (u) rawStaff = `${u.fullName}-${u.ustadhCode}`;
    }
    const safeStaffName = rawStaff.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
    const refDate = validated.referenceDate || new Date().toISOString().slice(0, 10);
    const filename = `${safeStaffName}_Teaching-Timetable_${refDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function exportFullPdf(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const validated = getFullTimetableQuerySchema.parse(req.query);
    const pdfBuffer = await timetableService.exportFullTimetablePdf(madrasaId, validated);

    const refDate = validated.referenceDate || new Date().toISOString().slice(0, 10);
    const filename = `Full_Master_Timetable_${refDate}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}
