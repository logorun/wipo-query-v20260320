# Gap Analysis: Routes vs Controllers

**Generated:** 2026-03-06T10:36:00Z

## Summary

| Metric | Value |
|--------|-------|
| Total Routes | 14 |
| Matched (OK) | 7 |
| Gaps Found | 10 |

### Gaps by Type

| Type | Count |
|------|-------|
| MISSING_CONTROLLER_FILE | 1 |
| INLINE_CONTROLLER | 9 |
| UNREGISTERED_ROUTE | 1 |

---

## 🔴 High Severity

### MISSING_CONTROLLER_FILE

| Route | Expected Controller | Status |
|-------|---------------------|--------|
| `GET /api/v1/export/:taskId` | exportController.exportTask | File not found |

**Suggestion:** Create `api/src/controllers/exportController.js` with `exportTask` method

---

## 🟡 Medium Severity

### INLINE_CONTROLLER (Webhooks)

All webhook endpoints use inline functions instead of controller references:

| Route | Inline Controller |
|-------|-------------------|
| `POST /api/v1/webhooks` | webhookService.registerWebhook |
| `GET /api/v1/webhooks` | webhookService.listWebhooks |
| `DELETE /api/v1/webhooks/:id` | webhookService.deleteWebhook |
| `POST /api/v1/webhooks/test` | inline (test webhook) |

**Suggestion:** Extract to `api/src/controllers/webhookController.js`

---

## 🟢 Low Severity

### INLINE_CONTROLLER (Admin)

All admin endpoints use inline functions instead of controller references:

| Route | Inline Controller |
|-------|-------------------|
| `GET /api/v1/admin/health` | performHealthCheck |
| `GET /api/v1/admin/metrics` | metrics.getStats |
| `GET /api/v1/admin/alerts` | getAlertHistory |
| `DELETE /api/v1/admin/alerts` | clearAlertHistory |
| `GET /api/v1/admin/status` | performHealthCheck |

**Suggestion:** Extract to `api/src/controllers/adminController.js`

---

## ⚪ Unregistered Routes

| File | Endpoints | Suggestion |
|------|-----------|-------------|
| `api/src/routes/admin.js` | 5 | Add to server.js: `app.use('/api/v1/admin', adminRoutes)` |

---

## ✅ Matched Routes (OK)

| Route | Controller | Status |
|-------|------------|--------|
| `POST /api/v1/tasks` | taskController.create | OK |
| `GET /api/v1/tasks` | taskController.list | OK |
| `GET /api/v1/tasks/:taskId` | taskController.getStatus | OK |
| `DELETE /api/v1/tasks/:taskId` | taskController.cancel | OK |
| `GET /api/v1/cache/:trademark` | cacheController.get | OK |
| `DELETE /api/v1/cache/:trademark` | cacheController.delete | OK |
| `POST /api/v1/cache/clear-expired` | cacheController.clearExpired | OK |

---

## Recommendations

1. **High Priority:** Create missing `exportController.js`
2. **Medium Priority:** Extract webhook inline functions to proper controller
3. **Low Priority:** Register admin routes in server.js
4. **Low Priority:** Consider extracting admin inline functions to controller
