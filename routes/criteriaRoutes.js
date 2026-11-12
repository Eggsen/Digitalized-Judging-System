const express = require('express');
const router = express.Router();
const criteriaController = require('../controllers/criteriaController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', criteriaController.listCriteria);
router.post('/weights', requireRole(['admin']), criteriaController.batchUpdateWeights);
router.put('/weights', requireRole(['admin']), criteriaController.batchUpdateWeights);
router.patch('/weights', requireRole(['admin']), criteriaController.batchUpdateWeights);
router.post('/weight', requireRole(['admin']), criteriaController.batchUpdateWeights);
router.post('/', requireRole(['admin']), criteriaController.createCriterion);
router.put('/:id', requireRole(['admin']), criteriaController.updateCriterion);
router.delete('/:id', requireRole(['admin']), criteriaController.deleteCriterion);

module.exports = router;
