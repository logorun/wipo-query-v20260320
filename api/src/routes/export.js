const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

// GET /api/v1/export/:taskId?format=csv|excel|pdf
router.get('/:taskId', exportController.exportTask);

// POST /api/v1/export/batch - 批量导出
router.post('/batch', exportController.exportBatch);

module.exports = router;
