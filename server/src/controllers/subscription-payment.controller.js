import multer from 'multer';
import * as subscriptionPaymentService from '../services/subscription-payment.service.js';
import {
  createPaymentSubmissionSchema,
  rejectPaymentSubmissionSchema,
  updateBankDetailsSchema,
  listPaymentSubmissionsQuerySchema,
} from '../validations/subscription-payment.validation.js';
import { BadRequestError } from '../utils/errors.js';

// Multer memory storage configured with 5 MB hard limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,
  },
});

/**
 * Express middleware to handle single receipt file upload
 */
export const uploadReceiptMiddleware = (req, res, next) => {
  const singleUpload = upload.single('receipt');

  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Receipt file must be 5 MB or smaller.',
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: "Please upload a single file using the form field 'receipt'.",
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

/**
 * Madrasa Admin: GET /api/madrasa-admin/subscription/plans
 */
export async function getActivePlans(req, res, next) {
  try {
    const plans = await subscriptionPaymentService.getActiveSubscriptionPlans();
    return res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Madrasa Admin: GET /api/madrasa-admin/subscription/bank-details
 */
export async function getBankDetails(req, res, next) {
  try {
    const bankDetails = await subscriptionPaymentService.getPlatformBankDetails();
    return res.status(200).json({
      success: true,
      data: bankDetails,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Madrasa Admin: GET /api/madrasa-admin/subscription/payment-submissions
 */
export async function getMadrasaSubmissions(req, res, next) {
  try {
    const madrasaId = req.auth?.madrasaId || req.user?.madrasaId;
    if (!madrasaId) {
      throw new BadRequestError('Institution tenant context required.');
    }

    const submissions = await subscriptionPaymentService.listMadrasaSubmissions(madrasaId);
    return res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Madrasa Admin: POST /api/madrasa-admin/subscription/payment-submissions
 */
export async function submitPaymentSubmission(req, res, next) {
  try {
    const madrasaId = req.auth?.madrasaId || req.user?.madrasaId;
    const userId = req.auth?.userId || req.user?.id;

    if (!madrasaId) {
      throw new BadRequestError('Institution tenant context required.');
    }

    if (!req.file) {
      throw new BadRequestError('Payment receipt file is required. Please upload a valid JPG, PNG, WebP, or PDF receipt.');
    }

    const validated = createPaymentSubmissionSchema.parse(req.body);

    const result = await subscriptionPaymentService.createPaymentSubmission({
      madrasaId,
      userId,
      planId: validated.planId,
      submittedAmount: validated.submittedAmount,
      paymentDate: validated.paymentDate,
      reference: validated.reference,
      notes: validated.notes,
      file: {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(201).json({
      success: true,
      message: 'Payment submission received. Your payment receipt is pending review by platform administration.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: GET /api/super-admin/subscription-payments
 */
export async function listSubmissions(req, res, next) {
  try {
    const query = listPaymentSubmissionsQuerySchema.parse(req.query);
    const result = await subscriptionPaymentService.listSuperAdminSubmissions(query);
    return res.status(200).json({
      success: true,
      data: result.submissions,
      pagination: result.pagination,
      kpis: result.counts || result.kpis,
      counts: result.counts,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: GET /api/super-admin/subscription-payments/:id
 */
export async function getSubmissionDetail(req, res, next) {
  try {
    const submission = await subscriptionPaymentService.getSubmissionDetail(req.params.id);
    return res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: GET /api/super-admin/subscription-payments/:id/receipt
 * Resolves short-lived presigned receipt URL on demand with RBAC authorization
 */
export async function getSuperAdminReceipt(req, res, next) {
  try {
    const result = await subscriptionPaymentService.getSuperAdminReceiptUrl(req.params.id);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Madrasa Admin: GET /api/madrasa-admin/subscription/payment-submissions/:id/receipt
 * Resolves short-lived presigned receipt URL strictly for tenant's own submission
 */
export async function getMadrasaSubmissionReceipt(req, res, next) {
  try {
    const madrasaId = req.auth?.madrasaId || req.tenant?.madrasaId || req.user?.madrasaId;
    if (!madrasaId) {
      throw new BadRequestError('Institution tenant context required.');
    }

    const result = await subscriptionPaymentService.getMadrasaReceiptUrl(req.params.id, madrasaId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: POST /api/super-admin/subscription-payments/:id/approve
 */
export async function approveSubmission(req, res, next) {
  try {
    const userId = req.auth?.userId || req.user?.id;
    const result = await subscriptionPaymentService.approvePaymentSubmission(
      req.params.id,
      userId,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: POST /api/super-admin/subscription-payments/:id/reject
 */
export async function rejectSubmission(req, res, next) {
  try {
    const validated = rejectPaymentSubmissionSchema.parse(req.body);
    const userId = req.auth?.userId || req.user?.id;

    const result = await subscriptionPaymentService.rejectPaymentSubmission(
      req.params.id,
      userId,
      validated.rejectionReason,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: GET /api/super-admin/platform-bank-details
 */
export async function getPlatformBank(req, res, next) {
  try {
    const setting = await subscriptionPaymentService.getPlatformBankDetails();
    return res.status(200).json({
      success: true,
      data: setting,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: PUT /api/super-admin/platform-bank-details
 */
export async function updatePlatformBank(req, res, next) {
  try {
    const validated = updateBankDetailsSchema.parse(req.body);
    const userId = req.auth?.userId || req.user?.id;
    const result = await subscriptionPaymentService.updatePlatformBankDetails(
      validated,
      userId,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Platform bank account configuration updated successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
