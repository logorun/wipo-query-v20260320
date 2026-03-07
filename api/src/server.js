require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { Logger, requestLogger } = require('./utils/logger');
const { metrics, metricsMiddleware } = require('./utils/metrics');
const { registry: circuitBreakers } = require('./utils/circuitBreaker');
const taskRoutes = require('./routes/tasks');
const cacheRoutes = require('./routes/cache');
const exportRoutes = require('./routes/export');
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const bulkImportRoutes = require('./routes/bulkImport');
const { 
  errorHandler, 
  notFoundHandler, 
  setupGlobalErrorHandlers 
} = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const { globalLimiter } = require('./middleware/rateLimiter');
const { initDB, healthCheck: dbHealthCheck } = require('./models/database');
const { healthCheck: redisHealthCheck, getQueueStats } = require('./services/queueService');
const { registry } = require('./utils/circuitBreaker');

const logger = new Logger('server');
const app = express();

// 启动时间
app.locals.startTime = Date.now();

// 设置全局错误处理器
setupGlobalErrorHandlers();

// 中间件
if (config.cors.enabled) {
  app.use(cors({ origin: config.cors.origins }));
}

app.use(express.json());

// 日志和指标
app.use(requestLogger);
app.use(metricsMiddleware);

// 限流中间件 - 全局限流
app.use(globalLimiter);

/**
 * 健康检查端点
 */
app.get('/health', async (req, res) => {
  try {
    // 检查数据库
    const dbHealth = await dbHealthCheck();
    
    // 检查 Redis
    const redisHealth = await redisHealthCheck();
    
    // 检查熔断器状态
    const breakerStates = registry.getAllStates();
    const unhealthyBreakers = Object.entries(breakerStates)
      .filter(([, state]) => state.state === 'OPEN');
    
    // 整体健康状态
    const isHealthy = dbHealth.healthy && redisHealth.healthy && unhealthyBreakers.length === 0;
    
    const health = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: config.server.apiVersion,
      uptime: Date.now() - app.locals.startTime,
      checks: {
        database: {
          status: dbHealth.healthy ? 'up' : 'down',
          ...(!dbHealth.healthy && { error: dbHealth.error })
        },
        redis: {
          status: redisHealth.healthy ? 'up' : 'down',
          ...(!redisHealth.healthy && { error: redisHealth.error })
        },
        circuitBreakers: {
          status: unhealthyBreakers.length === 0 ? 'healthy' : 'degraded',
          total: Object.keys(breakerStates).length,
          open: unhealthyBreakers.length,
          ...(unhealthyBreakers.length > 0 && { 
            openBreakers: unhealthyBreakers.map(([name]) => name) 
          })
        }
      }
    };

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * 就绪检查端点 - 用于 Kubernetes 等编排系统
 */
app.get('/ready', async (req, res) => {
  try {
    const dbHealth = await dbHealthCheck();
    const redisHealth = await redisHealthCheck();
    
    const isReady = dbHealth.healthy && redisHealth.healthy;
    
    res.status(isReady ? 200 : 503).json({
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth.healthy,
        redis: redisHealth.healthy
      }
    });
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message });
  }
});

/**
 * 存活检查端点
 */
app.get('/live', (req, res) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: Date.now() - app.locals.startTime
  });
});

/**
 * 指标端点
 */
app.get('/metrics', (req, res) => {
  res.json(metrics.getStats());
});

/**
 * 系统状态端点 - 包含详细状态信息
 */
app.get('/status', async (req, res) => {
  try {
    const [dbHealth, redisHealth, queueStats, dbStats, cacheStats] = await Promise.all([
      dbHealthCheck(),
      redisHealthCheck(),
      getQueueStats(),
      require('./models/database').taskDB.getStats(),
      require('./models/database').cacheDB.getStats()
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      version: config.server.apiVersion,
      environment: config.server.env,
      uptime: Date.now() - app.locals.startTime,
      components: {
        database: {
          healthy: dbHealth.healthy,
          stats: dbStats
        },
        redis: {
          healthy: redisHealth.healthy,
          stats: queueStats
        },
        cache: cacheStats
      },
      circuitBreakers: registry.getAllStates()
    });
  } catch (error) {
    logger.error('Status check failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * 熔断器管理端点
 */
app.get('/circuit-breakers', (req, res) => {
  res.json(registry.getAllStates());
});

app.post('/circuit-breakers/:name/reset', (req, res) => {
  const { name } = req.params;
  registry.reset(name);
  logger.info(`Circuit breaker reset`, { name });
  res.json({ success: true, message: `Circuit breaker '${name}' reset` });
});

app.post('/circuit-breakers/reset-all', (req, res) => {
  registry.resetAll();
  logger.info('All circuit breakers reset');
  res.json({ success: true, message: 'All circuit breakers reset' });
});

// 认证中间件（健康检查端点之后）
app.use(authMiddleware);

// 静态文件服务（前端界面）
app.use(express.static('public'));

// API 路由
app.use(`/api/${config.server.apiVersion}/tasks`, taskRoutes);
app.use(`/api/${config.server.apiVersion}/cache`, cacheRoutes);
app.use(`/api/${config.server.apiVersion}/export`, exportRoutes);
app.use(`/api/${config.server.apiVersion}/bulk-import`, bulkImportRoutes);
app.use(`/api/${config.server.apiVersion}`, webhookRoutes);
app.use(`/api/${config.server.apiVersion}/admin`, adminRoutes);

// 404 处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// 启动服务器
const startServer = async () => {
  try {
    // 初始化数据库
    await initDB();
    
    // 启动 HTTP 服务
    const server = app.listen(config.server.port, () => {
      logger.info(`🚀 API Server running on port ${config.server.port}`, {
        env: config.server.env,
        version: config.server.apiVersion,
        logging: config.logging.level
      });
    });

    // 优雅关闭处理
    process.on('gracefulShutdown', async (signal, done) => {
      logger.info('Graceful shutdown initiated');
      
      // 关闭 HTTP 服务器
      server.close(() => {
        logger.info('HTTP server closed');
        done();
      });
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();
