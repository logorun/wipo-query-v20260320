/**
 * 监控告警系统
 * 提供健康检查、指标收集和告警功能
 */

const { Logger } = require('../src/utils/logger');
const logger = new Logger('monitoring');
const { queryQueue } = require('../src/services/queueService');
const { taskDB } = require('../src/models/database');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

// 告警配置
const ALERT_CONFIG = {
  // 阈值配置
  thresholds: {
    apiTimeout: 30000,        // API 无响应超过30秒
    workerOffline: 60000,     // Worker 离线超过60秒
    queueBacklog: 10,         // 队列积压超过10个任务
    errorRate: 0.1,           // 错误率超过10%
    memoryUsage: 0.8          // 内存使用超过80%
  },
  
  // 告警历史
  alertHistory: [],
  maxHistorySize: 100,
  
  // 是否启用告警
  enabled: true
};

// Redis 连接检查
async function checkRedis() {
  try {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      connectTimeout: 5000
    });
    
    await redis.ping();
    await redis.disconnect();
    
    return { status: 'ok', message: 'Redis connection successful' };
  } catch (error) {
    return { status: 'error', message: `Redis connection failed: ${error.message}` };
  }
}

// API Server 健康检查
async function checkAPIServer() {
  try {
    const response = await fetch('http://localhost:3000/health', {
      timeout: 5000
    });
    
    if (response.ok) {
      const data = await response.json();
      return { 
        status: 'ok', 
        message: 'API Server is running',
        uptime: data.uptime 
      };
    } else {
      return { status: 'error', message: `API Server returned ${response.status}` };
    }
  } catch (error) {
    return { status: 'error', message: `API Server check failed: ${error.message}` };
  }
}

// Worker 状态检查
async function checkWorker() {
  try {
    const stats = await queryQueue.getJobCounts();
    
    // 如果有活跃任务，认为 Worker 在线
    const isActive = stats.active > 0 || stats.waiting > 0;
    
    return {
      status: isActive ? 'ok' : 'warning',
      message: isActive ? 'Worker is processing jobs' : 'Worker may be idle',
      stats: {
        active: stats.active,
        waiting: stats.waiting,
        completed: stats.completed,
        failed: stats.failed
      }
    };
  } catch (error) {
    return { status: 'error', message: `Worker check failed: ${error.message}` };
  }
}

// 数据库连接检查
async function checkDatabase() {
  try {
    // 尝试获取统计信息
    const stats = await taskDB.getStats();
    
    return {
      status: 'ok',
      message: 'Database connection successful',
      stats
    };
  } catch (error) {
    return { status: 'error', message: `Database check failed: ${error.message}` };
  }
}

// 队列积压检查
async function checkQueueBacklog() {
  try {
    const stats = await queryQueue.getJobCounts();
    const waiting = stats.waiting || 0;
    
    if (waiting > ALERT_CONFIG.thresholds.queueBacklog) {
      return {
        status: 'warning',
        message: `Queue backlog high: ${waiting} tasks waiting`,
        backlog: waiting
      };
    }
    
    return {
      status: 'ok',
      message: `Queue backlog normal: ${waiting} tasks waiting`,
      backlog: waiting
    };
  } catch (error) {
    return { status: 'error', message: `Queue check failed: ${error.message}` };
  }
}

// 系统资源检查
function checkSystemResources() {
  const memUsage = process.memoryUsage();
  const memPercent = memUsage.heapUsed / memUsage.heapTotal;
  
  if (memPercent > ALERT_CONFIG.thresholds.memoryUsage) {
    return {
      status: 'warning',
      message: `High memory usage: ${(memPercent * 100).toFixed(1)}%`,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percent: memPercent
      }
    };
  }
  
  return {
    status: 'ok',
    message: `Memory usage normal: ${(memPercent * 100).toFixed(1)}%`,
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      percent: memPercent
    }
  };
}

// 执行完整健康检查
async function performHealthCheck() {
  const results = {
    timestamp: new Date().toISOString(),
    overall: 'ok',
    checks: {}
  };
  
  // 执行各项检查
  results.checks.redis = await checkRedis();
  results.checks.api = await checkAPIServer();
  results.checks.worker = await checkWorker();
  results.checks.database = await checkDatabase();
  results.checks.queue = await checkQueueBacklog();
  results.checks.system = checkSystemResources();
  
  // 确定整体状态
  const hasError = Object.values(results.checks).some(check => check.status === 'error');
  const hasWarning = Object.values(results.checks).some(check => check.status === 'warning');
  
  if (hasError) {
    results.overall = 'error';
  } else if (hasWarning) {
    results.overall = 'warning';
  }
  
  // 记录日志
  if (results.overall !== 'ok') {
    logger.warn('Health check detected issues', { overall: results.overall });
  }
  
  return results;
}

// 触发告警
function triggerAlert(check, results) {
  if (!ALERT_CONFIG.enabled) return;
  
  const alert = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    severity: check.status === 'error' ? 'high' : 'medium',
    component: check.component,
    message: check.message,
    details: check
  };
  
  // 添加到历史
  ALERT_CONFIG.alertHistory.unshift(alert);
  
  // 限制历史大小
  if (ALERT_CONFIG.alertHistory.length > ALERT_CONFIG.maxHistorySize) {
    ALERT_CONFIG.alertHistory = ALERT_CONFIG.alertHistory.slice(0, ALERT_CONFIG.maxHistorySize);
  }
  
  // 记录日志
  logger.error('Alert triggered', alert);
  
  // 这里可以添加更多告警方式（邮件、Telegram 等）
}

// 获取告警历史
function getAlertHistory(limit = 50) {
  return ALERT_CONFIG.alertHistory.slice(0, limit);
}

// 清除告警历史
function clearAlertHistory() {
  ALERT_CONFIG.alertHistory = [];
  logger.info('Alert history cleared');
}

// 开始定期健康检查
function startHealthCheck(intervalMs = 60000) {
  logger.info('Starting health check monitor', { interval: intervalMs });
  
  // 立即执行一次
  performHealthCheck();
  
  // 定期检查
  setInterval(async () => {
    const results = await performHealthCheck();
    
    // 检查是否需要触发告警
    for (const [component, check] of Object.entries(results.checks)) {
      if (check.status === 'error' || check.status === 'warning') {
        triggerAlert({ ...check, component }, results);
      }
    }
  }, intervalMs);
}

module.exports = {
  performHealthCheck,
  startHealthCheck,
  getAlertHistory,
  clearAlertHistory,
  checkRedis,
  checkAPIServer,
  checkWorker,
  checkDatabase,
  checkQueueBacklog,
  checkSystemResources
};
