import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/role.middleware.js';
import { requireActiveAiSubscription, requireAiEnabled } from '../middleware/ai-entitlement.middleware.js';
import { BadRequestError } from '../utils/errors.js';
import * as aiController from '../controllers/ai.controller.js';

const router = Router();

// In-Memory Multer storage (Strict Zero Disk / Zero Cloud Storage for PDFs and Temporary processing)
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB limit for syllabus PDFs
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const originalName = (file.originalname || '').toLowerCase();
    if (
      mime.includes('pdf') ||
      mime === 'application/octet-stream' ||
      mime === '' ||
      originalName.endsWith('.pdf')
    ) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Invalid file type. Only PDF documents are allowed.'));
    }
  },
});

/**
 * Express middleware to handle single PDF document upload and catch Multer errors gracefully.
 * Supports field names 'file', 'pdf', 'document', or 'attachment' seamlessly.
 */
const handlePdfUpload = (req, res, next) => {
  const upload = memoryUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'pdf', maxCount: 1 },
    { name: 'document', maxCount: 1 },
    { name: 'attachment', maxCount: 1 },
  ]);
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'PDF file exceeds the 25 MB limit. Please upload a smaller document.',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'PDF upload error.',
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'PDF upload error.',
      });
    }

    if (req.files) {
      req.file =
        req.files['file']?.[0] ||
        req.files['pdf']?.[0] ||
        req.files['document']?.[0] ||
        req.files['attachment']?.[0] ||
        req.file;
    }
    next();
  });
};

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB limit for receipts
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const originalName = (file.originalname || '').toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const hasValidExt = allowedExtensions.some((ext) => originalName.endsWith(ext));
    if (
      mime.startsWith('image/') ||
      mime.includes('pdf') ||
      mime === 'application/octet-stream' ||
      mime === '' ||
      hasValidExt
    ) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Invalid file type. Only JPG, PNG, WebP, and PDF receipt files are allowed.'));
    }
  },
});

/**
 * Express middleware to handle single receipt file upload and catch Multer errors gracefully.
 * Supports field names 'receipt', 'file', or 'slip' seamlessly.
 */
const handleReceiptUpload = (req, res, next) => {
  const upload = receiptUpload.fields([
    { name: 'receipt', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'slip', maxCount: 1 },
  ]);
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Receipt file exceeds the 25 MB limit. Please upload a smaller image or PDF.',
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

    if (req.files) {
      req.file = req.files['receipt']?.[0] || req.files['file']?.[0] || req.files['slip']?.[0] || req.file;
    }
    next();
  });
};

// All AI routes require valid JWT authentication
router.use(authenticateToken);

// ==========================================
// Tenant Status & Subscription Monetization
// ==========================================
router.get(
  '/status',
  requireRoles('SUPER_ADMIN', 'MADRASA_ADMIN', 'TEACHER'),
  aiController.getAiStatus
);

router.post(
  '/subscription/submit-receipt',
  requireRoles('MADRASA_ADMIN'),
  handleReceiptUpload,
  aiController.submitSubscriptionReceipt
);

router.get(
  '/subscription/receipt/:id',
  requireRoles('SUPER_ADMIN', 'MADRASA_ADMIN'),
  aiController.getAiReceiptFile
);

// ==========================================
// Unlocked AI Assistant Workspace Tools
// (Guarded by requireActiveAiSubscription: Admin + Teacher)
// ==========================================
router.post(
  '/tools/chat',
  requireActiveAiSubscription,
  handlePdfUpload,
  aiController.chatWithCopilot
);

router.post(
  '/tools/exam-paper',
  requireActiveAiSubscription,
  handlePdfUpload,
  aiController.generateExamPaper
);

router.post(
  '/tools/lesson-plan',
  requireActiveAiSubscription,
  handlePdfUpload,
  aiController.generateLessonPlan
);

router.post(
  '/tools/poster',
  requireActiveAiSubscription,
  aiController.generatePoster
);

router.post(
  '/tools/translate',
  requireActiveAiSubscription,
  aiController.translateContent
);

// ==========================================
// Super Admin Approval & Management Panel
// ==========================================
router.get(
  '/admin/subscriptions',
  requireRoles('SUPER_ADMIN'),
  aiController.listAllAiSubscriptionRequests
);

router.post(
  '/admin/subscriptions/:id/approve',
  requireRoles('SUPER_ADMIN'),
  aiController.approveAiSubscriptionRequest
);

router.post(
  '/admin/subscriptions/:id/reject',
  requireRoles('SUPER_ADMIN'),
  aiController.rejectAiSubscriptionRequest
);

router.post(
  '/admin/madrasas/:madrasaId/toggle',
  requireRoles('SUPER_ADMIN'),
  aiController.toggleMadrasaAiAccess
);

router.get(
  '/admin/settings',
  requireRoles('SUPER_ADMIN'),
  aiController.getPlatformAiSettings
);

router.put(
  '/admin/settings',
  requireRoles('SUPER_ADMIN'),
  aiController.updatePlatformAiSettings
);

export default router;
