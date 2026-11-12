const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', notificationController.listNotifications);
router.post('/', notificationController.respondToInvitation);
router.post('/respond', notificationController.respondToInvitation);
router.patch('/all/read', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markRead);

module.exports = router;
