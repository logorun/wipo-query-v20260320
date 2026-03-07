/**
 * 增强队列服务 - 带连接健康检查和自动恢复
 */
const Queue = require('bull');
const config = require('../config');
const { Logger } = require('../utils/logger');
const { metrics } = require('../utils/metrics');
const { ExternalServiceError } = require('../utils/errors');

const logger = new Logger('queue');

// 连接状态
const connectionState = {
  isConnected: false,
  lastError: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 10
};

// 创建 Redis 客户端配置
// Note: Bull doesn't allow enableReadyCheck or maxRetriesPerRequest in redis opts
// See: https://github.com/OptimalBits/bull/issues/1873
const createRedisConfig = () => ({
  host: config.redis.host,
  port: config.redis.port,
  retryStrategy: (times) => {
    const delay = Math.min(times * 1000, 5000);
    logger.warn(`Redis reconnect attempt ${times}, retrying in ${delay}ms`);
    return delay;
  },
  enableOfflineQueue: true,
  connectTimeout: 10000,
  lazyConnect: false
});

// 创建队列实例
let queryQueue;

const initQueue = () => {
  queryQueue = new Queue('trademark-query', {
    redis: createRedisConfig(),
    defaultJobOptions: {
      attempts: config.query.maxRetries,
      backoff: {
        type: 'exponential',
        delay: config.redis.retryDelay
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 1000
      },
      removeOnFail: {
        age: 7 * 24 * 3600
      }
    },
    settings: {
      stalledInterval: 30000,      // 30秒检查一次 stalled jobs
      maxStalledCount: 3,          // 最大重试次数
      guardInterval: 5000,         // 5秒检查一次
      retryProcessDelay: 5000      // 失败后5秒重试
    }
  });

  // 连接事件
  queryQueue.on('ready', () => {
    connectionState.isConnected = true;
    connectionState.lastError = null;
    connectionState.reconnectAttempts = 0;
    logger.info('Redis connection ready');
    metrics.gauge('redis_connected', 1);
  });

  queryQueue.on('error', (error) => {
    connectionState.isConnected = false;
    connectionState.lastError = error.message;
    connectionState.reconnectAttempts++;
    logger.error('Redis connection error', { 
      error: error.message,
      reconnectAttempts: connectionState.reconnectAttempts 
    });
    metrics.gauge('redis_connected', 0);
    metrics.increment('redis_errors_total');
  });

  queryQueue.on('waiting', (jobId) => {
    metrics.increment('jobs_waiting_total');
  });

  queryQueue.on('active', (job, jobPromise) => {
    logger.debug(`Job started processing`, { jobId: job.id });
    metrics.increment('jobs_active_total');
    metrics.gauge('jobs_active_current', 
      (metrics.gauges.get('jobs_active_current') || 0) + 1
    );
  });

  queryQueue.on('completed', (job, result) => {
    logger.info(`Job completed`, { jobId: job.id, taskId: job.data.taskId });
    metrics.increment('jobs_completed_total');
    metrics.gauge('jobs_active_current', 
      Math.max(0, (metrics.gauges.get('jobs_active_current') || 1) - 1)
    );
  });

  queryQueue.on('failed', (job, err) => {
    logger.error(`Job failed`, { 
      jobId: job.id, 
      taskId: job.data.taskId, 
      error: err.message,
      attempt: job.attemptsMade 
    });
    metrics.increment('jobs_failed_total');
    metrics.gauge('jobs_active_current', 
      Math.max(0, (metrics.gauges.get('jobs_active_current') || 1) - 1)
    );
  });

  queryQueue.on('stalled', (job) => {
    logger.warn(`Job stalled`, { jobId: job.id, taskId: job.data.taskId });
    metrics.increment('jobs_stalled_total');
  });

  queryQueue.on('paused', () => {
    logger.info('Queue paused');
  });

  queryQueue.on('resumed', () => {
    logger.info('Queue resumed');
  });

  queryQueue.on('cleaned', (jobs, type) => {
    logger.info(`Queue cleaned`, { type, count: jobs.length });
  });

  return queryQueue;
};

// 初始化队列
queryQueue = initQueue();

/**
 * 健康检查
 */
const healthCheck = async () => {
  try {
    const client = queryQueue.client;
    await client.ping();
    return {
      healthy: true,
      state: connectionState
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      state: connectionState
    };
  }
};

