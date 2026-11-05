import { Router } from 'express';
import { handleSubmitOnboardingRequest } from '../controllers/onboarding.controller.js';
import { onboardingRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * Public Onboarding Submission Route
 * POST /api/onboarding/requests
 *
 * Submits an institution application for Super Admin review.
 * Protected by strict rate limiting.
 */
router.post('/requests', onboardingRateLimiter, handleSubmitOnboardingRequest);

export default router;
