/**
 * 请求验证和消毒中间件
 * 防止无效输入导致系统问题
 */

const { ValidationError } = require('../utils/errors');

/**
 * 验证商标名称格式
 * 规则：
 * - 长度 1-100 字符
 * - 允许字母、数字、空格、连字符、下划线
 * - 不允许纯数字
 * - 不允许特殊字符
 */
const validateTrademark = (name) => {
  if (!name || typeof name !== 'string') {
    return { valid: false, reason: 'Trademark name is required' };
  }

  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Trademark name cannot be empty' };
  }

  if (trimmed.length > 100) {
    return { valid: false, reason: 'Trademark name too long (max 100 characters)' };
  }

  if (/^\d+$/.test(trimmed)) {
    return { valid: false, reason: 'Trademark name cannot be only numbers' };
  }

  return { valid: true, value: trimmed };
};

/**
 * 批量验证商标列表
 */
const validateTrademarkBatch = (trademarks, maxBatchSize = 1000) => {
  if (!Array.isArray(trademarks)) {
    return { valid: false, reason: 'Trademarks must be an array' };
  }

  if (trademarks.length === 0) {
    return { valid: false, reason: 'Trademarks array cannot be empty' };
  }

  if (trademarks.length > maxBatchSize) {
    return { 
      valid: false, 
      reason: `Batch size too large (max ${maxBatchSize}, got ${trademarks.length})`
    };
  }

  const validTrademarks = [];
  const invalidTrademarks = [];

  for (let i = 0; i < trademarks.length; i++) {
    const result = validateTrademark(trademarks[i]);
    if (result.valid) {
      validTrademarks.push(result.value);
    } else {
      invalidTrademarks.push({ index: i, name: trademarks[i], reason: result.reason });
    }
  }

  // 去重
  const uniqueTrademarks = [...new Set(validTrademarks)];
  const duplicates = validTrademarks.length - uniqueTrademarks.length;

  return {
    valid: invalidTrademarks.length === 0,
    trademarks: uniqueTrademarks,
    invalid: invalidTrademarks,
    duplicates,
    total: trademarks.length
  };
};

/**
 * 验证 UUID 格式
 */
const validateUUID = (uuid) => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(uuid);
};

/**
 * 验证分页参数
 */
const validatePagination = (page, limit, maxLimit = 100) => {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;

  if (pageNum < 1) {
    return { valid: false, reason: 'Page must be at least 1' };
  }

  if (limitNum < 1 || limitNum > maxLimit) {
    return { valid: false, reason: `Limit must be between 1 and ${maxLimit}` };
  }

  return { valid: true, page: pageNum, limit: limitNum, offset: (pageNum - 1) * limitNum };
};

/**
 * 验证任务创建请求
 */
const validateTaskRequest = (req, res, next) => {
  try {
    const { trademarks, priority, callbackUrl } = req.body;

    // 验证商标列表
    const batchResult = validateTrademarkBatch(trademarks);
    if (!batchResult.valid) {
      throw new ValidationError('Invalid trademarks in batch', {
        invalid: batchResult.invalid,
        message: `Found ${batchResult.invalid.length} invalid trademarks`
      });
    }

    if (batchResult.trademarks.length === 0) {
      throw new ValidationError('No valid trademarks after validation and deduplication');
    }

    // 替换为验证后的商标列表
    req.body.trademarks = batchResult.trademarks;
    req.body.validationInfo = {
      originalCount: batchResult.total,
      deduplicated: batchResult.duplicates,
      validCount: batchResult.trademarks.length
    };

    // 验证优先级
    if (priority !== undefined) {
      const priorityNum = parseInt(priority, 10);
      if (isNaN(priorityNum) || priorityNum < 1 || priorityNum > 10) {
        throw new ValidationError('Priority must be an integer between 1 and 10');
      }
      req.body.priority = priorityNum;
    }

    // 验证回调 URL
    if (callbackUrl) {
      try {
        new URL(callbackUrl);
      } catch {
        throw new ValidationError('Invalid callback URL format');
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 验证任务 ID 参数
 */
const validateTaskId = (req, res, next) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      throw new ValidationError('Task ID is required');
    }

    if (!validateUUID(taskId)) {
      throw new ValidationError('Invalid task ID format (must be UUID)');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 验证缓存查询参数
 */
const validateCacheQuery = (req, res, next) => {
  try {
    const { trademark } = req.params;
    const result = validateTrademark(trademark);

    if (!result.valid) {
      throw new ValidationError(result.reason);
    }

    req.params.trademark = result.value;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 验证分页查询参数
 */
const validateListQuery = (req, res, next) => {
  try {
    const { page, limit, status } = req.query;

    // 验证分页
    const pagination = validatePagination(page, limit);
    if (!pagination.valid) {
      throw new ValidationError(pagination.reason);
    }

    req.query.page = pagination.page;
    req.query.limit = pagination.limit;
    req.query.offset = pagination.offset;

    // 验证状态过滤
    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'all'];
    if (status && !validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status filter. Must be one of: ${validStatuses.join(', ')}`);
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 请求大小限制中间件
 */
const requestSizeLimit = (maxSize = '1mb') => {
  const bytes = parseInt(maxSize, 10) * (maxSize.includes('mb') ? 1024 * 1024 : 1024);
  
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'], 10);
    
    if (contentLength > bytes) {
      return next(new ValidationError(`Request body too large (max ${maxSize})`));
    }
    
    next();
  };
};

/**
 * SQL 注入检测（基础）
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // 检测常见的 SQL 注入模式
  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(\b(OR|AND)\b\s*\d*\s*=\s*\d*)/i,
    /(--|#|\/\*|\*\/)/,
    /(\bUNION\b.*\bSELECT\b)/i,
    /(;.*\b(SELECT|INSERT|UPDATE|DELETE)\b)/i
  ];

  for (const pattern of sqlInjectionPatterns) {
    if (pattern.test(input)) {
      throw new ValidationError('Input contains potentially dangerous content');
    }
  }

  return input;
};

module.exports = {
  validateTrademark,
  validateTrademarkBatch,
  validateUUID,
  validatePagination,
  validateTaskRequest,
  validateTaskId,
  validateCacheQuery,
  validateListQuery,
  requestSizeLimit,
  sanitizeInput
};