/**
 * 等待连接就绪
 */
const waitForConnection = async (timeout = 30000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const health = await healthCheck();
    if (health.healthy) {
      return true;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  
  throw new ExternalServiceError('Redis', 'Connection timeout', true);
};

/**
 * 添加任务到队列
 */
const addTaskToQueue = async (taskId, trademarks, priority = 5) => {
  // 检查连接状态
  if (!connectionState.isConnected) {
    logger.warn('Redis not connected, attempting to reconnect...');
    try {
      await waitForConnection(10000);
    } catch (error) {
      throw new ExternalServiceError('Redis', 'Not connected, cannot add task', true);
    }
  }

  try {
    const job = await queryQueue.add(
      { taskId, trademarks },
      {
        priority: 11 - priority,
        jobId: taskId, // 使用 taskId 作为 jobId，实现幂等性
      }
    );
    
    logger.info(`Task added to queue`, { 
      taskId, 
      jobId: job.id, 
      trademarkCount: trademarks.length 
    });
    
    metrics.increment('tasks_created_total', { priority: priority.toString() });
    return job;
  } catch (error) {
    logger.error(`Failed to add task to queue`, { taskId, error: error.message });
    throw new ExternalServiceError('Redis', `Failed to add task: ${error.message}`, true);
  }
};

/**
 * 获取队列状态
 */
const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queryQueue.getWaitingCount(),
      queryQueue.getActiveCount(),
      queryQueue.getCompletedCount(),
      queryQueue.getFailedCount(),
      queryQueue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
      connection: connectionState.isConnected ? 'connected' : 'disconnected'
    };
  } catch (error) {
    logger.error('Failed to get queue stats', { error: error.message });
    return { 
      waiting: 0, 
      active: 0, 
      completed: 0, 
      failed: 0, 
      delayed: 0,
      total: 0,
      connection: 'error',
      error: error.message
    };
  }
};

/**
 * 获取任务详情
 */
const getJob = async (jobId) => {
  try {
    return await queryQueue.getJob(jobId);
  } catch (error) {
    logger.error('Failed to get job', { jobId, error: error.message });
    return null;
  }
};

/**
 * 清理旧任务
 */
const cleanOldJobs = async () => {
  try {
    const cleaned = await Promise.all([
      queryQueue.clean(24 * 3600 * 1000, 'completed'),
      queryQueue.clean(7 * 24 * 3600 * 1000, 'failed')
    ]);
    
    const totalCleaned = cleaned.flat().length;
    logger.info('Cleaned old jobs from queue', { count: totalCleaned });
    return totalCleaned;
  } catch (error) {
    logger.error('Failed to clean old jobs', { error: error.message });
    return 0;
  }
};

/**
 * 暂停队列
 */
const pauseQueue = async () => {
  try {
    await queryQueue.pause();
    logger.info('Queue paused');
    return true;
  } catch (error) {
    logger.error('Failed to pause queue', { error: error.message });
    return false;
  }
};

/**
 * 恢复队列
 */
const resumeQueue = async () => {
  try {
    await queryQueue.resume();
    logger.info('Queue resumed');
    return true;
  } catch (error) {
    logger.error('Failed to resume queue', { error: error.message });
    return false;
  }
};

/**
 * 优雅关闭
 */
const gracefulShutdown = async () => {
  logger.info('Shutting down queue...');
  
  try {
    // 暂停队列，不再接受新任务
    await queryQueue.pause();
    
    // 等待当前处理中的任务完成（最多30秒）
    const timeout = 30000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const active = await queryQueue.getActiveCount();
      if (active === 0) {
        logger.info('All active jobs completed');
        break;
      }
      logger.info(`Waiting for ${active} active jobs to complete...`);
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // 关闭队列连接
    await queryQueue.close();
    logger.info('Queue closed gracefully');
  } catch (error) {
    logger.error('Error during queue shutdown', { error: error.message });
    throw error;
  }
};

module.exports = {
  queryQueue,
  addTaskToQueue,
  getQueueStats,
  getJob,
  cleanOldJobs,
  pauseQueue,
  resumeQueue,
  gracefulShutdown,
  healthCheck,
  waitForConnection,
  connectionState
};
