/**
 * 指标监控和性能追踪
 */
class Metrics {
  constructor() {
    this.counters = new Map();
    this.timers = new Map();
    this.gauges = new Map();
    this.startTime = Date.now();
  }

  // 计数器
  increment(name, labels = {}, value = 1) {
    const key = this._key(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  // 计时器
  timing(name, duration, labels = {}) {
    const key = this._key(name, labels);
    if (!this.timers.has(key)) {
      this.timers.set(key, []);
    }
    this.timers.get(key).push(duration);
  }

  // 仪表盘值
  gauge(name, value, labels = {}) {
    const key = this._key(name, labels);
    this.gauges.set(key, value);
  }

  // 生成键
  _key(name, labels) {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  // 获取统计信息
  getStats() {
    const stats = {
      uptime: Date.now() - this.startTime,
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      timers: {}
    };

    // 计算计时器统计
    for (const [key, values] of this.timers) {
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        stats.timers[key] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1]
        };
      }
    }

    return stats;
  }

  // 重置
  reset() {
    this.counters.clear();
    this.timers.clear();
    this.gauges.clear();
    this.startTime = Date.now();
  }
}

// 单例
const metrics = new Metrics();

// 中间件：请求追踪
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // 记录活跃请求
  metrics.gauge('http_requests_active', 
    (metrics.gauges.get('http_requests_active') || 0) + 1
  );

  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = `${req.method} ${req.route?.path || req.path}`;
    const status = res.statusCode;

    // 请求计数
    metrics.increment('http_requests_total', { route, status: status.toString() });
    
    // 请求时长
    metrics.timing('http_request_duration_ms', duration, { route });
    
    // 减少活跃请求计数
    const active = (metrics.gauges.get('http_requests_active') || 1) - 1;
    metrics.gauge('http_requests_active', active);
  });

  next();
};

module.exports = { metrics, metricsMiddleware };
