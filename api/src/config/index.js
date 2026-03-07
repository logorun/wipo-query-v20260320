// 配置管理
const config = {
  // 服务器
  server: {
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development',
    apiVersion: 'v1'
  },

  // 认证
  auth: {
    apiKey: process.env.API_KEY || 'logotestkey',
    headerName: 'x-api-key',
    queryParamName: 'apiKey'
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    retryDelay: 5000,
    maxRetries: 3
  },

  // 数据库
  database: {
    path: process.env.DB_PATH || './data/api.db'
  },

  // 缓存
  cache: {
    ttlHours: parseInt(process.env.CACHE_TTL_HOURS) || 24,
    checkIntervalHours: 1
  },

  // 查询
  query: {
    delayMs: parseInt(process.env.QUERY_DELAY_MS) || 5000,
    timeoutMs: parseInt(process.env.QUERY_TIMEOUT_MS) || 120000,
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    maxTrademarksPerTask: 50
  },

  // 日志
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    format: process.env.LOG_FORMAT || 'json'
  },

  // 限流
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    // 全局限流: 100请求/15分钟
    global: {
      windowMs: parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS) || 15 * 60 * 1000,
      maxRequests: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX) || 100
    },
    // 任务提交限流: 10请求/分钟
    taskSubmit: {
      windowMs: parseInt(process.env.RATE_LIMIT_TASK_WINDOW_MS) || 60 * 1000,
      maxRequests: parseInt(process.env.RATE_LIMIT_TASK_MAX) || 10
    }
  },

  // CORS
  cors: {
    enabled: process.env.CORS_ENABLED !== 'false',
    origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*']
  }
};

module.exports = config;
