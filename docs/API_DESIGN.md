# WIPO Trademark Batch Query API 设计方案

## 概述

基于现有 `wipo-trademark-batch` 项目，设计一套 REST API，支持异步商标查询、状态追踪、缓存管理。

---

## 基础信息

- **Base URL**: `/api/v1`
- **Content-Type**: `application/json`
- **认证方式**: API Key (Header: `X-API-Key`)

---

## 数据模型

### 1. 任务 (Task)

```typescript
interface Task {
  id: string;                    // 唯一ID (UUID)
  trademarks: string[];          // 查询的商标列表
  status: TaskStatus;            // 任务状态
  priority: number;              // 优先级 (1-10, 默认5)
  createdAt: string;             // ISO 8601 时间
  updatedAt: string;             // ISO 8601 时间
  startedAt?: string;            // 开始处理时间
  completedAt?: string;          // 完成时间
  progress: {                    // 进度信息
    total: number;               // 总数
    processed: number;           // 已处理
    failed: number;              // 失败数
  };
  results?: TrademarkResult[];   // 查询结果
  error?: string;                // 错误信息
}

type TaskStatus = 
  | 'pending'      // 等待队列
  | 'processing'   // 查询中
  | 'completed'    // 完成
  | 'failed'       // 失败
  | 'cancelled';   // 已取消
```

### 2. 商标查询结果 (TrademarkResult)

```typescript
interface TrademarkResult {
  trademark: string;             // 查询的商标名
  queryStatus: 'found' | 'not_found' | 'error';
  records: TrademarkRecord[];    // 匹配的记录
  queryTime: string;             // 查询时间
  fromCache: boolean;            // 是否来自缓存
  cacheTime?: string;            // 缓存时间
}

interface TrademarkRecord {
  brandName: string;             // 品牌名称
  owner: string;                 // 持有人
  status: string;                // Registered/Pending/Expired/Ended...
  country: string;               // 国家/地区
  countryCode: string;           // 国家代码 (EM, ES, FR...)
  regNumber: string;             // 注册号
  regDate?: string;              // 注册日期
  niceClasses: string[];         // 尼斯分类
  isEU: boolean;                 // 是否欧盟
}
```

### 3. 缓存记录 (CacheEntry)

```typescript
interface CacheEntry {
  trademark: string;             // 商标名
  data: TrademarkResult;         // 缓存数据
  createdAt: string;             // 缓存创建时间
  updatedAt: string;             // 最后更新时间
  expiresAt: string;             // 过期时间
  hitCount: number;              // 命中次数
}
```

---

## API 端点

### 1. 提交查询任务

**POST** `/tasks`

提交单个或批量商标查询任务。

#### 请求体

```json
{
  "trademarks": ["WIIM", "9TRANSPORT"],
  "priority": 5,
  "callbackUrl": "https://example.com/webhook"
}
```

#### 参数说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| trademarks | string[] | ✅ | 商标名称列表 (1-50个) |
| priority | number | ❌ | 优先级 1-10，默认5 |
| callbackUrl | string | ❌ | 完成回调URL |

#### 响应示例

```json
{
  "success": true,
  "data": {
    "taskId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "trademarks": ["WIIM", "9TRANSPORT"],
    "createdAt": "2026-03-04T13:50:00Z",
    "estimatedTime": "60s"
  }
}
```

#### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "trademarks must contain 1-50 items",
    "details": {}
  }
}
```

---

### 2. 查询任务状态

**GET** `/tasks/:taskId`

根据任务ID查询查询情况。

#### 响应示例 - 等待队列

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "trademarks": ["WIIM", "9TRANSPORT"],
    "createdAt": "2026-03-04T13:50:00Z",
    "updatedAt": "2026-03-04T13:50:00Z",
    "progress": {
      "total": 2,
      "processed": 0,
      "failed": 0
    },
    "queuePosition": 3,
    "estimatedTime": "120s"
  }
}
```

