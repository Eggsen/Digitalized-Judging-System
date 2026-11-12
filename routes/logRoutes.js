const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', logController.listLogs);

module.exports = router;
