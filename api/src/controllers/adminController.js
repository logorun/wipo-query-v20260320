const { 
  performHealthCheck, 
  getAlertHistory, 
  clearAlertHistory 
} = require('../../monitoring/healthCheck');
const { metrics } = require('../utils/metrics');
const { Logger } = require('../utils/logger');

const logger = new Logger('admin');

// GET /api/v1/admin/health - 健康状态
const health = async (req, res) => {
  try {
    const health = await performHealthCheck();
    
    const statusCode = health.overall === 'ok' ? 200 : 
                       health.overall === 'warning' ? 200 : 503;
    
    res.status(statusCode).json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: { code: 'HEALTH_CHECK_FAILED', message: error.message }
    });
  }
};

// GET /api/v1/admin/metrics - 详细指标
const metricsHandler = (req, res) => {
  try {
    const stats = metrics.getStats();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        ...stats
      }
    });
  } catch (error) {
    logger.error('Metrics retrieval failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: { code: 'METRICS_FAILED', message: error.message }
    });
  }
};

// GET /api/v1/admin/alerts - 告警历史
const getAlerts = (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const alerts = getAlertHistory(parseInt(limit));
    
    res.json({
      success: true,
      data: {
        alerts,
        total: alerts.length
      }
    });
  } catch (error) {
    logger.error('Alert retrieval failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: { code: 'ALERTS_FAILED', message: error.message }
    });
  }
};

// DELETE /api/v1/admin/alerts - 清除告警历史
const clearAlerts = (req, res) => {
  try {
    clearAlertHistory();
    
    res.json({
      success: true,
      message: 'Alert history cleared'
    });
  } catch (error) {
    logger.error('Alert clear failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: { code: 'ALERT_CLEAR_FAILED', message: error.message }
    });
  }
};

// GET /api/v1/admin/status - 简化的系统状态
const status = async (req, res) => {
  try {
    const health = await performHealthCheck();
    
    res.json({
      success: true,
      data: {
        status: health.overall,
        timestamp: health.timestamp,
        components: Object.keys(health.checks).reduce((acc, key) => {
          acc[key] = health.checks[key].status;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    logger.error('Status check failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: { code: 'STATUS_FAILED', message: error.message }
    });
  }
};

module.exports = {
  health,
  metrics: metricsHandler,
  getAlerts,
  clearAlerts,
  status
};
