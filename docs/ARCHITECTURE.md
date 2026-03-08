# WIPO 商标批量查询系统 - 架构文档

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户上传 Excel                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dashboard (前端)                                                            │
│  ├─ 读取 Excel 文件                                                          │
│  ├─ POST /api/v1/extract/stream  (SSE 流式处理)                              │
│  └─ 实时显示提取进度                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  API Server (extractController.js)                                          │
│  ├─ 解析 Excel 数据                                                          │
│  ├─ AI/fallback 提取商标名称                                                 │
│  ├─ 创建 Task 记录 → SQLite (tasks 表)                                       │
│  │    └─ status: "paused" (等待用户点击开始)                                  │
│  └─ 返回 taskId 给前端                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                         用户点击 "绿色三角形" 开始
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  API Server (taskController.js - start)                                     │
│  ├─ 检查 status === "paused"                                                 │
│  ├─ 更新 status → "pending"                                                  │
│  └─ 调用 addTaskToQueue(taskId, trademarks, priority)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Redis Queue (Bull)                                                         │
│  ├─ bull:trademark-query:wait   (等待队列)                                   │
│  ├─ bull:trademark-query:active (处理中)                                     │
│  └─ 按 priority 排序，FIFO 处理                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Worker (queryWorker.js)                                                    │
│  ├─ 从 Redis 队列获取任务                                                     │
│  ├─ 更新 status → "processing"                                               │
│  ├─ 逐个查询商标:                                                            │
│  │    ├─ 检查 Cache (SQLite cache 表) - 命中则跳过                            │
│  │    ├─ Playwright 打开 WIPO 网站查询                                       │
│  │    ├─ 截图保存 → output/evidence/                                         │
│  │    ├─ 解析结果                                                            │
│  │    └─ 写入 Cache (24小时有效)                                             │
│  ├─ 更新 progress_processed / progress_failed                                │
│  ├─ 所有商标处理完成后:                                                       │
│  │    ├─ 保存 results → SQLite (tasks.results 字段)                          │
│  │    └─ 更新 status → "completed"                                           │
│  └─ 单线程处理 (concurrency = 1)                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  导出 Excel (exportController.js - exportBatch)                             │
│  ├─ 读取 tasks 表中的 results                                                │
│  ├─ 三种状态处理:                                                            │
│  │    ├─ 有 records → 显示详细数据                                           │
│  │    ├─ queryStatus: not_found → 显示 "未找到"                              │
│  │    └─ 无 result → 显示 "暂未抓取"                                          │
│  └─ 生成 Excel 返回                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 关键存储位置

| 存储 | 内容 | 位置 |
|------|------|------|
| **SQLite** | 任务数据、查询结果、缓存 | `api/data/api.db` |
| **Redis** | 任务队列 | `localhost:6379` |
| **文件系统** | 截图证据 | `output/evidence/` |

## 任务状态流转

```
paused → pending → processing → completed
         (添加到队列) (worker处理中)   (完成)
              ↓            ↓
            failed       failed
```

| 状态 | 说明 |
|------|------|
| `paused` | 任务已创建，等待用户点击开始 |
| `pending` | 已添加到 Redis 队列，等待 Worker 处理 |
| `processing` | Worker 正在处理中 |
| `completed` | 所有商标查询完成 |
| `failed` | 处理失败 |

## 数据库表结构

### tasks 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 任务唯一标识 |
| trademarks | JSON | 商标名称数组 |
| status | TEXT | 任务状态 |
| priority | INTEGER | 优先级 (1-10) |
| results | JSON | 查询结果 |
| progress_total | INTEGER | 商标总数 |
| progress_processed | INTEGER | 已处理数量 |
| progress_failed | INTEGER | 失败数量 |

### cache 表

| 字段 | 类型 | 说明 |
|------|------|------|
| trademark | TEXT | 商标名称 (主键) |
| data | JSON | 查询结果 |
| expires_at | DATETIME | 过期时间 (24小时) |
| hit_count | INTEGER | 缓存命中次数 |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/extract/stream` | POST | SSE 流式提取商标 |
| `/api/v1/tasks` | GET | 获取任务列表 |
| `/api/v1/tasks/:id/start` | POST | 开始任务 |
| `/api/v1/tasks/:id/pause` | POST | 暂停任务 |
| `/api/v1/export/batch` | POST | 批量导出 Excel |

## PM2 服务

| 服务 | 说明 |
|------|------|
| `wipo-api` | API 服务器 |
| `wipo-worker` | 查询 Worker (单线程) |
| `wipo-dashboard` | 前端 Dashboard |
