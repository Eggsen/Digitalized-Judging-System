const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Admin-only Governance & Audit Trail Exports
router.get('/export/csv', requireRole(['admin']), logController.exportLogsCSV);
router.get('/export/pdf', requireRole(['admin']), logController.exportLogsPDF);

// Standard list route
router.get('/', logController.listLogs);

module.exports = router;
