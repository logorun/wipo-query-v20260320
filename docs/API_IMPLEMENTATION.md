# API 实现计划

## 阶段1: 基础架构 (1-2天)

### 1.1 项目结构
```
wipo-trademark-batch/
├── api/
│   ├── src/
│   │   ├── server.js           # Express 主服务
│   │   ├── routes/
│   │   │   ├── tasks.js        # 任务相关路由
│   │   │   └── cache.js        # 缓存相关路由
│   │   ├── controllers/
│   │   │   ├── taskController.js
│   │   │   └── cacheController.js
│   │   ├── services/
│   │   │   ├── taskService.js   # 任务逻辑
│   │   │   ├── queueService.js  # 队列管理
│   │   │   ├── cacheService.js  # 缓存管理
│   │   │   └── queryService.js  # 查询执行
│   │   ├── models/
│   │   │   └── database.js      # SQLite 操作
│   │   ├── middleware/
│   │   │   ├── auth.js          # API Key 验证
│   │   │   ├── errorHandler.js  # 错误处理
│   │   │   └── rateLimiter.js   # 限流
│   │   └── utils/
│   │       └── helpers.js
│   ├── package.json
│   └── .env.example
├── worker/                       # 查询工作进程
│   └── queryWorker.js
└── shared/
    └── constants.js
```

### 1.2 依赖安装
```bash
cd api
npm init -y
npm install express bull sqlite3 uuid dotenv
npm install --save-dev nodemon
```

### 1.3 核心文件

**server.js**
```javascript
const express = require('express');
const taskRoutes = require('./routes/tasks');
const cacheRoutes = require('./routes/cache');

const app = express();
app.use(express.json());

app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/cache', cacheRoutes);

app.listen(3000, () => {
  console.log('API Server running on port 3000');
});
```

**数据库初始化**
```javascript
// models/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(
  path.join(__dirname, '../../data/api.db')
);

// 初始化表
const initDB = () => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      trademarks TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      progress_total INTEGER DEFAULT 0,
      progress_processed INTEGER DEFAULT 0,
      progress_failed INTEGER DEFAULT 0,
      results TEXT,
      error TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cache (
      trademark TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      hit_count INTEGER DEFAULT 0
    )
  `);
};

module.exports = { db, initDB };
```

## 阶段2: 核心功能 (2-3天)

### 2.1 任务提交接口
- POST /api/v1/tasks
- 生成唯一ID (UUID)
- 写入数据库
- 加入队列

### 2.2 任务状态查询
- GET /api/v1/tasks/:taskId
- 从数据库读取
- 返回完整状态

### 2.3 缓存查询
- GET /api/v1/cache/:trademark
- 查询 SQLite 缓存表
- forceRefresh 时创建新任务

### 2.4 任务列表
- GET /api/v1/tasks
- 支持 status/limit/offset 筛选
- 统计信息

## 阶段3: Worker 实现 (2天)

### 3.1 队列消费
- 使用 Bull 队列
- 消费待处理任务
- 调用 agent-browser 查询

### 3.2 查询执行
```javascript
// services/queryService.js
const { execSync } = require('child_process');

const queryTrademark = async (trademark) => {
  // 1. 打开页面
  execSync('agent-browser open "https://branddb.wipo.int/en/advancedsearch"');
  await sleep(5000);
  
  // 2. 选择精确匹配
  execSync('agent-browser select "e39" "is matching exact expression"');
  
  // 3. 输入商标
  execSync(`agent-browser fill "e45" "${trademark}"`);
  
  // 4. 点击搜索
  execSync('agent-browser click "e10"');
  await sleep(12000);
  
  // 5. 获取结果
  const snapshot = execSync('agent-browser snapshot').toString();
  
  // 6. 解析结果
  const records = parseSnapshot(snapshot, trademark);
  
  // 7. 关闭浏览器
  execSync('agent-browser close');
  
  return {
    trademark,
    queryStatus: records.length > 0 ? 'found' : 'not_found',
    records,
    queryTime: new Date().toISOString(),
    fromCache: false
  };
};
```

### 3.3 结果存储
- 更新任务状态
- 写入缓存表
- 触发 webhook (如有)

## 阶段4: 优化完善 (1-2天)

### 4.1 错误处理
- 重试机制 (失败任务重试3次)
- 错误日志记录
- 优雅降级

### 4.2 性能优化
- 连接池
- 缓存预热
- 批量查询优化

### 4.3 监控统计
- 任务成功率
- 平均查询时间
- 缓存命中率

---

## 数据库迁移

```bash
# 创建数据目录
mkdir -p data

# 初始化数据库
node -e "require('./api/src/models/database').initDB()"
```

---

## 启动服务

```bash
# 1. 启动 API Server
cd api && npm start

# 2. 启动 Worker (另一个终端)
node worker/queryWorker.js

# 3. 查看队列状态
redis-cli MONITOR
```

---

## API 测试

```bash
# 提交任务
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"trademarks": ["WIIM"]}'

# 查询状态
curl http://localhost:3000/api/v1/tasks/{taskId}

# 查询缓存
curl http://localhost:3000/api/v1/cache/WIIM

# 查看队列
curl "http://localhost:3000/api/v1/tasks?status=all"
```
