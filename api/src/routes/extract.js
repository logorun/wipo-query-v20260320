const express = require('express');
const router = express.Router();
const extractController = require('../controllers/extractController');
const { taskSubmitLimiter } = require('../middleware/rateLimiter');

router.post('/excel',
  taskSubmitLimiter,
  extractController.extractFromExcel
);

router.post('/data',
  taskSubmitLimiter,
  extractController.extractFromData
);

router.post('/stream',
  taskSubmitLimiter,
  extractController.extractStream
);

module.exports = router;
