const cacheService = require('../services/cacheService');
const { taskDB } = require('../models/database');
const { addTaskToQueue } = require('../services/queueService');
const { v4: uuidv4 } = require('uuid');
const { asyncHandler } = require('../middleware/errorHandler');

// 商标名称验证
const validateTrademark = (name) => {
  if (typeof name !== 'string') return false;
  if (name.trim().length === 0) return false;
  if (name.length > 100) return false;
  // 只允许字母、数字、空格和常见符号
  return /^[a-zA-Z0-9\s\-\.\&\'\+]+$/.test(name);
};

const cacheController = {
  // 获取缓存
  get: asyncHandler(async (req, res) => {
    const { trademark } = req.params;
    const { forceRefresh = 'false' } = req.query;

    // 验证商标名称
    if (!validateTrademark(trademark)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TRADEMARK',
          message: 'Trademark name must be 1-100 characters, containing only letters, numbers, spaces, and -.&\'+ symbols'
        }
      });
    }

    const normalizedTrademark = trademark.trim().toUpperCase();

    // 强制刷新
    if (forceRefresh === 'true') {
      await cacheService.delete(normalizedTrademark);

      const taskId = uuidv4();
      await taskDB.create({
        id: taskId,
        trademarks: [normalizedTrademark],
        status: 'pending',
        priority: 5
      });
      await addTaskToQueue(taskId, [normalizedTrademark], 5);

      return res.json({
        success: true,
        data: {
          trademark: normalizedTrademark,
          refreshInitiated: true,
          taskId,
          message: 'Refresh queued, use taskId to track progress'
        }
      });
    }

    // 查询缓存
    const result = await cacheService.get(normalizedTrademark);

    if (!result.cached) {
      return res.json({
        success: true,
        data: {
          trademark: normalizedTrademark,
          cached: false,
          message: 'No cache found for this trademark'
        }
      });
    }

    res.json({
      success: true,
      data: {
        trademark: normalizedTrademark,
        cached: true,
        cacheInfo: result.cacheInfo,
        data: result.data
      }
    });
  }),

  // 删除缓存
  delete: asyncHandler(async (req, res) => {
    const { trademark } = req.params;

    if (!validateTrademark(trademark)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TRADEMARK',
          message: 'Invalid trademark name format'
        }
      });
    }

    const normalizedTrademark = trademark.trim().toUpperCase();
    const result = await cacheService.delete(normalizedTrademark);

    res.json({
      success: true,
      data: {
        trademark: normalizedTrademark,
        deleted: result.deleted,
        message: result.deleted ? 'Cache deleted successfully' : 'No cache found for this trademark'
      }
    });
  }),

  // 清空过期缓存
  clearExpired: asyncHandler(async (req, res) => {
    const result = await cacheService.clearExpired();

    res.json({
      success: true,
      data: {
        deleted: result.deleted,
        message: `${result.deleted} expired cache entries cleared`
      }
    });
  })
};

module.exports = cacheController;
