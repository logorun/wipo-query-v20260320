const { v4: uuidv4 } = require('uuid');
const { taskDB } = require('../models/database');
const { addTaskToQueue } = require('../services/queueService');
const { asyncHandler } = require('../middleware/errorHandler');
const { Logger } = require('../utils/logger');
const logger = new Logger('bulkImport');

/**
 * 批量导入控制器
 * 支持大文件上传和批量商标导入
 */
const bulkImportController = {
  // 从文件批量导入商标
  importFromFile: asyncHandler(async (req, res) => {
    const { trademarks: textContent, separator = '\n', priority = 5 } = req.body;

    if (!textContent || typeof textContent !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT',
          message: 'Missing trademarks text content'
        }
      });
    }

    // 解析商标列表
    let trademarks = textContent
      .split(separator)
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0 && t.length <= 100);

    // 去重
    trademarks = [...new Set(trademarks)];

    if (trademarks.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_VALID_TRADEMARKS',
          message: 'No valid trademark names found'
        }
      });
    }

    if (trademarks.length > 1000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOO_MANY_TRADEMARKS',
          message: `Found ${trademarks.length} trademarks, maximum allowed is 1000`
        }
      });
    }

    // 生成任务ID
    const taskId = uuidv4();

    // 创建任务
    const task = {
      id: taskId,
      trademarks,
      status: 'pending',
      priority: Math.min(Math.max(priority, 1), 10),
      callbackUrl: req.body.callbackUrl || null,
      userId: req.user?.id || null,
      orgId: req.user?.orgId || null,
      planType: req.user?.plan || 'free'
    };

    await taskDB.create(task);
    await addTaskToQueue(taskId, trademarks, task.priority);

    // 计算预估时间
    const estimatedSeconds = trademarks.length * 35;
    const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
    const estimatedTimeStr = estimatedMinutes > 60 
      ? `${Math.ceil(estimatedMinutes / 60)}小时`
      : `${estimatedMinutes}分钟`;

    logger.info('Bulk import created', { 
      taskId, 
      trademarkCount: trademarks.length,
      source: 'file_upload'
    });

    res.status(201).json({
      success: true,
      data: {
        taskId,
        status: 'pending',
        trademarkCount: trademarks.length,
        sampleTrademarks: trademarks.slice(0, 10), // 显示前10个示例
        createdAt: new Date().toISOString(),
        estimatedTime: estimatedTimeStr
      }
    });
  }),

  // 批量创建多个任务（当商标数超过1000时）
  createBatchTasks: asyncHandler(async (req, res) => {
    const { trademarks, priority = 5 } = req.body;

    if (!trademarks || !Array.isArray(trademarks) || trademarks.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'trademarks must be a non-empty array'
        }
      });
    }

    // 清洗商标列表
    let allTrademarks = trademarks
      .map(t => String(t).trim().toUpperCase())
      .filter(t => t.length > 0 && t.length <= 100);

    // 去重
    allTrademarks = [...new Set(allTrademarks)];

    // 分批创建任务（每批1000个）
    const batchSize = 1000;
    const batchCount = Math.ceil(allTrademarks.length / batchSize);
    const tasks = [];

    for (let i = 0; i < batchCount; i++) {
      const batchTrademarks = allTrademarks.slice(i * batchSize, (i + 1) * batchSize);
      const taskId = uuidv4();

      const task = {
        id: taskId,
        trademarks: batchTrademarks,
        status: 'pending',
        priority: Math.min(Math.max(priority, 1), 10),
        callbackUrl: req.body.callbackUrl || null,
        userId: req.user?.id || null,
        orgId: req.user?.orgId || null,
        planType: req.user?.plan || 'free'
      };

      await taskDB.create(task);
      await addTaskToQueue(taskId, batchTrademarks, task.priority);

      const estimatedSeconds = batchTrademarks.length * 35;
      const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
      const estimatedTimeStr = estimatedMinutes > 60 
        ? `${Math.ceil(estimatedMinutes / 60)}小时`
        : `${estimatedMinutes}分钟`;

      tasks.push({
        taskId,
        batchNumber: i + 1,
        trademarkCount: batchTrademarks.length,
        estimatedTime: estimatedTimeStr
      });
    }

    logger.info('Batch tasks created', { 
      totalTrademarks: allTrademarks.length,
      batchCount,
      tasks: tasks.map(t => t.taskId)
    });

    res.status(201).json({
      success: true,
      data: {
        totalTrademarks: allTrademarks.length,
        batchCount,
        tasks,
        createdAt: new Date().toISOString()
      }
    });
  })
};

module.exports = bulkImportController;
