import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/role.middleware.js';
import { requireAiEnabled } from '../middleware/ai-entitlement.middleware.js';
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
});

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
  receiptUpload.single('receipt'),
  aiController.submitSubscriptionReceipt
);

// ==========================================
// Unlocked AI Assistant Workspace Tools
// (Guarded by requireAiEnabled: Admin + Teacher)
// ==========================================
router.post(
  '/tools/chat',
  requireAiEnabled,
  memoryUpload.single('file'),
  aiController.chatWithCopilot
);

router.post(
  '/tools/exam-paper',
  requireAiEnabled,
  memoryUpload.single('file'),
  aiController.generateExamPaper
);

router.post(
  '/tools/lesson-plan',
  requireAiEnabled,
  memoryUpload.single('file'),
  aiController.generateLessonPlan
);

router.post(
  '/tools/poster',
  requireAiEnabled,
  aiController.generatePoster
);

router.post(
  '/tools/translate',
  requireAiEnabled,
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
