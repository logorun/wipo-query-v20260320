# WIPO Trademark Batch Query API

REST API for querying WIPO Brand Database trademarks with async processing.

## Quick Start

### 1. Install Dependencies
```bash
cd api
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env and set API_KEY (default: your-secret-api-key-here)
```

### 3. Start Redis
```bash
redis-server --daemonize yes
```

### 4. Start Services (Production Mode)
```bash
# Install PM2 (if not installed)
npm install -g pm2

# Start API Server and Worker with PM2
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs

# Restart services
pm2 restart all
```

⚠️ **Note**: PM2 keeps processes running after shell exit. For development, use `npm start` and `npm run worker` instead.

## Authentication

All API endpoints (except `/health`) require authentication via API Key.

**Methods:**
- Header: `X-API-Key: your-api-key`
- Query: `?apiKey=your-api-key`

**Default Key:** `logotestkey`

## API Endpoints

### Submit Query Task
```bash
POST /api/v1/tasks
Content-Type: application/json

{
  "trademarks": ["WIIM", "9TRANSPORT"],
  "priority": 5
}
```

Response:
```json
{
  "success": true,
  "data": {
    "taskId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "trademarks": ["WIIM", "9TRANSPORT"],
    "createdAt": "2026-03-04T14:00:00Z",
    "estimatedTime": "60s"
  }
}
```

### Check Task Status
```bash
GET /api/v1/tasks/:taskId
```

Response (completed):
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "trademarks": ["WIIM", "9TRANSPORT"],
    "createdAt": "2026-03-04T14:00:00Z",
    "completedAt": "2026-03-04T14:02:00Z",
    "progress": {
      "total": 2,
      "processed": 2,
      "failed": 0
    },
    "results": [...]
  }
}
```

### Query Cache
```bash
GET /api/v1/cache/:trademark
```

Response (cache hit):
```json
{
  "success": true,
  "data": {
    "trademark": "WIIM",
    "cached": true,
    "cacheInfo": {
      "createdAt": "2026-03-04T12:00:00Z",
      "expiresAt": "2026-03-05T12:00:00Z",
      "age": "1h30m",
      "hitCount": 5
    },
    "data": {...}
  }
}
```

### Force Refresh Cache
```bash
GET /api/v1/cache/:trademark?forceRefresh=true
```

### List Tasks
```bash
GET /api/v1/tasks?status=all&limit=20
```

Query params:
- `status`: all | pending | processing | completed | failed
- `limit`: number (max 100)
- `offset`: number

### Cancel Task
```bash
DELETE /api/v1/tasks/:taskId
```

## Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-04T15:00:00Z",
  "version": "v1",
  "uptime": 3600000
}
```

## Metrics

Access metrics at `/metrics` endpoint:

```bash
curl http://localhost:3000/metrics
```

Returns:
```json
{
  "uptime": 3600000,
  "counters": {
    "http_requests_total{route=GET /api/v1/tasks,status=200}": 10
  },
  "gauges": {
    "http_requests_active": 1
  },
  "timers": {
    "http_request_duration_ms{route=GET /api/v1/tasks}": {
      "count": 10,
      "avg": 45.2,
      "p95": 120
    }
  }
}
```

## Configuration

All settings can be customized via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment (development/production) |
| `API_KEY` | logotestkey | API authentication key |
| `REDIS_HOST` | localhost | Redis host |
| `REDIS_PORT` | 6379 | Redis port |
| `CACHE_TTL_HOURS` | 24 | Cache expiration time |
| `LOG_LEVEL` | debug/info | Log level (debug/info/warn/error) |
| `CORS_ORIGINS` | * | Allowed CORS origins (comma-separated) |

## Database Migrations

```bash
# Check migration status
node -e "require('./src/utils/migration').new(require('./src/models/database').db).status()"

# Run pending migrations
node -e "require('./src/models/database').initDB()"
```

## Testing

```bash
# Set API Key
API_KEY="logotestkey"

# Submit a task
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"trademarks": ["WIIM"]}'

# Check status (replace with actual taskId)
curl -H "X-API-Key: $API_KEY" http://localhost:3000/api/v1/tasks/YOUR_TASK_ID

# Query cache
curl -H "X-API-Key: $API_KEY" http://localhost:3000/api/v1/cache/WIIM

# Force refresh
curl -H "X-API-Key: $API_KEY" "http://localhost:3000/api/v1/cache/WIIM?forceRefresh=true"
```

## Project Structure

```
api/
├── src/
│   ├── server.js              # Express server
│   ├── config/
│   │   └── index.js           # Centralized configuration
│   ├── controllers/
│   │   ├── taskController.js  # Task endpoints
│   │   └── cacheController.js # Cache endpoints
│   ├── services/
│   │   ├── queueService.js    # Bull queue
│   │   ├── cacheService.js    # Cache logic
│   │   └── database.js        # SQLite
│   ├── routes/
│   │   ├── tasks.js
│   │   └── cache.js
│   ├── middleware/
│   │   ├── auth.js            # API Key authentication
│   │   └── errorHandler.js    # Error handling
│   └── utils/
│       ├── logger.js          # Structured logging
│       ├── metrics.js         # Metrics & monitoring
│       └── migration.js       # Database migrations
├── migrations/
│   └── 001_initial.sql        # Database schema
├── worker/
│   └── queryWorker.js         # Queue consumer
└── package.json
```

## Notes

- Each trademark query takes ~30 seconds
- Cache TTL: 24 hours
- Worker processes one trademark at a time
- Redis required for queue
