const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { optionalToken, authenticateToken, requireRole } = require('../middleware/auth');

// Public read with optional token (allows login page and mobile clients to load public branding & security flags)
// If authenticated as admin, getSettings also returns api_keys
router.get('/', optionalToken, settingsController.getSettings);

// Public WebSocket Configuration
router.get('/websocket-config', (req, res) => {
    const key = (process.env.PUSHER_KEY || '').trim();
    const cluster = (process.env.PUSHER_CLUSTER || 'ap1').trim();
    res.json({
        enabled: Boolean(key),
        is_configured: Boolean(key),
        key: key,
        cluster: cluster
    });
});

// Admin-Only System Actions
router.post('/save', authenticateToken, requireRole(['admin']), settingsController.saveSettings);
router.post('/verify-admin-pin', authenticateToken, requireRole(['admin']), settingsController.verifyAdminPin);
router.post('/api-keys', authenticateToken, requireRole(['admin']), settingsController.saveApiKeys);
router.post('/reset-integration', authenticateToken, requireRole(['admin']), settingsController.resetIntegration);
router.post('/security-controls', authenticateToken, requireRole(['admin']), settingsController.updateSecurityControls);
router.post('/export-backup', authenticateToken, requireRole(['admin']), settingsController.exportBackup);
router.post('/clear-logs', authenticateToken, requireRole(['admin']), settingsController.clearLogs);
router.post('/upload-logo', authenticateToken, requireRole(['admin']), settingsController.uploadLogo);
router.get('/logo-library', authenticateToken, requireRole(['admin']), settingsController.getLogoLibrary);
router.post('/logo-library', authenticateToken, requireRole(['admin']), settingsController.manageLogoLibrary);

module.exports = router;
