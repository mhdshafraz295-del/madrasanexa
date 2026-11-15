import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { requireTenantContext } from '../middleware/tenant.middleware.js';
import { requireActiveSubscription } from '../middleware/subscription.middleware.js';
import { requireMadrasaAdmin } from '../middleware/role.middleware.js';
import {
  scanGateCard,
  listGateEvents,
  getGateSettings,
  updateGateSettings,
} from '../controllers/gate.controller.js';

const router = Router();

/**
 * Gate Module Security Invariants:
 * 1. authenticateToken: Live verification of valid JWT and active user status.
 * 2. requireTenantContext: Derives immutable tenant context exclusively from req.auth.madrasaId.
 * 3. requireActiveSubscription: Enforces active subscription status for tenant operations.
 */
router.use(authenticateToken);
router.use(requireTenantContext);
router.use(requireActiveSubscription);

/**
 * POST /api/gate/scan
 * Operator scan card at school gate (ENTRY or EXIT)
 */
router.post('/scan', scanGateCard);

/**
 * GET /api/gate/events
 * Paginated query for gate movement and email outbox events
 */
router.get('/events', listGateEvents);

/**
 * GET /api/gate/settings
 * Institutional gate settings
 */
router.get('/settings', getGateSettings);

/**
 * PATCH /api/gate/settings
 * Update institutional gate settings (Admin privileges strictly enforced)
 */
router.patch('/settings', requireMadrasaAdmin, updateGateSettings);

export default router;
