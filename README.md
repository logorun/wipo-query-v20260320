# WIPO Brand Database 欧盟商标批量查询工具

> **版本**: v3.2.0  
> **最后更新**: 2026-03-04  
> **状态**: ✅ Worker 已增强 (国际注册展开、证据留存)

---

## 📖 项目简介

本项目使用 **agent-browser** (Vercel Labs) 自动化查询 **WIPO Brand Database**，获取指定商标在**欧盟国家**的注册情况。

### 核心功能

- ✅ 精确匹配查询 ("is matching exact expression")
- ✅ 自动筛选欧盟国家 (EM + 27 成员国)
- ✅ 缓存机制 (避免重复查询)
- ✅ 断点续传 (中断后自动继续)
- ✅ 失败重试 (最多 3 次)
- ✅ 输出 CSV/Excel/JSON

---

## 🚀 快速开始

### 前置要求

1. **Node.js** >= 18
2. **agent-browser** (全局安装)
   ```bash
   npm install -g agent-browser
   ```

### 安装依赖

```bash
cd projects/wipo-trademark-batch
npm install
```

### 配置商标列表

编辑 `src/query-trademarks.js`，修改 `trademarks` 数组：

```javascript
const trademarks = [
  'YOUR_BRAND_1',
  'YOUR_BRAND_2',
  '9TRANSPORT',  // 示例
  // ... 更多商标
];
```

### 运行查询

```bash
npm start
```

或

```bash
bash scripts/run.sh
```

---

## 📊 输出文件

查询完成后，在 `output/` 目录生成：

| 文件 | 格式 | 说明 |
|------|------|------|
| `trademark-eu-results.csv` | CSV | 逗号分隔，方便 Excel 导入 |
| `trademark-eu-results.xlsx` | Excel | 带格式，已优化列宽 |
| `trademark-eu-results.json` | JSON | 完整数据结构 |
| `query-cache.json` | JSON | 缓存数据，可删除后重新查询 |

### 输出字段

- **商标名称** - 查询的商标名
- **完整名称** - Brand Database 中的完整名称
- **状态** - Registered / Pending / Expired / Refused
- **来源国** - 国家代码 (如 ES, EM, DE)
- **注册号** - 商标注册号
- **注册日期** - 注册日期 (YYYY-MM-DD)
- **数据来源** - "缓存" 或 "实时"

---

## ⚙️ 配置参数

在 `src/query-trademarks.js` 中修改 `CONFIG`：

```javascript
const CONFIG = {
  maxResultsPerTrademark: 20,  // 每个商标最多获取结果数
  retryAttempts: 3,            // 失败重试次数
  retryDelay: 5000,            // 重试间隔 (毫秒)
  queryDelay: 3000,            // 商标间查询间隔 (毫秒)
  enableCache: true,           // 是否启用缓存
  enableResume: true           // 是否启用断点续传
};
```

---

## 🗂️ 项目结构

```
wipo-trademark-batch/
├── README.md                  # 本文件
├── package.json               # 项目配置
├── src/
│   └── query-trademarks.js   # 主查询脚本 ⭐
├── docs/
│   ├── README.md             # 详细使用说明
│   ├── lessons-learned.md    # 踩坑记录 (重要!)
│   └── UPDATE_LOG.md         # 版本更新日志
├── scripts/
│   └── run.sh                # 一键运行脚本
└── output/                   # 查询结果输出目录
    ├── trademark-eu-results.*
    ├── query-cache.json      # 缓存文件
    └── progress.json         # 进度文件 (查询中出现)
```

---

## 🐛 故障排除

### 问题1: 找不到 agent-browser

**症状**: `Error: agent-browser command not found`

**解决**:
```bash
npm install -g agent-browser
```

### 问题2: 查询结果为 0

**检查清单**:
1. 确认商标名称拼写正确
2. 确认该商标在欧盟有注册
3. 查看 `output/progress.json` 确认进度
4. 删除 `output/query-cache.json` 后重试

### 问题3: 搜索策略未生效

**说明**: 如果看到 "contains the word" 而不是 "is matching exact expression"，说明精确匹配未生效。

**解决**: 代码已修复，确保使用的是 v2.3.0+ 版本。

### 问题4: 查询中断

**解决**: 直接重新运行 `npm start`，会自动从上次位置继续。

---

## 📝 重要提示

### 关于精确匹配

Brand Database 支持多种搜索策略：
- `contains the word` - 包含 (模糊匹配，结果多)
- `is matching exact expression` - 精确匹配 (结果少，本项目使用)
- `contains word that resembles` - 相似词
- `contains word that sounds like` - 同音词

**本项目强制使用精确匹配**，只有完全相同的商标名才会返回。

### 关于欧盟国家

欧盟国家代码：
- **EM** - European Union (欧盟)
- **ES** - Spain (西班牙) 🇪🇸
- **DE** - Germany (德国) 🇩🇪
- **FR** - France (法国) 🇫🇷
- **IT** - Italy (意大利) 🇮🇹
- 以及其他 23 个成员国

**注意**: 非欧盟国家的结果会被自动过滤。

### 关于查询速度

- 每个商标约 20-30 秒
- 40 个商标约 15-20 分钟
- 受 WIPO 网站响应速度影响

---

## 🔍 示例

### 示例1: 查询 "9TRANSPORT"

**结果**: 2 条记录，都来自 **西班牙 (ES)**

| 商标名称 | 来源国 | 状态 | 注册号 |
|----------|--------|------|--------|
| 9TRANSPORT | ES | Registered | M2919818 |
| 9TRANSPORT | ES | Registered | M4123051 |

