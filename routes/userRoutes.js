const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// User self-service preferences (all authenticated roles)
router.get('/preferences', userController.getUserPreferences);
router.post('/preferences', userController.saveUserPreferences);

// Admin-only user management
router.use(requireRole(['admin']));

router.get('/', userController.listUsers);
router.post('/', userController.createUser);
router.patch('/:id/role', userController.updateRole);
router.post('/:id/reset-pin', userController.resetAdminPin);
router.delete('/:id', userController.deleteUser);

module.exports = router;

