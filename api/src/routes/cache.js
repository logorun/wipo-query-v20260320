const express = require('express');
const router = express.Router();
const cacheController = require('../controllers/cacheController');
const { validateCacheQuery } = require('../middleware/validation');

// GET /api/v1/cache/:trademark - 获取缓存
router.get('/:trademark', 
  validateCacheQuery,
  cacheController.get
);

// DELETE /api/v1/cache/:trademark - 删除缓存
router.delete('/:trademark', 
  validateCacheQuery,
  cacheController.delete
);

// POST /api/v1/cache/clear-expired - 清空过期缓存
router.post('/clear-expired', cacheController.clearExpired);

module.exports = router;
