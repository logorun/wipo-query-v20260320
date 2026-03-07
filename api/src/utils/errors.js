/**
 * 标准化错误类型定义
 * 提供更好的错误分类和处理
 */

/**
 * 基础应用错误
 */
class AppError extends Error {
  constructor(message, code, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // 保持堆栈追踪
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * 验证错误 - 400
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * 未授权错误 - 401
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

/**
 * 禁止访问错误 - 403
 */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

/**
 * 资源不存在错误 - 404
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

/**
 * 冲突错误 - 409
 */
class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 'CONFLICT', 409);
  }
}

/**
 * 速率限制错误 - 429
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.retryAfter = retryAfter;
  }
}

/**
 * 数据库错误 - 500
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details = null) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}

/**
 * 外部服务错误 - 502/503
 */
class ExternalServiceError extends AppError {
  constructor(service, message, isRetryable = true) {
    super(
      `${service} service error: ${message}`,
      'EXTERNAL_SERVICE_ERROR',
      502
    );
    this.service = service;
    this.isRetryable = isRetryable;
  }
}

/**
 * 查询执行错误
 */
class QueryExecutionError extends AppError {
  constructor(trademark, reason, isRetryable = true) {
    super(
      `Failed to query trademark '${trademark}': ${reason}`,
      'QUERY_EXECUTION_ERROR',
      500
    );
    this.trademark = trademark;
    this.isRetryable = isRetryable;
  }
}

/**
 * 超时错误
 */
class TimeoutError extends AppError {
  constructor(operation, timeoutMs) {
    super(
      `${operation} timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      504
    );
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * 熔断器错误
 */
class CircuitBreakerError extends AppError {
  constructor(breakerName, retryAfter = 0) {
    super(
      `Service temporarily unavailable (circuit breaker '${breakerName}' is OPEN)`,
      'CIRCUIT_BREAKER_OPEN',
      503
    );
    this.breakerName = breakerName;
    this.retryAfter = retryAfter;
  }
}

/**
 * 错误类型判断工具
 */
const ErrorTypes = {
  isRetryable(error) {
    // 可重试的错误类型
    const retryableCodes = [
      'TIMEOUT',
      'EXTERNAL_SERVICE_ERROR',
      'DATABASE_ERROR',
      'QUERY_EXECUTION_ERROR'
    ];
    
    if (error instanceof AppError) {
      return retryableCodes.includes(error.code) && error.isRetryable !== false;
    }
    
    // 网络相关错误
    if (error.code) {
      const retryableNetworkCodes = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'EPIPE',
        'ENOTFOUND'
      ];
      return retryableNetworkCodes.includes(error.code);
    }
    
    return false;
  },

  isValidationError(error) {
    return error instanceof ValidationError || error.name === 'ValidationError';
  },

  isAuthError(error) {
    return error instanceof UnauthorizedError || 
           error instanceof ForbiddenError ||
           error.code === 'UNAUTHORIZED' ||
           error.code === 'FORBIDDEN';
  },

  isNotFound(error) {
    return error instanceof NotFoundError || error.code === 'NOT_FOUND';
  },

  isRateLimit(error) {
    return error instanceof RateLimitError || error.code === 'RATE_LIMIT_EXCEEDED';
  },

  isCircuitBreaker(error) {
    return error instanceof CircuitBreakerError || error.code === 'CIRCUIT_BREAKER_OPEN';
  }
};

/**
 * 错误转换工具 - 将未知错误转换为标准错误
 */
function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  // SQLite 错误
  if (error.code && error.code.startsWith('SQLITE_')) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return new ConflictError('Resource already exists');
    }
    return new DatabaseError(error.message, { sqliteCode: error.code });
  }

  // JSON 解析错误
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return new ValidationError('Invalid JSON format', { originalError: error.message });
  }

  // 网络错误
  if (error.code) {
    switch (error.code) {
      case 'ECONNREFUSED':
        return new ExternalServiceError('Network', 'Connection refused', true);
      case 'ETIMEDOUT':
      case 'ECONNABORTED':
        return new TimeoutError('Network request', 30000);
      case 'ENOTFOUND':
        return new ExternalServiceError('DNS', 'Host not found', false);
    }
  }

  // 默认包装为内部错误
  return new AppError(
    error.message || 'Internal server error',
    'INTERNAL_ERROR',
    500,
    process.env.NODE_ENV === 'development' ? { stack: error.stack } : null
  );
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  QueryExecutionError,
  TimeoutError,
  CircuitBreakerError,
  ErrorTypes,
  normalizeError
};
