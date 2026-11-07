const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Read
router.get('/', eventController.listEvents);
router.get('/qr', (req, res, next) => {
    req.params.id = req.query.event_id;
    return eventController.getEventQR(req, res, next);
});
router.get('/:id', eventController.getEvent);
router.get('/:id/qr', eventController.getEventQR);

// Admin Management
router.post('/', requireRole(['admin']), eventController.createEvent);
router.put('/:id', requireRole(['admin']), eventController.updateEvent);
router.delete('/:id', requireRole(['admin']), eventController.deleteEvent);
router.patch('/:id/archive', requireRole(['admin']), eventController.archiveEvent);
router.post('/:id/archive', requireRole(['admin']), eventController.archiveEvent);
router.post('/:id/assign-judges', requireRole(['admin']), eventController.assignJudges);

// Judging Status Control (Admin & Tabulator)
router.patch('/:id/judging-period', requireRole(['admin', 'tabulator']), eventController.updateJudgingPeriod);

module.exports = router;

