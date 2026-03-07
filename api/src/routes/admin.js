const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// GET /api/v1/admin/health - 健康状态
router.get('/health', adminController.health);

// GET /api/v1/admin/metrics - 详细指标
router.get('/metrics', adminController.metrics);

// GET /api/v1/admin/alerts - 告警历史
router.get('/alerts', adminController.getAlerts);

// DELETE /api/v1/admin/alerts - 清除告警历史
router.delete('/alerts', adminController.clearAlerts);

// GET /api/v1/admin/status - 简化的系统状态
router.get('/status', adminController.status);

module.exports = router;
