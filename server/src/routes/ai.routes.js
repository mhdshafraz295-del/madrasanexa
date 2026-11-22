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
    fileSize: 10 * 1024 * 1024, // 10 MB limit for syllabus PDFs
    files: 1,
  },
});

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit for receipts
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const originalName = (file.originalname || '').toLowerCase();
    const hasValidExt = allowedExtensions.some((ext) => originalName.endsWith(ext));
    if (allowedMimeTypes.includes(file.mimetype) || hasValidExt) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Invalid file type. Only JPG, PNG, WebP, and PDF receipt files are allowed.'));
    }
  },
});

/**
 * Express middleware to handle single receipt file upload and catch Multer errors gracefully
 */
const handleReceiptUpload = (req, res, next) => {
  const singleUpload = receiptUpload.single('receipt');
  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Receipt file exceeds the 5 MB limit. Please upload a smaller image or PDF.',
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

// ==========================================
// Unlocked AI Assistant Workspace Tools
// (Guarded by requireActiveAiSubscription: Admin + Teacher)
// ==========================================
router.post(
  '/tools/chat',
  requireActiveAiSubscription,
  memoryUpload.single('file'),
  aiController.chatWithCopilot
);

router.post(
  '/tools/exam-paper',
  requireActiveAiSubscription,
  memoryUpload.single('file'),
  aiController.generateExamPaper
);

router.post(
  '/tools/lesson-plan',
  requireActiveAiSubscription,
  memoryUpload.single('file'),
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
