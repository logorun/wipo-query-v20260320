# Controllers Analysis Report

**Generated:** 2026-03-06T10:30:00.000Z  
**Total Files (planned):** 3  
**Files Found:** 2  
**Total Methods:** 7

---

## Summary

| File | Methods Count | Status |
|------|---------------|--------|
| `taskController.js` | 4 | ✅ Found |
| `cacheController.js` | 3 | ✅ Found |
| `webhookController.js` | - | ❌ Not Found |

---

## taskController.js

**Path:** `api/src/controllers/taskController.js`

| Method | Type | Parameters | Description |
|--------|------|------------|-------------|
| `create` | async function | req, res | 创建任务 - 验证商标名称列表，创建任务记录并添加到队列 |
| `getStatus` | async function | req, res | 获取任务状态 - 根据 taskId 查询任务状态、进度和结果 |
| `list` | async function | req, res | 获取任务列表 - 分页查询任务列表及统计信息 |
| `cancel` | async function | req, res | 取消任务 - 取消处于 pending 状态的任务 |

---

## cacheController.js

**Path:** `api/src/controllers/cacheController.js`

| Method | Type | Parameters | Description |
|--------|------|------------|-------------|
| `get` | async function | req, res | 获取缓存 - 查询商标名称的缓存数据，支持强制刷新 |
| `delete` | async function | req, res | 删除缓存 - 删除指定商标名称的缓存 |
| `clearExpired` | async function | req, res | 清空过期缓存 - 清理所有过期的缓存条目 |

---

## webhookController.js

**Path:** `api/src/controllers/webhookController.js`

**Status:** ❌ File not found

This file does not exist in the expected location.

---

## Notes

- All methods use `asyncHandler` middleware for error handling
- All methods are async functions
- Parameters follow Express.js convention (req, res)
- No sync functions were found in the existing controllers
