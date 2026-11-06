const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { verifyRecaptcha } = require('../middleware/recaptcha');

// Public Auth Endpoints
router.post('/login', verifyRecaptcha, authController.login);
router.post('/logout', authController.logout);
router.post('/request-reset', verifyRecaptcha, authController.requestPasswordReset);
router.get('/reset-password', authController.verifyResetToken);
router.post('/reset-password', authController.resetPassword);
router.get('/accept-invitation', authController.verifyInvitationToken);
router.post('/accept-invitation', authController.acceptInvitation);

// Google OAuth
router.get('/google', authController.googleRedirect);
router.get('/google/callback', authController.googleCallback);

// Authenticated User Info
router.get('/me', authenticateToken, authController.getMe);
router.get('/check-session', authenticateToken, authController.getMe);

module.exports = router;
