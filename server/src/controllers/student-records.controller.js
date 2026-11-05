import multer from 'multer';
import * as studentRecordsService from '../services/student-records.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB hard limit
    files: 1,
  },
});

function createSingleFileUploadMiddleware(fieldName, label) {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    singleUpload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `${label} file must be 5 MB or smaller.`,
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: `Please upload a single file using the form field '${fieldName}'.`,
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error.',
        });
      }
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error.',
        });
      }
      next();
    });
  };
}

export const uploadCertificateMiddleware = createSingleFileUploadMiddleware(
  'certificate',
  'Certificate'
);

export const uploadEvidenceMiddleware = createSingleFileUploadMiddleware(
  'evidence',
  'Evidence'
);

function getAuditContext(req) {
  return {
    userId: req.auth?.userId || req.user?.id || null,
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null,
  };
}

// ============================================================================
// 1. Qualifications & Certificates
// ============================================================================

export async function listStudentQualifications(req, res, next) {
  try {
    const result = await studentRecordsService.listStudentQualifications(
      req.tenant.madrasaId,
      req.params.studentId,
      req.query
    );
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function createStudentQualification(req, res, next) {
  try {
    const record = await studentRecordsService.createStudentQualification(
      req.tenant.madrasaId,
      req.params.studentId,
      req.body,
      req.file || null,
      getAuditContext(req)
    );
    return res.status(201).json({
      success: true,
      message: 'Qualification record created successfully.',
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStudentQualification(req, res, next) {
  try {
    const record = await studentRecordsService.updateStudentQualification(
      req.tenant.madrasaId,
      req.params.studentId,
      req.params.qualificationId,
      req.body,
      req.file || null,
      getAuditContext(req)
    );
    return res.status(200).json({
      success: true,
      message: 'Qualification record updated successfully.',
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyOrRejectStudentQualification(req, res, next) {
  try {
    const record = await studentRecordsService.verifyOrRejectStudentQualification(
      req.tenant.madrasaId,
      req.params.studentId,
      req.params.qualificationId,
      req.body,
      getAuditContext(req)
    );
    return res.status(200).json({
      success: true,
      message: `Certificate verification status updated to ${record.verificationStatus}.`,
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

export async function getStudentQualificationCertificateUrl(req, res, next) {
  try {
    const result = await studentRecordsService.getStudentQualificationCertificateUrl(
      req.tenant.madrasaId,
      req.params.studentId,
      req.params.qualificationId,
      req.query,
      getAuditContext(req)
    );
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteStudentQualification(req, res, next) {
  try {
    const result = await studentRecordsService.deleteStudentQualification(
      req.tenant.madrasaId,
      req.params.studentId,
      req.params.qualificationId,
      getAuditContext(req)
    );
    return res.status(200).json({
      success: true,
      message: 'Qualification record deleted.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 2. Discipline & Incident Records
// ============================================================================

export async function listStudentIncidents(req, res, next) {
  try {
    const result = await studentRecordsService.listStudentIncidents(
      req.tenant.madrasaId,
      req.params.studentId,
      req.query
    );
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function createStudentIncident(req, res, next) {
  try {
    const record = await studentRecordsService.createStudentIncident(
      req.tenant.madrasaId,
      req.params.studentId,
      req.body,
      req.file || null,
      getAuditContext(req)
    );
    return res.status(201).json({
      success: true,
      message: 'Incident record created successfully.',
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStudentIncident(req, res, next) {
  try {
    const record = await studentRecordsService.updateStudentIncident(
      req.tenant.madrasaId,
      req.params.studentId,
      req.params.incidentId,
      req.body,
      req.file || null,
      getAuditContext(req)
    );
    return res.status(200).json({
      success: true,
      message: 'Incident record updated successfully.',
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

export async function getStudentIncidentEvidenceUrl(req, res, next) {
  try {
    const result = await studentRecordsService.getStudentIncidentEvidenceUrl(
      req.tenant.madrasaId,
      req.params.studentId,
      req.params.incidentId,
      req.query,
      getAuditContext(req)
    );
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteStudentIncident(req, res, next) {
  try {
    const result = await studentRecordsService.deleteStudentIncident(
      req.tenant.madrasaId,
      req.params.studentId,
      req.params.incidentId,
      getAuditContext(req)
    );
    return res.status(200).json({
      success: true,
      message: 'Incident record deleted.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 3. Student & Guardian Meetings
// ============================================================================

export async function listStudentMeetings(req, res, next) {
  try {
    const result = await studentRecordsService.listStudentMeetings(
      req.tenant.madrasaId,
      req.params.studentId,
      req.query
    );
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function createStudentMeeting(req, res, next) {
  try {
    const record = await studentRecordsService.createStudentMeeting(
      req.tenant.madrasaId,
      req.params.studentId,
      req.body,
      getAuditContext(req)
    );
    return res.status(201).json({
      success: true,
      message: 'Meeting record created successfully.',
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStudentMeeting(req, res, next) {
  try {
    const record = await studentRecordsService.updateStudentMeeting(
      req.tenant.madrasaId,
      req.params.studentId,
      req.params.meetingId,
      req.body,
      getAuditContext(req)
    );
    return res.status(200).json({
      success: true,
      message: 'Meeting record updated successfully.',
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteStudentMeeting(req, res, next) {
  try {
    const result = await studentRecordsService.deleteStudentMeeting(
      req.tenant.madrasaId,
      req.params.studentId,
      req.params.meetingId,
      getAuditContext(req)
    );
    return res.status(200).json({
      success: true,
      message: 'Meeting record deleted.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 4. Student Follow-Ups & Reminders
// ============================================================================

export async function listStudentFollowUps(req, res, next) {
  try {
    const result = await studentRecordsService.listStudentFollowUps(
      req.tenant.madrasaId,
      req.params.studentId,
      req.query
    );
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function createStudentFollowUp(req, res, next) {
  try {
    const record = await studentRecordsService.createStudentFollowUp(
      req.tenant.madrasaId,
      req.params.studentId,
      req.body,
      getAuditContext(req)
    );
    return res.status(201).json({
      success: true,
      message: 'Follow-up scheduled successfully.',
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStudentFollowUp(req, res, next) {
  try {
    const record = await studentRecordsService.updateStudentFollowUp(
      req.tenant.madrasaId,
      req.params.studentId,
      req.params.followUpId,
      req.body,
      getAuditContext(req)
    );
    return res.status(200).json({
      success: true,
      message: 'Follow-up updated successfully.',
      data: record,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteStudentFollowUp(req, res, next) {
  try {
    const result = await studentRecordsService.deleteStudentFollowUp(
      req.tenant.madrasaId,
      req.params.studentId,
      req.params.followUpId,
      getAuditContext(req)
    );
    return res.status(200).json({
      success: true,
      message: 'Follow-up deleted.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMadrasaFollowUpsSummary(req, res, next) {
  try {
    const summary = await studentRecordsService.getMadrasaFollowUpsSummary(
      req.tenant.madrasaId
    );
    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================================
// 5. Student Chronological Timeline
// ============================================================================

export async function getStudentTimeline(req, res, next) {
  try {
    const timeline = await studentRecordsService.getStudentTimeline(
      req.tenant.madrasaId,
      req.params.studentId,
      req.query
    );
    return res.status(200).json({
      success: true,
      data: timeline,
    });
  } catch (err) {
    next(err);
  }
}
