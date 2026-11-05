import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import subscriptionRoutes from './subscription.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import superAdminRoutes from './super-admin.routes.js';
import madrasaAdminRoutes from './madrasa-admin.routes.js';
import publicRoutes from './public.routes.js';

const router = Router();

// Mount routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/super-admin', superAdminRoutes);
router.use('/madrasa-admin', madrasaAdminRoutes);
router.use('/public', publicRoutes);

export default router;
