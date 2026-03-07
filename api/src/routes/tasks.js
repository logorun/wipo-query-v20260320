const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { taskSubmitLimiter } = require('../middleware/rateLimiter');
const { 
  validateTaskRequest, 
  validateTaskId, 
  validateListQuery,
  requestSizeLimit 
} = require('../middleware/validation');

// POST /api/v1/tasks - 创建任务
// 限流: 10请求/分钟 + 请求大小限制 + 输入验证
router.post('/', 
  taskSubmitLimiter,
  requestSizeLimit('1mb'),
  validateTaskRequest,
  taskController.create
);

// GET /api/v1/tasks - 获取任务列表
// 分页和过滤参数验证
router.get('/', 
  validateListQuery,
  taskController.list
);

// GET /api/v1/tasks/:taskId - 获取任务状态
router.get('/:taskId', 
  validateTaskId,
  taskController.getStatus
);

// DELETE /api/v1/tasks/:taskId - 删除任务（硬删除）
router.delete('/:taskId', 
  validateTaskId,
  taskController.delete
);

// POST /api/v1/tasks/:taskId/start - 开始任务
router.post('/:taskId/start', 
  validateTaskId,
  taskController.start
);

// POST /api/v1/tasks/:taskId/pause - 暂停任务
router.post('/:taskId/pause', 
  validateTaskId,
  taskController.pause
);

// DELETE /api/v1/tasks/:taskId/delete - 删除任务
router.delete('/:taskId/delete', 
  validateTaskId,
  taskController.delete
);

module.exports = router;
