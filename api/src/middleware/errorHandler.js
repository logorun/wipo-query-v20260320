// 增强错误处理中间件
const { 
  normalizeError, 
  ErrorTypes,
  CircuitBreakerError,
  RateLimitError 
} = require('../utils/errors');
const { Logger } = require('../utils/logger');

const logger = new Logger('errorHandler');

/**
 * 主错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  // 标准化错误
  const error = normalizeError(err);
  
  const timestamp = new Date().toISOString();
  
  // 记录错误日志
  const logLevel = error.statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel]('Request error', {
    method: req.method,
    path: req.path,
    statusCode: error.statusCode,
    errorCode: error.code,
    message: error.message,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    ...(error.statusCode >= 500 && { stack: err.stack })
  });

  // 构建错误响应
  const response = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      timestamp
    }
  };

  // 添加详情（开发环境或特定错误类型）
  if (error.details) {
    response.error.details = error.details;
  }

  // 添加重试信息（速率限制或熔断器）
  if (error instanceof RateLimitError || error instanceof CircuitBreakerError) {
    response.error.retryAfter = error.retryAfter;
    res.set('Retry-After', error.retryAfter);
  }

  // 开发环境添加堆栈
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.error.stack = err.stack.split('\n').slice(0, 10);
  }

  res.status(error.statusCode).json(response);
};

/**
 * 404 处理
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * 异步错误包装器
 * 捕获 async 函数中的错误并传递给错误处理中间件
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 全局未捕获异常处理
 */
const setupGlobalErrorHandlers = () => {
  // 未捕获的异常
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { 
      error: err.message, 
      stack: err.stack,
      type: 'uncaughtException'
    });
    
    // 给日志系统时间写入后退出
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // 未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { 
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
      type: 'unhandledRejection'
    });
  });

  // 多个 Promise 拒绝（Node.js 15+）
  process.on('multipleResolves', (type, promise, reason) => {
    logger.warn('Multiple Resolves', { type, reason });
  });

  // 警告处理
  process.on('warning', (warning) => {
    logger.warn('Node.js Warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });

  // 优雅退出信号
  const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}, starting graceful shutdown...`);
    
    // 设置强制退出定时器
    const forceExit = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);

    // 尝试优雅关闭
    // 注意：实际关闭逻辑由调用方实现（如 server.close()）
    process.emit('gracefulShutdown', signal, () => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Windows 信号
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));
};

module.exports = { 
  errorHandler, 
  notFoundHandler, 
  asyncHandler,
  setupGlobalErrorHandlers
};
