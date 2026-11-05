import { Router } from 'express';
import { getPublicAboutUs } from '../controllers/about-us.controller.js';
import { getPublicHomepage } from '../controllers/homepage.controller.js';
import { getPublicMadrasaProfile } from '../controllers/madrasa-profile.controller.js';
import {
  getPublicAdmissions,
  uploadDocumentMiddleware,
  uploadPublicDocument,
  submitApplication,
} from '../controllers/admission.controller.js';
import { admissionsUploadRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public Homepage & Active Plans composition
router.get('/homepage', getPublicHomepage);

// Public About Us endpoint
router.get('/about-us', getPublicAboutUs);

// Per-Madrasa Public Homepage Profile
router.get('/madrasa/:slug', getPublicMadrasaProfile);

// Per-Madrasa Public Admissions
router.get('/madrasa/:slug/admissions', getPublicAdmissions);
router.post('/madrasa/:slug/admissions/upload-document', admissionsUploadRateLimiter, uploadDocumentMiddleware, uploadPublicDocument);
router.post('/madrasa/:slug/admissions/apply', submitApplication);

export default router;
