# WIPO API Services 分析报告

**生成时间**: 2026-03-06T10:30:00 UTC  
**总文件数**: 3  
**总方法数**: 19

---

## 1. queueService.js

**路径**: `api/src/services/queueService.js`  
**描述**: 增强队列服务 - 带连接健康检查和自动恢复  
**导出**: 11 个方法/对象

| 方法名 | 类型 | 描述 |
|--------|------|------|
| `queryQueue` | object | Bull 队列实例，直接导出队列对象 |
| `addTaskToQueue` | function | 添加任务到队列，包含 Redis 连接检查和自动重连 |
| `getQueueStats` | function | 获取队列统计信息（等待中/进行中/已完成/失败/延迟任务数） |
| `getJob` | function | 根据 jobId 获取任务详情 |
| `cleanOldJobs` | function | 清理已完成（24小时）和失败（7天）的旧任务 |
| `pauseQueue` | function | 暂停队列，不再接受新任务 |
| `resumeQueue` | function | 恢复队列，继续处理任务 |
| `gracefulShutdown` | function | 优雅关闭：暂停队列，等待活跃任务完成，然后关闭连接 |
| `healthCheck` | function | 健康检查：验证 Redis 连接状态 |
| `waitForConnection` | function | 等待队列连接就绪，支持超时控制 |
| `connectionState` | object | 连接状态对象，包含 isConnected、lastError、reconnectAttempts 等 |

---

## 2. cacheService.js

**路径**: `api/src/services/cacheService.js`  
**描述**: 缓存服务 - 基于 SQLite 的商标数据缓存  
**导出**: 4 个方法

| 方法名 | 类型 | 描述 |
|--------|------|------|
| `cacheService.get` | function | 获取缓存数据，返回缓存是否命中、缓存信息（创建时间/过期时间/命中率）和数据 |
| `cacheService.set` | function | 设置缓存数据，默认 TTL 为 24 小时 |
| `cacheService.delete` | function | 删除指定商标的缓存 |
| `cacheService.clearExpired` | function | 清空所有过期的缓存条目 |

---

## 3. webhookService.js

**路径**: `api/src/services/webhookService.js`  
**描述**: Webhook 服务 - 任务完成/失败通知  
**导出**: 6 个方法（单例模式）

| 方法名 | 类型 | 描述 |
|--------|------|------|
| `registerWebhook` | async function | 注册新的 Webhook，包含自动生成 secret 和唯一 ID |
| `deleteWebhook` | async function | 根据 ID 删除 Webhook |
| `listWebhooks` | function | 列出所有已注册的 Webhook（不包含 secret） |
| `sendWebhook` | async function | 发送 Webhook 事件，支持重试机制（最多 3 次） |
| `notifyTaskCompleted` | async function | 发送任务完成通知，包含 taskId、trademarks、resultsCount |
| `notifyTaskFailed` | async function | 发送任务失败通知，包含 taskId 和错误信息 |

---

## 备注

- **任务说明** 中提到的 `taskService.js` 不存在于 `api/src/services/` 目录下
- 实际存在的 service 文件为: `queueService.js`, `cacheService.js`, `webhookService.js`
- 本分析基于实际读取的文件内容
