import { Router } from 'express';
import { authenticateToken, requirePasswordChanged } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/role.middleware.js';
import {
  getDashboard,
  listOnboardings,
  getOnboardingById,
  approveOnboarding,
  rejectOnboarding,
  resendOnboardingApprovalEmail,
  listMadrasas,
  getMadrasa,
  updateMadrasa,
  updateMadrasaStatus,
  activateMadrasa,
  suspendMadrasa,
  archiveMadrasa,
  resetMadrasaAdminPassword,
  toggleMadrasaAdminActive,
  getFeatureCatalogue,
  getPlanComparison,
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  updatePlanFeatures,
  activatePlan,
  deactivatePlan,
  getMadrasaSubscriptions,
  renewMadrasaSubscription,
  suspendSubscription,
  cancelSubscription,
  listActivityLogs,
} from '../controllers/super-admin.controller.js';
import {
  getAdminAboutUs,
  updateDraft,
  uploadHeroImageMiddleware,
  uploadHeroImage,
  removeHeroImage,
  uploadStoryImageMiddleware,
  uploadStoryImage,
  removeStoryImage,
  publishAboutUs,
  unpublishAboutUs,
} from '../controllers/about-us.controller.js';
import {
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
  unpublishAnnouncement,
  listSuperAdminAnnouncements,
  getSuperAdminAnnouncement,
} from '../controllers/announcement.controller.js';
import {
  listSubmissions,
  getSubmissionDetail,
  getSuperAdminReceipt,
  approveSubmission,
  rejectSubmission,
  getPlatformBank,
  updatePlatformBank,
} from '../controllers/subscription-payment.controller.js';
import {
  getAdminDraft as getAdminHomepageDraft,
  updateAdminDraft as updateAdminHomepageDraft,
  publishHomepage,
  unpublishHomepage,
  uploadHomepageImagesMiddleware,
  uploadHomepageImages,
  removeHomepageImage,
} from '../controllers/homepage.controller.js';

const router = Router();

// Enforce authentication, SUPER_ADMIN role, and password-change requirement
router.use(authenticateToken);
router.use(requireRoles('SUPER_ADMIN'));
router.use(requirePasswordChanged);

// 1. Dashboard
router.get('/dashboard', getDashboard);

// 2. Onboarding
router.get('/onboarding', listOnboardings);
router.get('/onboarding/:id', getOnboardingById);
router.post('/onboarding/:id/approve', approveOnboarding);
router.post('/onboarding/:id/reject', rejectOnboarding);
router.post('/onboarding/:id/resend-email', resendOnboardingApprovalEmail);

// 3. Madrasas
router.get('/madrasas', listMadrasas);
router.get('/madrasas/:id', getMadrasa);
router.patch('/madrasas/:id', updateMadrasa);
router.patch('/madrasas/:id/status', updateMadrasaStatus);
router.post('/madrasas/:id/activate', activateMadrasa);
router.post('/madrasas/:id/suspend', suspendMadrasa);
router.post('/madrasas/:id/archive', archiveMadrasa);

// 4. Madrasa Admin Management
router.post('/madrasas/:madrasaId/admins/:adminUserId/reset-password', resetMadrasaAdminPassword);
router.post('/madrasas/:madrasaId/admins/:adminUserId/toggle-active', toggleMadrasaAdminActive);

// 5. Features & Plans
router.get('/features', getFeatureCatalogue);
router.get('/plans/comparison', getPlanComparison);
router.get('/plans', listPlans);
router.get('/plans/:id', getPlan);
router.post('/plans', createPlan);
router.patch('/plans/:id', updatePlan);
router.put('/plans/:id/features', updatePlanFeatures);
router.post('/plans/:id/activate', activatePlan);
router.post('/plans/:id/deactivate', deactivatePlan);

// 6. Subscriptions
router.get('/madrasas/:madrasaId/subscriptions', getMadrasaSubscriptions);
router.post('/madrasas/:madrasaId/subscriptions/renew', renewMadrasaSubscription);
router.post('/subscriptions/:id/suspend', suspendSubscription);
router.post('/subscriptions/:id/cancel', cancelSubscription);

// 7. Activity Logs
router.get('/activity-logs', listActivityLogs);

// 8. Global About Us CMS
router.get('/about-us', getAdminAboutUs);
router.put('/about-us/draft', updateDraft);
router.post('/about-us/hero-image', uploadHeroImageMiddleware, uploadHeroImage);
router.post('/about-us/hero', uploadHeroImageMiddleware, uploadHeroImage);
router.delete('/about-us/hero-image', removeHeroImage);
router.delete('/about-us/hero', removeHeroImage);
router.post('/about-us/story-image', uploadStoryImageMiddleware, uploadStoryImage);
router.post('/about-us/story', uploadStoryImageMiddleware, uploadStoryImage);
router.delete('/about-us/story-image', removeStoryImage);
router.delete('/about-us/story', removeStoryImage);
router.post('/about-us/publish', publishAboutUs);
router.post('/about-us/unpublish', unpublishAboutUs);

// 9. In-App Announcement Center
router.get('/announcements', listSuperAdminAnnouncements);
router.get('/announcements/:id', getSuperAdminAnnouncement);
router.post('/announcements', createAnnouncement);
router.put('/announcements/:id', updateAnnouncement);
router.post('/announcements/:id/publish', publishAnnouncement);
router.post('/announcements/:id/archive', archiveAnnouncement);
router.post('/announcements/:id/unpublish', unpublishAnnouncement);

// 10. Subscription Payment Submissions & Bank Settings
router.get('/subscription-payments', listSubmissions);
router.get('/subscription-payments/:id', getSubmissionDetail);
router.get('/subscription-payments/:id/receipt', getSuperAdminReceipt);
router.post('/subscription-payments/:id/approve', approveSubmission);
router.post('/subscription-payments/:id/reject', rejectSubmission);
router.get('/platform-bank-details', getPlatformBank);
router.put('/platform-bank-details', updatePlatformBank);

// 11. Website Content (Homepage CMS)
router.get('/website-content/homepage', getAdminHomepageDraft);
router.put('/website-content/homepage', updateAdminHomepageDraft);
router.post('/website-content/homepage/publish', publishHomepage);
router.post('/website-content/homepage/unpublish', unpublishHomepage);
router.post('/website-content/homepage/images', uploadHomepageImagesMiddleware, uploadHomepageImages);
router.delete('/website-content/homepage/images/:fileId', removeHomepageImage);

export default router;
