/**
 * 熔断器模式实现
 * 防止故障扩散，提高系统稳定性
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 熔断后等待时间
    this.name = options.name || 'default';
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();
    
    // 统计信息
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      stateChanges: []
    };
  }

  /**
   * 执行被保护的函数
   */
  async execute(fn, ...args) {
    this.stats.totalCalls++;

    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedCalls++;
        throw new CircuitBreakerError(
          `Circuit breaker '${this.name}' is OPEN`,
          this.name,
          this.state,
          this.getRetryAfter()
        );
      }
      // 进入半开状态，允许试探请求
      this.transitionTo('HALF_OPEN');
    }

    try {
      const result = await fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 同步执行版本
   */
  executeSync(fn, ...args) {
    this.stats.totalCalls++;

    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedCalls++;
        throw new CircuitBreakerError(
          `Circuit breaker '${this.name}' is OPEN`,
          this.name,
          this.state,
          this.getRetryAfter()
        );
      }
      this.transitionTo('HALF_OPEN');
    }

    try {
      const result = fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.stats.successfulCalls++;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transitionTo('CLOSED');
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.stats.failedCalls++;

    if (this.state === 'HALF_OPEN') {
      // 半开状态下失败，立即回到断开状态
      this.transitionTo('OPEN');
    } else if (this.failures >= this.failureThreshold) {
      this.transitionTo('OPEN');
    }
  }

  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    
    this.stats.stateChanges.push({
      from: oldState,
      to: newState,
      time: new Date().toISOString()
    });

    if (newState === 'OPEN') {
      this.nextAttempt = Date.now() + this.timeout;
      this.successes = 0;
    } else if (newState === 'CLOSED') {
      this.failures = 0;
      this.successes = 0;
    }
  }

  getRetryAfter() {
    if (this.state !== 'OPEN') return 0;
    return Math.max(0, Math.ceil((this.nextAttempt - Date.now()) / 1000));
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      stats: this.stats,
      retryAfter: this.getRetryAfter()
    };
  }

  /**
   * 手动重置熔断器
   */
  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.stats.stateChanges.push({
      from: this.state,
      to: 'CLOSED',
      time: new Date().toISOString(),
      reason: 'manual_reset'
    });
  }
}

/**
 * 熔断器错误类
 */
class CircuitBreakerError extends Error {
  constructor(message, breakerName, state, retryAfter) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.breakerName = breakerName;
    this.state = state;
    this.retryAfter = retryAfter;
    this.code = 'CIRCUIT_BREAKER_OPEN';
  }
}

/**
 * 熔断器管理器 - 管理多个熔断器实例
 */
class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
  }

  get(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.breakers.get(name);
  }

  getAllStates() {
    const states = {};
    for (const [name, breaker] of this.breakers) {
      states[name] = breaker.getState();
    }
    return states;
  }

  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  reset(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }
}

// 单例实例
const registry = new CircuitBreakerRegistry();

module.exports = {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerRegistry,
  registry
};
