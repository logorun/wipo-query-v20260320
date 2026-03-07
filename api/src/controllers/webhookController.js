const webhookService = require('../services/webhookService');
const axios = require('axios');
const { body, param, validationResult } = require('express-validator');

/**
 * Register a new webhook
 * POST /webhooks
 */
const registerWebhook = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { url, events, description } = req.body;
  const webhook = await webhookService.registerWebhook(url, events || ['task.completed'], description || '');
  
  res.status(201).json({
    success: true,
    data: {
      id: webhook.id,
      url: webhook.url,
      secret: webhook.secret,
      events: webhook.events,
      message: 'Webhook registered. Save the secret - it will not be shown again.'
    }
  });
};

/**
 * List all webhooks
 * GET /webhooks
 */
const listWebhooks = async (req, res) => {
  const webhooks = webhookService.listWebhooks();
  res.json({ success: true, data: webhooks });
};

/**
 * Delete a webhook
 * DELETE /webhooks/:id
 */
const deleteWebhook = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  await webhookService.deleteWebhook(req.params.id);
  res.json({ success: true, message: 'Webhook deleted' });
};

/**
 * Test a webhook endpoint
 * POST /webhooks/test
 */
const testWebhook = async (req, res) => {
  const { url } = req.body;
  
  try {
    await axios.post(url, {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'Test webhook from WIPO API' }
    }, { timeout: 10000 });
    
    res.json({ success: true, message: 'Test webhook sent successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

module.exports = {
  registerWebhook,
  listWebhooks,
  deleteWebhook,
  testWebhook
};
