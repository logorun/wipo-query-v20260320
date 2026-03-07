const express = require('express');
const router = express.Router();
const bulkImportController = require('../controllers/bulkImportController');
const { taskSubmitLimiter } = require('../middleware/rateLimiter');

// POST /api/v1/bulk-import/file - 从文件内容批量导入
// 支持换行符、逗号、制表符分隔的商标列表
router.post('/file', 
  taskSubmitLimiter,
  bulkImportController.importFromFile
);

// POST /api/v1/bulk-import/batch - 批量创建多个任务（超过1000个商标时）
router.post('/batch',
  taskSubmitLimiter,
  bulkImportController.createBatchTasks
);

module.exports = router;
