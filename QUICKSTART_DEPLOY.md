# 快速部署指南

> 适用于新设备快速部署 WIPO 商标查询系统

## 1. 克隆仓库

```bash
git clone git@github.com:logorun/wipo-query-v20260320.git
cd wipo-query-v20260320
```

## 2. 安装系统依赖

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y redis-server build-essential python3

# 启动 Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

## 3. 安装 Node.js 依赖

```bash
# 确保 Node.js >= 18
node --version

# 安装全局依赖
sudo npm install -g pm2 agent-browser

# 安装项目依赖
npm install
cd api && npm install && cd ..
```

## 4. 配置环境变量

```bash
cp api/.env.example api/.env
vim api/.env
```

关键配置：
```bash
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
API_KEY=your-secure-key-here    # 生产环境请修改
CACHE_TTL_HOURS=24
```

## 5. 启动服务

```bash
# 使用 PM2 启动
pm2 start api/ecosystem.config.js

# 保存并设置开机自启
pm2 save
pm2 startup
```

## 6. 验证部署

```bash
# 检查服务状态
pm2 status

# 检查 API 健康
curl http://localhost:3000/health

# 测试 API
curl -H "X-API-Key: your-secure-key-here" \
  http://localhost:3000/api/v1/tasks
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pm2 status` | 查看服务状态 |
| `pm2 logs` | 查看日志 |
| `pm2 restart all` | 重启所有服务 |
| `pm2 stop all` | 停止所有服务 |

## API 使用示例

```bash
# 提交查询任务
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-secure-key-here" \
  -d '{"trademarks": ["BRAND1", "BRAND2"]}'

# 查询任务状态
curl -H "X-API-Key: your-secure-key-here" \
  http://localhost:3000/api/v1/tasks/TASK_ID
```

## 故障排除

**Redis 连接失败：**
```bash
sudo systemctl start redis-server
redis-cli ping  # 应返回 PONG
```

**agent-browser 未找到：**
```bash
sudo npm install -g agent-browser
agent-browser --version
```

**API 返回 401：**
- 检查 `api/.env` 中的 `API_KEY` 配置
- 请求时添加正确的 `X-API-Key` header

## 更多文档

- [完整部署文档](docs/DEPLOYMENT.md)
- [API 文档](api/README.md)
- [使用说明](README.md)
