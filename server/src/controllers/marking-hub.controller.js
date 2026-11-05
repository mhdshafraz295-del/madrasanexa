import * as markingHubService from '../services/marking-hub.service.js';
import * as subjectService from '../services/subject.service.js';
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  addSubjectSchema,
  saveMarksSchema,
  gpaSettingsSchema,
} from '../validations/marking-hub.validation.js';
import { logTenantActivity } from '../services/tenant.service.js';

export async function listAssessments(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { classId, academicYear, term } = req.query;
    const items = await markingHubService.listAssessments(madrasaId, { classId, academicYear, term });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function createAssessment(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = createAssessmentSchema.parse(req.body);
    const assessment = await markingHubService.createAssessment(madrasaId, userId, validated);
    res.status(201).json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
}

export async function getAssessment(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id } = req.params;
    const assessment = await markingHubService.getAssessment(madrasaId, id);
    res.json({ success: true, data: assessment });
  } catch (error) {
    next(error);
  }
}

export async function updateAssessment(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id } = req.params;
    const validated = updateAssessmentSchema.parse(req.body);
    const updated = await markingHubService.updateAssessment(madrasaId, id, validated);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function finalizeAssessment(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const finalized = await markingHubService.finalizeAssessment(madrasaId, userId, id);
    res.json({ success: true, data: finalized, message: 'Assessment finalized successfully.' });
  } catch (error) {
    next(error);
  }
}

export async function reopenAssessment(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const reopened = await markingHubService.reopenAssessment(madrasaId, userId, id);
    res.json({ success: true, data: reopened, message: 'Assessment reopened successfully.' });
  } catch (error) {
    next(error);
  }
}

export async function addAssessmentSubject(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id } = req.params;
    const validated = addSubjectSchema.parse(req.body);
    const subject = await markingHubService.addAssessmentSubject(madrasaId, id, validated);
    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    next(error);
  }
}

export async function removeAssessmentSubject(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id, subjectId } = req.params;
    const force = req.query.force === 'true';
    const result = await markingHubService.removeAssessmentSubject(madrasaId, id, subjectId, { force });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getAssessmentMarks(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id } = req.params;
    const data = await markingHubService.getAssessmentMarks(madrasaId, id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function saveAssessmentMarks(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const { id } = req.params;
    const validated = saveMarksSchema.parse(req.body);
    const data = await markingHubService.saveAssessmentMarks(madrasaId, userId, id, validated.marks);
    res.json({ success: true, data, message: 'Marks saved successfully.' });
  } catch (error) {
    next(error);
  }
}

export async function getGpaSettings(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const bands = await markingHubService.getGpaSettings(madrasaId);
    res.json({ success: true, data: bands });
  } catch (error) {
    next(error);
  }
}

export async function updateGpaSettings(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId || req.user?.id;
    const validated = gpaSettingsSchema.parse(req.body);
    const bands = await markingHubService.updateGpaSettings(madrasaId, userId, validated.bands);
    res.json({ success: true, data: bands, message: 'GPA settings updated successfully.' });
  } catch (error) {
    next(error);
  }
}

export async function exportAllStudentsPdf(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id } = req.params;
    const assessment = await markingHubService.getAssessment(madrasaId, id);

    const pdfBuffer = await markingHubService.generateAllStudentsPdf(madrasaId, id);

    const safeName = (assessment.name || 'Assessment').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeClass = (assessment.class?.name || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `MadrasaNexa_${safeClass}_${safeName}_All-Student-Reports.pdf`;

    // Audit log
    logTenantActivity({
      madrasaId,
      userId: req.auth?.userId || req.user?.id,
      action: 'MARKING_PDF_EXPORTED',
      entityType: 'MarkingAssessment',
      entityId: id,
      metadata: { filename },
    }).catch(() => {});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

export async function exportClassCsv(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id } = req.params;
    const assessment = await markingHubService.getAssessment(madrasaId, id);

    const csvString = await markingHubService.generateClassCsv(madrasaId, id);

    const safeName = (assessment.name || 'Assessment').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeClass = (assessment.class?.name || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `MadrasaNexa_${safeClass}_${safeName}_Full-Class.csv`;

    // Audit log
    logTenantActivity({
      madrasaId,
      userId: req.auth?.userId || req.user?.id,
      action: 'MARKING_CSV_EXPORTED',
      entityType: 'MarkingAssessment',
      entityId: id,
      metadata: { filename },
    }).catch(() => {});

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(csvString, 'utf8'));
  } catch (error) {
    next(error);
  }
}

export async function listSubjects(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { search, isActive } = req.query;
    const subjects = await subjectService.listSubjects(madrasaId, {
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
    res.json({ success: true, data: subjects });
  } catch (error) {
    next(error);
  }
}

export async function createSubject(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { name, code, description } = req.body;
    const subject = await subjectService.createSubject(madrasaId, { name, code, description });
    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    next(error);
  }
}
