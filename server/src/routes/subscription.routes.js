import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireMadrasaAdmin } from '../middleware/role.middleware.js';
import { requireTenantContext } from '../middleware/tenant.middleware.js';
import { getMySubscription } from '../controllers/subscription.controller.js';
import {
  getActivePlans,
  getBankDetails,
  getMadrasaSubmissions,
  submitPaymentSubmission,
  uploadReceiptMiddleware,
} from '../controllers/subscription-payment.controller.js';

const router = Router();

/**
 * GET /api/subscriptions/me
 *
 * Returns the current Madrasa's subscription summary and access status.
 * Intentionally NOT gated by requireActiveSubscription so that expired
 * administrators can check their subscription state, remaining days,
 * and renewal details.
 */
router.get(
  '/me',
  authenticateToken,
  requireMadrasaAdmin,
  requireTenantContext,
  getMySubscription
);

router.get(
  '/plans',
  authenticateToken,
  requireMadrasaAdmin,
  requireTenantContext,
  getActivePlans
);

router.get(
  '/bank-details',
  authenticateToken,
  requireMadrasaAdmin,
  requireTenantContext,
  getBankDetails
);

router.get(
  '/payment-submissions',
  authenticateToken,
  requireMadrasaAdmin,
  requireTenantContext,
  getMadrasaSubmissions
);

router.post(
  '/payment-submissions',
  authenticateToken,
  requireMadrasaAdmin,
  requireTenantContext,
  uploadReceiptMiddleware,
  submitPaymentSubmission
);

export default router;
