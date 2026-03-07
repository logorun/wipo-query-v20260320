# WIPO Trademark Batch 部署文档

> **版本**: 1.0.0  
> **更新日期**: 2026-03-04

本文档详细介绍 WIPO Trademark Batch 项目的部署流程，包括环境要求、安装步骤、配置说明和运维指南。

---

## 📋 目录

1. [环境要求](#环境要求)
2. [安装步骤](#安装步骤)
3. [配置说明](#配置说明)
4. [PM2 部署指南](#pm2-部署指南)
5. [Docker 部署 (可选)](#docker-部署-可选)
6. [更新和维护](#更新和维护)
7. [故障排除](#故障排除)
8. [备份与恢复](#备份与恢复)

---

## 🖥️ 环境要求

### 硬件要求

| 资源 | 最低配置 | 推荐配置 |
|------|----------|----------|
| CPU | 2 核 | 4 核 |
| 内存 | 2 GB | 4 GB |
| 磁盘 | 10 GB | 50 GB |
| 网络 | 10 Mbps | 100 Mbps |

### 软件要求

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| **Node.js** | >= 18.0.0 | 建议使用 LTS 版本 |
| **Redis** | >= 6.0 | 任务队列和缓存 |
| **PM2** | >= 5.0 | 进程管理 |
| **agent-browser** | 最新版 | 浏览器自动化 |

### 系统要求

- **操作系统**: Linux (Ubuntu 20.04+ / Debian 11+)
- **用户权限**: root 或具有 sudo 权限的用户
- **防火墙**: 开放端口 3000 (API)

---

## 🚀 安装步骤

### 1. 克隆项目

```bash
git clone <repository-url> wipo-trademark-batch
cd wipo-trademark-batch
```

### 2. 安装系统依赖

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y redis-server build-essential python3

# 检查 Node.js 版本
node --version  # 应 >= 18.0.0
```

### 3. 安装 PM2

```bash
sudo npm install -g pm2
```

### 4. 安装 agent-browser

```bash
sudo npm install -g agent-browser
```

### 5. 安装项目依赖

```bash
# 主项目依赖
npm install

# API 依赖
cd api
npm install
cd ..
```

### 6. 配置环境变量

```bash
# 复制环境变量模板
cp api/.env.example api/.env

# 编辑配置 (详见下文配置说明)
vim api/.env
```

---

## ⚙️ 配置说明

### 环境变量 (.env)

在 `api/.env` 文件中配置以下变量：

```bash
# ===========================================
# 服务器配置
# ===========================================
PORT=3000                      # API 服务端口
NODE_ENV=production           # 运行环境 (development/production)

# ===========================================
# Redis 配置
# ===========================================
REDIS_HOST=localhost          # Redis 主机地址
REDIS_PORT=6379               # Redis 端口
# REDIS_PASSWORD=your_password  # Redis 密码 (如需要)

# ===========================================
# API 认证
# ===========================================
API_KEY=logotestkey           # API 访问密钥 (生产环境请更换)

# ===========================================
# 缓存配置
# ===========================================
CACHE_TTL_HOURS=24            # 缓存有效期 (小时)

# ===========================================
# 查询配置
# ===========================================
QUERY_DELAY_MS=5000          # 查询间隔 (毫秒)
QUERY_TIMEOUT_MS=120000      # 查询超时 (毫秒)
MAX_RETRIES=3                # 最大重试次数
```

### 重要配置说明

| 变量 | 说明 | 建议值 |
|------|------|--------|
| `API_KEY` | API 访问密钥 | 生产环境使用强密钥 |
| `REDIS_HOST` | Redis 地址 | localhost (本地) 或 Redis 服务器 IP |
| `CACHE_TTL_HOURS` | 缓存过期时间 | 24 小时 |
| `QUERY_DELAY_MS` | 避免被限流 | 5000ms |

---

## 🔧 PM2 部署指南

### 启动服务

#### 方式一: 使用 PM2 配置文件 (推荐)

```bash
cd /path/to/wipo-trademark-batch

# 启动 Redis (如果未运行)
bash scripts/setup-redis.sh start

# 启动 API 和 Worker
pm2 start api/ecosystem.config.js
```

#### 方式二: 单独启动

```bash
# 启动 API
pm2 start api/src/server.js --name wipo-api

# 启动 Worker
pm2 start api/worker/queryWorker.js --name wipo-worker
```

### PM2 常用命令

```bash
# 查看服务状态
pm2 status

# 查看日志
pm2 logs wipo-api        # API 日志
pm2 logs wipo-worker     # Worker 日志
pm2 logs                 # 所有日志

# 重启服务
pm2 restart wipo-api
pm2 restart wipo-worker
pm2 restart all         # 重启所有

# 停止服务
pm2 stop wipo-api
pm2 stop all

# 删除服务
pm2 delete wipo-api
pm2 delete all

# 开机自启
pm2 startup             # 生成启动命令
pm2 save                # 保存当前进程列表
```

### 配置开机自启

```bash
# 生成 systemd 启动脚本
pm2 startup

# 按照输出提示执行命令 (例如在 Ubuntu 上)
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# 保存进程列表
pm2 save
```

### 日志管理

```bash
# 查看实时日志
pm2 logs --lines 100

# 清空日志
pm2 flush

# 日志轮转 (PM2 内置)
# 查看 logs/ 目录下的日志文件
ls -la logs/
```

---

## 🐳 Docker 部署 (可选)

### 使用 Docker Compose

项目包含 `docker-compose.yml`，可一键启动所有服务：

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 手动 Docker 构建

```bash
# 构建镜像
docker build -t wipo-trademark-api:latest ./api

# 运行容器
docker run -d \
  --name wipo-api \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --link wipo-redis \
  wipo-trademark-api:latest
```

---

## 🔄 更新和维护

### 代码更新

```bash
# 拉取最新代码
git pull origin main

# 更新依赖
cd api && npm install

# 重启服务
pm2 restart all
```

### 数据库维护

```bash
# 查看 SQLite 数据库大小
du -h data/trademark.db

# 清理过期数据 (手动 SQL)
sqlite3 data/trademark.db "DELETE FROM tasks WHERE created_at < datetime('now', '-30 days');"
sqlite3 data/trademark.db "VACUUM;"
```

### 监控

```bash
# 查看资源使用
pm2 monit

# 查看详细状态
pm2 info wipo-api
pm2 info wipo-worker
```

---

## 🩹 故障排除

### 常见问题

#### 问题 1: Redis 连接失败

**症状**: `Error: connect ECONNREFUSED`

**解决**:
```bash
# 检查 Redis 是否运行
redis-cli ping

# 如果未运行，启动 Redis
bash scripts/setup-redis.sh start

# 检查 Redis 配置
redis-cli CONFIG GET bind
redis-cli CONFIG GET port
```

#### 问题 2: agent-browser 未找到

**症状**: `Error: agent-browser command not found`

**解决**:
```bash
# 重新安装 agent-browser
sudo npm install -g agent-browser

# 验证安装
agent-browser --version
```

#### 问题 3: API 返回 401 错误

**症状**: `Unauthorized`

**解决**:
```bash
# 检查 API_KEY 配置
cat api/.env | grep API_KEY

# 使用正确的密钥访问
curl -H "X-API-Key: logotestkey" http://localhost:3000/api/v1/tasks
```

#### 问题 4: Worker 内存溢出

**症状**: `FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed`

**解决**:
```bash
# 增加 Node.js 内存限制
pm2 restart wipo-worker --max-memory-restart 1G
```

#### 问题 5: 任务一直处于 pending

**解决**:
```bash
# 检查 Worker 是否运行
pm2 status

# 检查 Worker 日志
pm2 logs wipo-worker --lines 50

# 重启 Worker
pm2 restart wipo-worker
```

### 日志位置

| 服务 | 日志文件 |
|------|----------|
| API | `logs/api-combined.log` |
| Worker | `logs/worker-combined.log` |
| Redis | `logs/redis.log` |

### 健康检查

```bash
# 检查 API 健康状态
curl http://localhost:3000/health

# 检查 Redis 连接
redis-cli ping

# 检查 Worker 状态
curl http://localhost:3000/api/v1/admin/worker-status
```

---

## 💾 备份与恢复

### 手动备份

```bash
# 运行备份脚本
bash scripts/backup.sh
```

### 自动备份 (cron)

```bash
# 每天凌晨 3 点自动备份
0 3 * * * cd /path/to/wipo-trademark-batch && bash scripts/backup.sh >> /var/log/wipo-backup.log 2>&1
```

### 恢复数据

```bash
# 停止服务
pm2 stop all

# 恢复 Redis 数据
redis-cli shutdown
cp data/backup/dump.rdb data/dump.rdb
redis-server redis.conf

# 重启服务
pm2 restart all
```

---

## 📞 支持

- 查看日志: `pm2 logs`
- 项目 Wiki: [docs/](./)
- 问题反馈: [Issues](../../issues)

---

**Made with ❤️ by Musk (OpenClaw)**
