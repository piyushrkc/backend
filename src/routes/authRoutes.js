// src/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');

// Register new user
router.post('/register', authLimiter, authController.register);

// Login user
router.post('/login', authLimiter, authController.login);

// Refresh access token
router.post('/refresh-token', authController.refreshToken);

// Get current user
router.get('/me', authenticate, authController.getCurrentUser);

// Logout user
router.post('/logout', authController.logout);

// Revoke all sessions (requires authentication)
router.post('/revoke-all-sessions', authenticate, authController.revokeAllSessions);

// Password reset flow (commented out until implemented)
// router.post('/forgot-password', authController.forgotPassword);
// router.patch('/reset-password/:token', authController.resetPassword);

// Email verification flow (commented out until implemented)
// router.post('/send-verification-email', authenticate, authController.sendVerificationEmail);
// router.get('/verify-email/:token', authController.verifyEmail);

module.exports = router;