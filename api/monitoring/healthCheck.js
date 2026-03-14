#!/usr/bin/env node
/**
 * Health Check Script for WIPO API
 * Collects metrics and monitors system health
 */

const schedule = require('node-cron');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { taskDB, cacheDB } = require('../src/models/database');
const { Logger } = require('../src/utils/logger');
const { metrics } = require('../src/utils/metrics');
const { registry: circuitBreakers } = require('../src/utils/circuitBreaker');

const logger = new Logger('healthCheck');

// Health check interval (minutes)
const HEALTH_CHECK_INTERVAL = process.env.HEALTH_CHECK_INTERVAL || 5;

// Metrics to collect
const collectMetrics = () => {
  try {
    const tasks = taskDB.getAllTasks();
    const pending = tasks.filter(t => t.status === 'pending');
    const processing = tasks.filter(t => t.status === 'processing');
    const completed = tasks.filter(t => t.status === 'completed');

    const now = new Date();
    const healthData = {
      timestamp: now.toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      database: {
        total: tasks.length,
        pending: pending.length,
        processing: processing.length,
        completed: completed.length
      }
    };

    // Circuit breaker states
    const breakerStates = circuitBreakers.getAllStates();
    healthData.circuitBreakers = {
      total: Object.keys(breakerStates).length,
      open: Object.entries(breakerStates)
        .filter(([, state]) => state.state === 'OPEN')
        .map(([name, state]) => ({ name, state: state.state }))
    };

    logger.info('Health check completed', healthData);
    return healthData;
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    return null;
  }
};

// Start health check scheduler
const startHealthCheck = () => {
  logger.info('Starting health check scheduler', { interval: HEALTH_CHECK_INTERVAL });

  // Run initial check
  collectMetrics();

  // Schedule periodic checks
  schedule.schedule(`*/${HEALTH_CHECK_INTERVAL} * * * *`, () => {
    collectMetrics();
  });
};

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info('Shutting down health check scheduler');
  schedule.gracefulShutdown();
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start if run directly
if (require.main === module) {
  startHealthCheck();
}

module.exports = {
  startHealthCheck,
  collectMetrics
};
