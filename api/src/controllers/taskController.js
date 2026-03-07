const { v4: uuidv4 } = require('uuid');
const { taskDB } = require('../models/database');
const { addTaskToQueue, getQueueStats } = require('../services/queueService');
const { asyncHandler } = require('../middleware/errorHandler');

const taskController = {
  // 创建任务
  create: asyncHandler(async (req, res) => {
    const { trademarks, priority = 5, callbackUrl } = req.body;

    // 验证参数
    if (!trademarks || !Array.isArray(trademarks) || trademarks.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'trademarks must be a non-empty array'
        }
      });
    }

    // 支持最多1000个商标
    if (trademarks.length > 1000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOO_MANY_TRADEMARKS',
          message: 'Maximum 1000 trademarks allowed per task'
        }
      });
    }

    // 验证每个商标名称
    const invalidTrademarks = trademarks.filter(t => typeof t !== 'string' || t.trim().length === 0 || t.length > 100);
    if (invalidTrademarks.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TRADEMARK',
          message: 'Trademark names must be non-empty strings (max 100 chars)',
          details: invalidTrademarks
        }
      });
    }

    // 生成任务ID
    const taskId = uuidv4();

    // 创建任务记录
    // SaaS 预留: 从 JWT token 中获取 userId, orgId
    // 当前阶段: 使用默认值，未来从 req.user 获取
    const task = {
      id: taskId,
      trademarks: trademarks.map(t => t.trim().toUpperCase()),
      status: 'pending',
      priority: Math.min(Math.max(priority, 1), 10),
      callbackUrl,
      // SaaS 预留字段 (未来从 JWT token 获取)
      userId: req.user?.id || null,
      orgId: req.user?.orgId || null,
      planType: req.user?.plan || 'free'
    };

    await taskDB.create(task);

    // 添加到队列
    await addTaskToQueue(taskId, task.trademarks, task.priority);

    // 计算预估时间
    const estimatedSeconds = task.trademarks.length * 35;
    const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
    const estimatedTimeStr = estimatedMinutes > 60 
      ? `${Math.ceil(estimatedMinutes / 60)}小时`
      : `${estimatedMinutes}分钟`;

    // 返回响应
    res.status(201).json({
      success: true,
      data: {
        taskId,
        status: 'pending',
        trademarkCount: task.trademarks.length,
        trademarks: task.trademarks.slice(0, 50), // 只显示前50个
        createdAt: new Date().toISOString(),
        estimatedTime: estimatedTimeStr
      }
    });
  }),

  // 获取任务状态
  getStatus: asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    
    // 验证 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(taskId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TASK_ID',
          message: 'Invalid task ID format'
        }
      });
    }

    const task = await taskDB.getById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: `Task with ID '${taskId}' not found`
        }
      });
    }

    // 构建响应
    const response = {
      id: task.id,
      status: task.status,
      trademarks: task.trademarks,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      progress: {
        total: task.progress_total,
        processed: task.progress_processed,
        failed: task.progress_failed
      }
    };

    if (task.started_at) {
      response.startedAt = task.started_at;
    }

    if (task.status === 'completed' || task.status === 'processing') {
      if (task.completed_at) {
        response.completedAt = task.completed_at;
      }
      response.results = task.results || [];
      
      if (task.status === 'processing' && task.results) {
        const completedTrademarks = task.results.map(r => r.trademark);
        const pendingTrademarks = task.trademarks.filter(t => !completedTrademarks.includes(t));
        response.processingStatus = {
          completed: completedTrademarks.length,
          pending: pendingTrademarks.length,
          completedTrademarks: completedTrademarks,
          pendingTrademarks: pendingTrademarks
        };
      }
    }

    if (task.status === 'pending') {
      const queueStats = await getQueueStats();
      response.queuePosition = queueStats.waiting;
      // 每个商标约30秒，加上5秒间隔
      const estimatedSeconds = task.trademarks.length * 35;
      const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
      response.estimatedTime = estimatedMinutes > 60 
        ? `${Math.ceil(estimatedMinutes / 60)}小时`
        : `${estimatedMinutes}分钟`;
    }

    if (task.error) {
      response.error = task.error;
    }

    res.json({ success: true, data: response });
  }),

  // 获取任务列表
  list: asyncHandler(async (req, res) => {
    const { status = 'all', limit = 20, offset = 0 } = req.query;

    // 验证状态参数
    const validStatuses = ['all', 'pending', 'processing', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Status must be one of: ${validStatuses.join(', ')}`
        }
      });
    }

    // 验证分页参数
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);
    
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit must be between 1 and 100'
        }
      });
    }

    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OFFSET',
          message: 'Offset must be a non-negative integer'
        }
      });
    }

    const options = {
      status: status !== 'all' ? status : null,
      limit: parsedLimit,
      offset: parsedOffset
    };

    const [tasks, stats] = await Promise.all([
      taskDB.list(options),
      taskDB.getStats()
    ]);

    res.json({
      success: true,
      data: {
        total: stats.total,
        pending: stats.pending,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed,
        tasks: tasks.map(t => ({
          id: t.id,
          status: t.status,
          trademarks: t.trademarks,
          createdAt: t.created_at,
          completedAt: t.completed_at,
          progress: {
            total: t.progress_total,
            processed: t.progress_processed,
            failed: t.progress_failed
          }
        })),
        pagination: {
          limit: options.limit,
          offset: options.offset,
          hasMore: tasks.length === options.limit
        }
      }
    });
  }),

  // 取消任务
  cancel: asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    
    // 验证 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(taskId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TASK_ID',
          message: 'Invalid task ID format'
        }
      });
    }

    const task = await taskDB.getById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: `Task with ID '${taskId}' not found`
        }
      });
    }

    if (task.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_CANCEL',
          message: `Cannot cancel task with status '${task.status}'. Only pending tasks can be cancelled.`
        }
      });
    }

    await taskDB.updateStatus(taskId, 'cancelled');

    res.json({
      success: true,
      data: {
        id: taskId,
        status: 'cancelled',
        message: 'Task cancelled successfully'
      }
    });
  })
};

module.exports = taskController;
