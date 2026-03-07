const express = require('express');
const webhookController = require('../controllers/webhookController');
const { body, param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.post('/webhooks', [
  body('url').isURL().withMessage('Valid URL required'),
  body('events').optional().isArray(),
  body('description').optional().isString()
], asyncHandler(webhookController.registerWebhook));

router.get('/webhooks', asyncHandler(webhookController.listWebhooks));

router.delete('/webhooks/:id', [
  param('id').isUUID().withMessage('Valid webhook ID required')
], asyncHandler(webhookController.deleteWebhook));

router.post('/webhooks/test', [
  body('url').isURL().withMessage('Valid URL required')
], asyncHandler(webhookController.testWebhook));

module.exports = router;
