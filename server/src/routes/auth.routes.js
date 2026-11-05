import { Router } from 'express';
import { handleLogin, handleGetMe, handleChangePassword } from '../controllers/auth.controller.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

// Login endpoint with rate limiter focusing on failed attempts
router.post('/login', authRateLimiter, handleLogin);

// Protected session restoration endpoint
router.get('/me', authenticateToken, handleGetMe);

// Authenticated password change endpoint
router.post('/change-password', authenticateToken, handleChangePassword);

export default router;