#### 响应示例 - 查询中

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "trademarks": ["WIIM", "9TRANSPORT"],
    "createdAt": "2026-03-04T13:50:00Z",
    "startedAt": "2026-03-04T13:51:00Z",
    "updatedAt": "2026-03-04T13:51:30Z",
    "progress": {
      "total": 2,
      "processed": 1,
      "failed": 0
    },
    "currentTrademark": "9TRANSPORT"
  }
}
```

#### 响应示例 - 完成

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "trademarks": ["WIIM", "9TRANSPORT"],
    "createdAt": "2026-03-04T13:50:00Z",
    "startedAt": "2026-03-04T13:51:00Z",
    "completedAt": "2026-03-04T13:53:00Z",
    "progress": {
      "total": 2,
      "processed": 2,
      "failed": 0
    },
    "results": [
      {
        "trademark": "WIIM",
        "queryStatus": "found",
        "records": [
          {
            "brandName": "WiiM",
            "owner": "Linkplay Technology Inc. (USA)",
            "status": "Registered",
            "country": "European Union",
            "countryCode": "EM",
            "regNumber": "018867198",
            "regDate": "2023-10-05",
            "niceClasses": ["9"],
            "isEU": true
          }
        ],
        "queryTime": "2026-03-04T13:52:00Z",
        "fromCache": false
      },
      {
        "trademark": "9TRANSPORT",
        "queryStatus": "found",
        "records": [
          {
            "brandName": "9TRANSPORT",
            "owner": "JOAN MANUEL TEIXIDO BLASCO (Spain)",
            "status": "Registered",
            "country": "Spain",
            "countryCode": "ES",
            "regNumber": "M2919818",
            "regDate": "2010-08-10",
            "niceClasses": ["35"],
            "isEU": true
          }
        ],
        "queryTime": "2026-03-04T13:53:00Z",
        "fromCache": false
      }
    ]
  }
}
```

#### 响应示例 - 任务不存在

```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task with ID '550e8400-xxxx' not found"
  }
}
```

---

### 3. 查询商标缓存信息

**GET** `/cache/:trademark`

查询指定商标的缓存信息。

#### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| forceRefresh | boolean | ❌ | 强制刷新，默认false |

#### 请求示例

```
GET /cache/WIIM
GET /cache/WIIM?forceRefresh=true
```

#### 响应示例 - 缓存命中

```json
{
  "success": true,
  "data": {
    "trademark": "WIIM",
    "cached": true,
    "cacheInfo": {
      "createdAt": "2026-03-04T12:00:00Z",
      "updatedAt": "2026-03-04T12:00:00Z",
      "expiresAt": "2026-03-05T12:00:00Z",
      "age": "1h30m",
      "hitCount": 5
    },
    "data": {
      "trademark": "WIIM",
      "queryStatus": "found",
      "records": [...],
      "queryTime": "2026-03-04T12:00:00Z",
      "fromCache": true
    }
  }
}
```

#### 响应示例 - 缓存未命中

```json
{
  "success": true,
  "data": {
    "trademark": "NEWTRADEMARK",
    "cached": false,
    "message": "No cache found for this trademark"
  }
}
```

#### 响应示例 - 强制刷新

当 `forceRefresh=true` 时，系统会：
1. 将商标加入查询队列
2. 返回新创建的查询任务ID

```json
{
  "success": true,
  "data": {
    "trademark": "WIIM",
    "refreshInitiated": true,
    "taskId": "660e8400-e29b-41d4-a716-446655440001",
    "message": "Refresh queued, use taskId to track progress"
  }
}
```

---

### 4. 查看任务队列

**GET** `/tasks`

查看当前所有任务，支持筛选。

#### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | ❌ | 筛选状态: all/pending/processing/completed/failed |
| limit | number | ❌ | 返回数量，默认20，最大100 |
| offset | number | ❌ | 分页偏移，默认0 |
| sort | string | ❌ | 排序: createdAt/-createdAt，默认-createdAt |

#### 请求示例

