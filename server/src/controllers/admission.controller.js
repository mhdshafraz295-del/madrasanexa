import multer from 'multer';
import * as admissionService from '../services/admission.service.js';
import {
  createAdmissionPeriodSchema,
  submitApplicationSchema,
  reviewApplicationSchema,
  convertApplicationSchema,
} from '../validations/admission.validation.js';

// Multer upload config for supporting documents (max 5MB)
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

export const uploadDocumentMiddleware = (req, res, next) => {
  const single = docUpload.single('document');
  single(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Document file size must be smaller than 5 MB.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error.',
      });
    }
    next();
  });
};

// ==========================================
// PUBLIC CONTROLLERS
// ==========================================

export async function getPublicAdmissions(req, res, next) {
  try {
    const { slug } = req.params;
    const data = await admissionService.getPublicAdmissionsData(slug);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadPublicDocument(req, res, next) {
  try {
    const { slug } = req.params;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No document file provided. Please provide a file using field "document".',
      });
    }

    const result = await admissionService.uploadApplicationDocument(
      slug,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    return res.status(200).json({
      success: true,
      message: 'Document uploaded successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitApplication(req, res, next) {
  try {
    const { slug } = req.params;
    const validated = submitApplicationSchema.parse(req.body);

    const result = await admissionService.submitPublicApplication(slug, validated);

    return res.status(201).json({
      success: true,
      message: 'Admission application submitted successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// ==========================================
// ADMIN CONTROLLERS
// ==========================================

export async function listPeriods(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const periods = await admissionService.listAdmissionPeriods(madrasaId);
    return res.status(200).json({
      success: true,
      data: periods,
    });
  } catch (error) {
    next(error);
  }
}

export async function createPeriod(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId;
    const validated = createAdmissionPeriodSchema.parse(req.body);

    const period = await admissionService.createAdmissionPeriod(madrasaId, validated, userId);

    return res.status(201).json({
      success: true,
      message: 'Admission intake period created successfully.',
      data: period,
    });
  } catch (error) {
    next(error);
  }
}

export async function togglePeriod(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId;
    const { id } = req.params;

    const updated = await admissionService.toggleAdmissionPeriod(madrasaId, id, userId);

    return res.status(200).json({
      success: true,
      message: `Intake period is now ${updated.isOpen ? 'open' : 'closed'}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function listApplications(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const data = await admissionService.listApplications(madrasaId, req.query);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getApplication(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const { id } = req.params;

    const application = await admissionService.getApplicationById(madrasaId, id);

    return res.status(200).json({
      success: true,
      data: application,
    });
  } catch (error) {
    next(error);
  }
}

export async function reviewApplication(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId;
    const { id } = req.params;
    const validated = reviewApplicationSchema.parse(req.body);

    const updated = await admissionService.reviewApplication(madrasaId, id, validated, userId);

    return res.status(200).json({
      success: true,
      message: `Application status updated to ${updated.status}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function convertApplication(req, res, next) {
  try {
    const madrasaId = req.tenant.madrasaId;
    const userId = req.auth?.userId;
    const { id } = req.params;
    const validated = convertApplicationSchema.parse(req.body);

    const result = await admissionService.convertApplicationToStudent(madrasaId, id, validated, userId);

    return res.status(200).json({
      success: true,
      message: `Applicant successfully enrolled as active student (Admission No: ${result.student.admissionNo}).`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
