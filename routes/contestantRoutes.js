const express = require('express');
const router = express.Router();
const contestantController = require('../controllers/contestantController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Read (all roles)
router.get('/', contestantController.listContestants);

// Special Awards & Member Citations (Admin & Judge)
router.post('/:id/comments', requireRole(['admin', 'judge']), contestantController.addComment);
router.delete('/:id/comments/:commentId', requireRole(['admin', 'judge']), contestantController.deleteComment);
router.delete('/:id/comments', requireRole(['admin', 'judge']), contestantController.deleteComment);

// Admin / Event Management
router.post('/', requireRole(['admin']), contestantController.createContestant);
router.put('/:id', requireRole(['admin', 'judge']), contestantController.updateContestant);
router.delete('/:id', requireRole(['admin']), contestantController.deleteContestant);
router.post('/reorder', requireRole(['admin']), contestantController.reorderContestants);

module.exports = router;