**结论**: 该商标在 **欧盟（西班牙）** 注册。

### 示例2: 查询 "DISNEY"

预期结果: 大量记录，涵盖多个欧盟国家

---

## 📚 参考文档

- [详细使用说明](docs/README.md)
- [踩坑记录](docs/lessons-learned.md) ⭐ 必读！
- [版本更新日志](docs/UPDATE_LOG.md)
- [WIPO Brand Database](https://branddb.wipo.int/)
- [agent-browser GitHub](https://github.com/vercel-labs/agent-browser)

---

## ⚠️ 免责声明

- 本工具仅供学习和研究使用
- 查询结果来源于 WIPO Brand Database，请以官方数据为准
- 请遵守 WIPO 的使用条款和速率限制

---

## 🆘 需要帮助？

1. 查看 [踩坑记录](docs/lessons-learned.md)
2. 检查 [UPDATE_LOG](docs/UPDATE_LOG.md) 是否有相关修复
3. 查看 `output/` 目录下的日志文件

---

---

## 🌐 REST API

项目现已提供 REST API 接口，支持异步查询和缓存管理。

### API 特性

- ✅ 异步任务队列 (Bull + Redis)
- ✅ 任务状态追踪 (pending/processing/completed/failed)
- ✅ 缓存管理 (24h TTL, 强制刷新)
- ✅ 批量查询支持 (1-50 个商标)

### 快速开始

```bash
cd api
npm install

# 启动 Redis
redis-server --daemonize yes

# 启动 API Server
npm start

# 启动 Worker (另一个终端)
npm run worker
```

### API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/tasks` | 提交查询任务 |
| GET | `/api/v1/tasks/:taskId` | 查询任务状态 |
| GET | `/api/v1/tasks` | 查看任务队列 |
| GET | `/api/v1/cache/:trademark` | 查询缓存 |

### 使用示例

```bash
# 提交任务
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"trademarks": ["WIIM", "9TRANSPORT"]}'

# 查询状态
curl http://localhost:3000/api/v1/tasks/TASK_ID

# 查询缓存
curl http://localhost:3000/api/v1/cache/WIIM
```

详见: [api/README.md](api/README.md)

---

## 🔧 开发者须知

### 接手项目必读

1. **关键问题**: Worker 曾遇到 `select "e39"` 超时问题，已修复为容错执行方式
   - 见 `api/worker/queryWorker.js` 中的 `execAgent()` 函数
   - 原理：错误捕获后不抛出，继续执行

2. **进程管理**: 必须使用 PM2 运行，不能裸运行 Node.js
   ```bash
   pm2 start api/ecosystem.config.js
   ```

3. **默认 API Key**: `logotestkey` (开发测试用，生产环境请更换)

4. **已知限制**:
   - agent-browser 查询约 30 秒/商标
   - WIPO 网站响应速度影响成功率
   - 欧盟记录识别逻辑可能需要微调

### 项目结构
```
projects/wipo-trademark-batch/
├── api/                       # REST API
│   ├── src/
│   │   ├── server.js         # Express 主服务
│   │   ├── services/
│   │   │   └── queueService.js   # Bull 队列
│   │   ├── models/
│   │   │   └── database.js   # SQLite 操作
│   │   └── config/
│   │       └── index.js      # 配置管理
│   ├── worker/
│   │   └── queryWorker.js    # Worker 主逻辑 ⭐关键文件
│   └── ecosystem.config.js   # PM2 配置
├── src/
│   └── query-trademarks.js   # 手动查询脚本
├── output/                    # 查询结果输出
└── docs/                      # 项目文档
```

### 调试技巧
```bash
# 查看 Worker 日志
pm2 logs wipo-worker

# 手动测试单个商标
cd api && node -e "
const { execSync } = require('child_process');
const execAgent = (cmd, t) => { try { return execSync('agent-browser ' + cmd, { encoding: 'utf-8', timeout: t }); } catch (e) { return e.stdout || ''; } };
execAgent('open \"https://branddb.wipo.int/en/advancedsearch\" --json', 30000);
setTimeout(() => { execAgent('select \"e39\" \"is matching exact expression\"', 30000); }, 10000);
"
```

---

## 🚀 部署指南

### 一键部署

项目提供自动化部署脚本，快速启动所有服务：

```bash
# 一键部署 (包含所有依赖检查和服务启动)
./scripts/deploy.sh
```

### 部署脚本功能

- ✅ 检查系统依赖 (Node.js, Redis, PM2, agent-browser)
- ✅ 自动安装缺失依赖
- ✅ 配置环境变量
- ✅ 启动 Redis 服务
- ✅ 使用 PM2 启动 API 和 Worker
- ✅ 执行健康检查

### 手动部署

如果需要手动部署：

```bash
# 1. 安装依赖
npm install
cd api && npm install

# 2. 配置环境变量
cp api/.env.example api/.env
vim api/.env

# 3. 启动 Redis
bash scripts/setup-redis.sh start

# 4. 使用 PM2 启动服务
pm2 start api/ecosystem.config.js
```

### Docker 部署 (可选)

```bash
# 使用 Docker Compose
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `./scripts/deploy.sh` | 一键部署 |
| `./scripts/backup.sh auto` | 自动备份 |
| `./scripts/backup.sh restore` | 恢复数据 |
| `pm2 status` | 查看服务状态 |
| `pm2 logs` | 查看日志 |

详见: [部署文档](docs/DEPLOYMENT.md)

---

**Made with ❤️ by Musk (OpenClaw)**
