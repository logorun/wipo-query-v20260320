# WIPO API Routes Analysis

**Generated:** 2026-03-06T10:31:00Z  
**Total Files:** 5  
**Total Endpoints:** 14

---

## Summary

| File | Registered | Endpoints |
|------|-------------|-----------|
| `tasks.js` | ✅ Yes | 4 |
| `cache.js` | ✅ Yes | 3 |
| `webhooks.js` | ✅ Yes | 4 |
| `export.js` | ✅ Yes | 1 |
| `admin.js` | ❌ No | 5 |

---

## Registered Routes

### 1. Tasks (`/api/v1/tasks`)

| Method | Path | Controller | Middlewares |
|--------|------|------------|-------------|
| POST | `/api/v1/tasks` | `taskController.create` | `taskSubmitLimiter`, `requestSizeLimit('1mb')`, `validateTaskRequest` |
| GET | `/api/v1/tasks` | `taskController.list` | `validateListQuery` |
| GET | `/api/v1/tasks/:taskId` | `taskController.getStatus` | `validateTaskId` |
| DELETE | `/api/v1/tasks/:taskId` | `taskController.cancel` | `validateTaskId` |

### 2. Cache (`/api/v1/cache`)

| Method | Path | Controller | Middlewares |
|--------|------|------------|-------------|
| GET | `/api/v1/cache/:trademark` | `cacheController.get` | `validateCacheQuery` |
| DELETE | `/api/v1/cache/:trademark` | `cacheController.delete` | `validateCacheQuery` |
| POST | `/api/v1/cache/clear-expired` | `cacheController.clearExpired` | - |

### 3. Webhooks (`/api/v1`)

| Method | Path | Controller | Middlewares |
|--------|------|------------|-------------|
| POST | `/api/v1/webhooks` | `webhookService.registerWebhook` | Body validation |
| GET | `/api/v1/webhooks` | `webhookService.listWebhooks` | - |
| DELETE | `/api/v1/webhooks/:id` | `webhookService.deleteWebhook` | Param validation (UUID) |
| POST | `/api/v1/webhooks/test` | Test webhook | Body validation |

### 4. Export (`/api/v1/export`)

| Method | Path | Controller | Middlewares |
|--------|------|------------|-------------|
| GET | `/api/v1/export/:taskId` | `exportController.exportTask` | - |

---

## Unregistered Routes

### Admin (`/api/v1/admin`) - **NOT REGISTERED**

| Method | Path | Controller |
|--------|------|-------------|
| GET | `/api/v1/admin/health` | Inline handler |
| GET | `/api/v1/admin/metrics` | Inline handler |
| GET | `/api/v1/admin/alerts` | Inline handler |
| DELETE | `/api/v1/admin/alerts` | Inline handler |
| GET | `/api/v1/admin/status` | Inline handler |

> ⚠️ **Note:** `admin.js` exists but is NOT registered in `server.js`

---

## Notes

- **Missing file:** `api/src/routes/index.js` - Does not exist. Routes are registered directly in `server.js`
- **API Version:** `v1`
- **Registration pattern:** Each route file is mounted at `/api/v1/{resource}`

---

## Verification

```bash
test -f api/.openclaw/findings/routes-analysis.json && echo 'SUCCESS' || echo 'FAILED'
```
