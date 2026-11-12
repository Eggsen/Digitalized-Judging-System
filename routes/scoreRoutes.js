const express = require('express');
const router = express.Router();
const scoreController = require('../controllers/scoreController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Scoring Submissions (Judge)
router.post('/', requireRole(['judge', 'admin']), scoreController.submitScore);
router.post('/submit', requireRole(['judge', 'admin']), scoreController.submitScore);
router.post('/lock', requireRole(['judge', 'admin']), scoreController.lockScore);
router.post('/request-unlock', requireRole(['judge']), scoreController.requestUnlock);
router.post('/self-unlock', requireRole(['judge', 'admin']), scoreController.selfUnlock);

// Tabulation & Unlock Approvals (Admin & Tabulator)
router.post('/approve-unlock', requireRole(['admin', 'tabulator']), scoreController.approveUnlock);
router.get('/matrix', requireRole(['admin', 'tabulator', 'judge']), scoreController.getTabulationMatrix);
router.get('/versions', requireRole(['admin', 'tabulator', 'judge']), scoreController.getScoreVersions);

// Official Tabulation PDF Export (Generated via pdfmake npm - Restricted to Admin & Tabulator)
router.get('/export-pdf', requireRole(['admin', 'tabulator']), scoreController.exportTabulationPDF);

// Score Verification (Tabulator Action)
router.post('/verify', requireRole(['admin', 'tabulator']), scoreController.verifyScore);
router.post('/unverify', requireRole(['admin', 'tabulator']), scoreController.unverifyScore);

module.exports = router;

