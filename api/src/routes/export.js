const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');

// GET /api/v1/export/:taskId?format=csv|excel|pdf
router.get('/:taskId', exportController.exportTask);

module.exports = router;
