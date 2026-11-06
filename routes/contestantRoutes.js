const express = require('express');
const router = express.Router();
const contestantController = require('../controllers/contestantController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Read (all roles)
router.get('/', contestantController.listContestants);

// Admin / Event Management
router.post('/', requireRole(['admin']), contestantController.createContestant);
router.put('/:id', requireRole(['admin']), contestantController.updateContestant);
router.delete('/:id', requireRole(['admin']), contestantController.deleteContestant);
router.post('/reorder', requireRole(['admin']), contestantController.reorderContestants);

module.exports = router;

