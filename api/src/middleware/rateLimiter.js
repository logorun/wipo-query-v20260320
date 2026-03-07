// 限流中间件
const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * 创建自定义的错误响应格式
 */
const createRateLimitHandler = (limiterName) => {
  return (req, res) => {
    const resetTime = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later',
      retryAfter: resetTime > 0 ? resetTime : 0,
      limiter: limiterName
    });
  };
};

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('global'),
  skip: (req) => {
    return req.path === '/health' || req.path === '/metrics';
  }
});

const taskSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('taskSubmit'),
  skip: (req) => {
    return req.method !== 'POST' || !req.path.includes('/tasks');
  }
});

module.exports = {
  globalLimiter,
  taskSubmitLimiter
};
