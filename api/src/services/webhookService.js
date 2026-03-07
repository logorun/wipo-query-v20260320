const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const WEBHOOKS_FILE = path.join(__dirname, '../../data/webhooks.json');

class WebhookService {
  constructor() {
    this.webhooks = this.loadWebhooks();
  }

  loadWebhooks() {
    try {
      if (fs.existsSync(WEBHOOKS_FILE)) {
        return JSON.parse(fs.readFileSync(WEBHOOKS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to load webhooks:', e.message);
    }
    return [];
  }

  saveWebhooks() {
    const dir = path.dirname(WEBHOOKS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(this.webhooks, null, 2));
  }

  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateSignature(payload, secret) {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  async registerWebhook(url, events = ['task.completed'], description = '') {
    const webhook = {
      id: crypto.randomUUID(),
      url,
      events,
      description,
      secret: this.generateSecret(),
      active: true,
      createdAt: new Date().toISOString()
    };
    this.webhooks.push(webhook);
    this.saveWebhooks();
    return webhook;
  }

  async deleteWebhook(id) {
    const index = this.webhooks.findIndex(w => w.id === id);
    if (index === -1) {
      throw new Error('Webhook not found');
    }
    this.webhooks.splice(index, 1);
    this.saveWebhooks();
    return true;
  }

  listWebhooks() {
    return this.webhooks.map(w => ({
      id: w.id,
      url: w.url,
      events: w.events,
      description: w.description,
      active: w.active,
      createdAt: w.createdAt
    }));
  }

  async sendWebhook(event, data) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data
    };
    const payloadString = JSON.stringify(payload);

    const results = [];
    for (const webhook of this.webhooks) {
      if (!webhook.active) continue;
      if (!webhook.events.includes(event) && !webhook.events.includes('*')) continue;

      const signature = this.generateSignature(payloadString, webhook.secret);
      let success = false;
      let error = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await axios.post(webhook.url, payload, {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              'X-Webhook-Event': event
            },
            timeout: 30000
          });
          success = true;
          break;
        } catch (e) {
          error = e.message;
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
        }
      }

      results.push({
        webhookId: webhook.id,
        url: webhook.url,
        success,
        error
      });
    }
    return results;
  }

  async notifyTaskCompleted(taskId, trademarks, results) {
    return this.sendWebhook('task.completed', {
      taskId,
      trademarks,
      resultsCount: results?.length || 0,
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  }

  async notifyTaskFailed(taskId, error) {
    return this.sendWebhook('task.failed', {
      taskId,
      status: 'failed',
      error: error.message || error,
      failedAt: new Date().toISOString()
    });
  }
}

module.exports = new WebhookService();
