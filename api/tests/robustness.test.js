/**
 * 健壮性增强测试
 * 验证熔断器、重试、验证等功能
 */

const assert = require('assert');
const { 
  CircuitBreaker, 
  CircuitBreakerRegistry,
  CircuitBreakerError 
} = require('../src/utils/circuitBreaker');
const {
  validateTrademark,
  validateTrademarkBatch,
  validateUUID
} = require('../src/middleware/validation');
const {
  AppError,
  ValidationError,
  ErrorTypes
} = require('../src/utils/errors');

console.log('🧪 Running Robustness Tests\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

// Circuit Breaker Tests
console.log('--- Circuit Breaker Tests ---');

test('CircuitBreaker should start in CLOSED state', () => {
  const cb = new CircuitBreaker({ name: 'test' });
  assert.strictEqual(cb.state, 'CLOSED');
});

test('CircuitBreaker should open after threshold failures', async () => {
  const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3 });
  
  // 3次失败
  for (let i = 0; i < 3; i++) {
    try {
      await cb.execute(() => { throw new Error('fail'); });
    } catch (e) {}
  }
  
  assert.strictEqual(cb.state, 'OPEN');
});

test('CircuitBreaker should reject calls when OPEN', async () => {
  const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1 });
  
  try {
    await cb.execute(() => { throw new Error('fail'); });
  } catch (e) {}
  
  try {
    await cb.execute(() => 'success');
    assert.fail('Should have thrown');
  } catch (e) {
    assert(e instanceof CircuitBreakerError);
  }
});

test('CircuitBreaker should track stats', async () => {
  const cb = new CircuitBreaker({ name: 'test' });
  
  await cb.execute(() => 'success');
  await cb.execute(() => { throw new Error('fail'); }).catch(() => {});
  
  const stats = cb.getState().stats;
  assert.strictEqual(stats.totalCalls, 2);
  assert.strictEqual(stats.successfulCalls, 1);
  assert.strictEqual(stats.failedCalls, 1);
});

// Validation Tests
console.log('\n--- Validation Tests ---');

test('validateTrademark should accept valid names', () => {
  const result = validateTrademark('Apple');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.value, 'Apple');
});

test('validateTrademark should reject empty names', () => {
  const result = validateTrademark('');
  assert.strictEqual(result.valid, false);
});

test('validateTrademark should reject too long names', () => {
  const result = validateTrademark('A'.repeat(101));
  assert.strictEqual(result.valid, false);
});

test('validateTrademark should reject special characters', () => {
  const result = validateTrademark('Apple<script>');
  assert.strictEqual(result.valid, false);
});

test('validateTrademark should reject pure numbers', () => {
  const result = validateTrademark('12345');
  assert.strictEqual(result.valid, false);
});

test('validateTrademark should trim whitespace', () => {
  const result = validateTrademark('  Apple  ');
  assert.strictEqual(result.value, 'Apple');
});

test('validateTrademarkBatch should accept valid batch', () => {
  const result = validateTrademarkBatch(['Apple', 'Google', 'Microsoft']);
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.trademarks.length, 3);
});

test('validateTrademarkBatch should reject oversized batch', () => {
  const trademarks = Array(51).fill('Apple');
  const result = validateTrademarkBatch(trademarks);
  assert.strictEqual(result.valid, false);
});

test('validateTrademarkBatch should deduplicate', () => {
  const result = validateTrademarkBatch(['Apple', 'Apple', 'Apple']);
  assert.strictEqual(result.trademarks.length, 1);
  assert.strictEqual(result.duplicates, 2);
});

test('validateUUID should accept valid UUID', () => {
  assert.strictEqual(
    validateUUID('550e8400-e29b-41d4-a716-446655440000'),
    true
  );
});

test('validateUUID should reject invalid UUID', () => {
  assert.strictEqual(validateUUID('not-a-uuid'), false);
  assert.strictEqual(validateUUID(''), false);
});

// Error Tests
console.log('\n--- Error Tests ---');

test('AppError should have correct properties', () => {
  const err = new AppError('test', 'TEST_CODE', 500);
  assert.strictEqual(err.message, 'test');
  assert.strictEqual(err.code, 'TEST_CODE');
  assert.strictEqual(err.statusCode, 500);
});

test('ValidationError should have 400 status', () => {
  const err = new ValidationError('invalid');
  assert.strictEqual(err.statusCode, 400);
  assert.strictEqual(err.code, 'VALIDATION_ERROR');
});

test('ErrorTypes.isRetryable should identify retryable errors', () => {
  const timeoutErr = new AppError('timeout', 'TIMEOUT', 504);
  assert.strictEqual(ErrorTypes.isRetryable(timeoutErr), true);
  
  const validationErr = new ValidationError('bad input');
  assert.strictEqual(ErrorTypes.isRetryable(validationErr), false);
});

test('ErrorTypes.isValidationError should identify validation errors', () => {
  const err = new ValidationError('invalid');
  assert.strictEqual(ErrorTypes.isValidationError(err), true);
});

// Registry Tests
console.log('\n--- Circuit Breaker Registry Tests ---');

test('Registry should create and retrieve breakers', () => {
  const registry = new CircuitBreakerRegistry();
  const cb = registry.get('service-a');
  
  assert(cb instanceof CircuitBreaker);
  assert.strictEqual(registry.get('service-a'), cb); // Same instance
});

test('Registry should return all states', () => {
  const registry = new CircuitBreakerRegistry();
  registry.get('service-a');
  registry.get('service-b');
  
  const states = registry.getAllStates();
  assert(Object.keys(states).includes('service-a'));
  assert(Object.keys(states).includes('service-b'));
});

test('Registry should reset specific breaker', () => {
  const registry = new CircuitBreakerRegistry();
  const cb = registry.get('service-a', { failureThreshold: 1 });
  
  try {
    cb.executeSync(() => { throw new Error('fail'); });
  } catch (e) {}
  
  assert.strictEqual(cb.state, 'OPEN');
  
  registry.reset('service-a');
  assert.strictEqual(cb.state, 'CLOSED');
});

// Summary
console.log('\n--- Test Summary ---');
console.log(`Total: ${passed + failed}`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);

if (failed > 0) {
  process.exit(1);
}
