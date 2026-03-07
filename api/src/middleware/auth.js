const config = require('../config');
const { Logger } = require('../utils/logger');
const logger = new Logger('auth');

// API Key 认证中间件
const authMiddleware = (req, res, next) => {
  // 健康检查和指标端点不需要认证
  if (req.path === '/health' || req.path === '/metrics') {
    return next();
  }

  const apiKey = req.headers[config.auth.headerName] || req.query[config.auth.queryParamName];
  const validApiKey = config.auth.apiKey;

  if (!apiKey) {
    logger.warn('Authentication failed: No API Key', {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'API Key is required. Provide it in X-API-Key header or apiKey query parameter'
      }
    });
  }

  if (apiKey !== validApiKey) {
    logger.warn('Authentication failed: Invalid API Key', {
      ip: req.ip,
      path: req.path,
      keyPrefix: apiKey.substring(0, 4) + '...'
    });
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid API Key'
      }
    });
  }

  // 认证通过，记录日志
  logger.debug('Authentication successful', {
    ip: req.ip,
    path: req.path
  });

  next();
};

module.exports = { authMiddleware };
