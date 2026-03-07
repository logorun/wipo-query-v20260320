const config = require('../config');

/**
 * 结构化日志系统
 * 支持 JSON 格式和级别控制
 */
class Logger {
  constructor(context = '') {
    this.context = context;
  }

  _log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      context: this.context,
      ...meta
    };

    // 错误级别添加堆栈
    if (level === 'error' && meta.error) {
      logEntry.stack = meta.error.stack?.split('\n').slice(0, 5);
    }

    // 开发环境美化输出
    if (config.server.env === 'development' && config.logging.format !== 'json') {
      const colorMap = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m'  // red
      };
      const reset = '\x1b[0m';
      const color = colorMap[level] || '';
      console.log(`${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${this.context ? `[${this.context}] ` : ''}${message}`);
      if (Object.keys(meta).length > 0) {
        console.log('  Meta:', JSON.stringify(meta, null, 2));
      }
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  debug(message, meta) {
    if (this._shouldLog('debug')) {
      this._log('debug', message, meta);
    }
  }

  info(message, meta) {
    if (this._shouldLog('info')) {
      this._log('info', message, meta);
    }
  }

  warn(message, meta) {
    if (this._shouldLog('warn')) {
      this._log('warn', message, meta);
    }
  }

  error(message, meta) {
    if (this._shouldLog('error')) {
      this._log('error', message, meta);
    }
  }

  _shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level] >= levels[config.logging.level];
  }

  // 创建子日志器
  child(context) {
    return new Logger(`${this.context}${this.context ? '.' : ''}${context}`);
  }
}

// 请求日志中间件
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const logger = new Logger('http');

  // 记录请求开始
  logger.debug('Request started', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress
  });

  // 响应完成时记录
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[level]('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length')
    });
  });

  next();
};

module.exports = { Logger, requestLogger };