```
GET /tasks?status=all&limit=20
GET /tasks?status=pending&limit=50
GET /tasks?status=completed&sort=-completedAt
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "total": 150,
    "pending": 3,
    "processing": 2,
    "completed": 145,
    "failed": 0,
    "tasks": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "status": "completed",
        "trademarks": ["WIIM", "9TRANSPORT"],
        "createdAt": "2026-03-04T13:50:00Z",
        "completedAt": "2026-03-04T13:53:00Z",
        "progress": {
          "total": 2,
          "processed": 2,
          "failed": 0
        }
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "status": "processing",
        "trademarks": ["IMPORTACION", "LE-CREUSET"],
        "createdAt": "2026-03-04T13:55:00Z",
        "startedAt": "2026-03-04T13:56:00Z",
        "progress": {
          "total": 2,
          "processed": 1,
          "failed": 0
        }
      },
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "status": "pending",
        "trademarks": ["LIFE EXTENSION"],
        "createdAt": "2026-03-04T13:58:00Z",
        "queuePosition": 1,
        "progress": {
          "total": 1,
          "processed": 0,
          "failed": 0
        }
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

### 5. 取消任务 (补充)

**DELETE** `/tasks/:taskId`

取消等待队列中的任务。

#### 响应示例

```json
{
  "success": true,
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "status": "cancelled",
    "message": "Task cancelled successfully"
  }
}
```

---

## 错误码

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| INVALID_REQUEST | 400 | 请求参数错误 |
| TASK_NOT_FOUND | 404 | 任务不存在 |
| CACHE_NOT_FOUND | 404 | 缓存不存在 |
| RATE_LIMITED | 429 | 请求频率过高 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 查询服务不可用 |

---

## 技术实现建议

### 架构图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  API Server │────▶│  Task Queue │
└─────────────┘     └─────────────┘     └──────┬──────┘
       │                    │                  │
       │                    ▼                  ▼
       │             ┌─────────────┐     ┌─────────────┐
       │             │   Cache     │     │  Worker     │
       │             │  (Redis)    │     │  (agent-    │
       │             └─────────────┘     │  browser)   │
       │                                   └──────┬──────┘
       │                                          │
       └──────────────────────────────────────────┘
                          Results
```

### 核心组件

1. **API Server** (Express/Fastify)
   - 接收请求，验证参数
   - 与队列和缓存交互
   - 返回响应

2. **Task Queue** (Bull/ BullMQ)
   - 基于 Redis 的任务队列
   - 支持优先级、延迟、重试

3. **Worker** 
   - 消费队列任务
   - 调用 agent-browser 执行查询
   - 更新任务状态和结果

4. **Cache** (Redis/SQLite)
   - 缓存查询结果
   - 设置过期时间（建议24小时）

### 数据库设计 (SQLite)

```sql
-- 任务表
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  trademarks TEXT NOT NULL,  -- JSON array
  status TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  progress_total INTEGER DEFAULT 0,
  progress_processed INTEGER DEFAULT 0,
  progress_failed INTEGER DEFAULT 0,
  results TEXT,  -- JSON
  error TEXT
);

-- 缓存表
CREATE TABLE cache (
  trademark TEXT PRIMARY KEY,
  data TEXT NOT NULL,  -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  hit_count INTEGER DEFAULT 0
);

-- 索引
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_created ON tasks(created_at);
CREATE INDEX idx_cache_expires ON cache(expires_at);
```

---

## 使用示例

### 场景1: 批量查询并轮询结果

```bash
# 1. 提交任务
TASK=$(curl -X POST /api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"trademarks": ["WIIM", "9TRANSPORT"]}')
TASK_ID=$(echo $TASK | jq -r '.data.taskId')

# 2. 轮询状态
while true; do
  STATUS=$(curl /api/v1/tasks/$TASK_ID | jq -r '.data.status')
  echo "Status: $STATUS"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 5
done

# 3. 获取结果
curl /api/v1/tasks/$TASK_ID | jq '.data.results'
```

### 场景2: 查询缓存并刷新

```bash
# 查询缓存
curl /api/v1/cache/WIIM

# 强制刷新
curl "/api/v1/cache/WIIM?forceRefresh=true"
```

### 场景3: 查看队列状态

```bash
# 查看待处理任务
curl "/api/v1/tasks?status=pending"

# 查看所有已完成任务
curl "/api/v1/tasks?status=completed&limit=100"
```

---

## 待实现功能

- [ ] Webhook 回调通知
- [ ] 批量导出结果 (CSV/Excel)
- [ ] 任务重试机制
- [ ] 查询统计报表
- [ ] API 限流控制
