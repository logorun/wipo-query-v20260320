# Task Management (Start/Pause/Delete) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add task management functionality allowing users to start, pause, and delete tasks from the dashboard.

**Architecture:** Extend existing task controller with new endpoints for task lifecycle management. Leverage Bull queue's pause/resume capabilities and add proper task state transitions. Frontend adds action buttons to task list with confirmation dialogs.

**Tech Stack:** Node.js, Express, Bull (Redis queue), SQLite, Vanilla JS frontend

---

## Task 1: Add Backend API - Start Task

**Files:**
- Modify: `api/src/controllers/taskController.js:250-260`
- Modify: `api/src/routes/tasks.js:35-45`
- Modify: `api/src/services/queueService.js:285-310`

**Step 1: Add start method to taskController**

```javascript
// Add after cancel method in taskController
start: asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(taskId)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TASK_ID', message: 'Invalid task ID format' }
    });
  }

  const task = await taskDB.getById(taskId);
  if (!task) {
    return res.status(404).json({
      success: false,
      error: { code: 'TASK_NOT_FOUND', message: `Task with ID '${taskId}' not found` }
    });
  }

  // Only paused tasks can be started
  if (task.status !== 'paused') {
    return res.status(400).json({
      success: false,
      error: { 
        code: 'CANNOT_START', 
        message: `Cannot start task with status '${task.status}'. Only paused tasks can be started.` 
      }
    });
  }

  // Resume the queue job
  await resumeTaskInQueue(taskId);
  
  // Update task status
  await taskDB.updateStatus(taskId, 'pending');

  res.json({
    success: true,
    data: { id: taskId, status: 'pending', message: 'Task started successfully' }
  });
})
```

**Step 2: Add pause method to taskController**

```javascript
pause: asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(taskId)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TASK_ID', message: 'Invalid task ID format' }
    });
  }

  const task = await taskDB.getById(taskId);
  if (!task) {
    return res.status(404).json({
      success: false,
      error: { code: 'TASK_NOT_FOUND', message: `Task with ID '${taskId}' not found` }
    });
  }

  // Can pause pending or processing tasks
  if (task.status !== 'pending' && task.status !== 'processing') {
    return res.status(400).json({
      success: false,
      error: { 
        code: 'CANNOT_PAUSE', 
        message: `Cannot pause task with status '${task.status}'.` 
      }
    });
  }

  // Pause the queue job
  await pauseTaskInQueue(taskId);
  
  // Update task status
  await taskDB.updateStatus(taskId, 'paused');

  res.json({
    success: true,
    data: { id: taskId, status: 'paused', message: 'Task paused successfully' }
  });
})
```

**Step 3: Add delete method to taskController**

```javascript
delete: asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(taskId)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TASK_ID', message: 'Invalid task ID format' }
    });
  }

  const task = await taskDB.getById(taskId);
  if (!task) {
    return res.status(404).json({
      success: false,
      error: { code: 'TASK_NOT_FOUND', message: `Task with ID '${taskId}' not found` }
    });
  }

  // Cannot delete already completed or failed tasks (optional - can be removed)
  if (task.status === 'completed' || task.status === 'failed') {
    return res.status(400).json({
      success: false,
      error: { 
        code: 'CANNOT_DELETE', 
        message: `Cannot delete ${task.status} tasks.` 
      }
    });
  }

  // Remove from queue if in queue
  await removeTaskFromQueue(taskId);
  
  // Delete from database
  await taskDB.delete(taskId);

  res.json({
    success: true,
    data: { id: taskId, message: 'Task deleted successfully' }
  });
})
```

**Step 4: Add helper functions to queueService**

```javascript
// Add to queueService.js

/**
 * Pause a specific task in queue
 */
const pauseTaskInQueue = async (taskId) => {
  try {
    const job = await queryQueue.getJob(taskId);
    if (job) {
      // Move to delayed state by adding a large delay
      await job.moveToDelayed(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
      logger.info(`Task paused in queue`, { taskId });
    }
    return true;
  } catch (error) {
    logger.error(`Failed to pause task in queue`, { taskId, error: error.message });
    throw error;
  }
};

/**
 * Resume a specific task in queue
 */
const resumeTaskInQueue = async (taskId) => {
  try {
    const job = await queryQueue.getJob(taskId);
    if (job) {
      // Move back to waiting state
      await job.moveToWaitingChildren();
      await job.promote();
      logger.info(`Task resumed in queue`, { taskId });
    }
    return true;
  } catch (error) {
    logger.error(`Failed to resume task in queue`, { taskId, error: error.message });
    // If job doesn't exist, recreate it
    const task = await taskDB.getById(taskId);
    if (task) {
      await addTaskToQueue(taskId, task.trademarks, task.priority);
      logger.info(`Task recreated in queue`, { taskId });
    }
    return true;
  }
};

/**
 * Remove task from queue
 */
const removeTaskFromQueue = async (taskId) => {
  try {
    const job = await queryQueue.getJob(taskId);
    if (job) {
      await job.remove();
      logger.info(`Task removed from queue`, { taskId });
    }
    return true;
  } catch (error) {
    logger.error(`Failed to remove task from queue`, { taskId, error: error.message });
    return false;
  }
};
```

**Step 5: Add delete method to taskDB**

```javascript
// Add to taskDB in database.js
delete: async (id) => {
  try {
    const result = await run('DELETE FROM tasks WHERE id = ?', [id]);
    logger.debug('Task deleted', { id, changes: result.changes });
    return { deleted: result.changes > 0 };
  } catch (error) {
    logger.error('Failed to delete task', { id, error: error.message });
    throw error;
  }
}
```

**Step 6: Add routes**

```javascript
// Add to tasks.js after cancel route

// POST /api/v1/tasks/:taskId/start - Start a paused task
router.post('/:taskId/start', validateTaskId, taskController.start);

// POST /api/v1/tasks/:taskId/pause - Pause a pending/processing task
router.post('/:taskId/pause', validateTaskId, taskController.pause);

// DELETE /api/v1/tasks/:taskId - Delete a task (hard delete)
router.delete('/:taskId/delete', validateTaskId, taskController.delete);
```

**Step 7: Export new functions**

```javascript
// Add to queueService exports
module.exports = {
  // ... existing exports
  pauseTaskInQueue,
  resumeTaskInQueue,
  removeTaskFromQueue
};
```

**Step 8: Test backend API**

Run: `curl -X POST "http://95.134.250.48:3000/api/v1/tasks/{taskId}/pause?apiKey=logotestkey"`
Expected: `{ "success": true, "data": { "id": "...", "status": "paused" } }`

---

## Task 2: Update API Client (api.js)

**Files:**
- Modify: `dashboard/js/api.js:70-120`

**Step 1: Add task management methods**

```javascript
// Add to WipoAPI class

async startTask(taskId) {
  return this.request(`/tasks/${taskId}/start`, { method: 'POST' });
}

async pauseTask(taskId) {
  return this.request(`/tasks/${taskId}/pause`, { method: 'POST' });
}

async deleteTask(taskId) {
  return this.request(`/tasks/${taskId}/delete`, { method: 'DELETE' });
}
```

**Step 2: Verify API methods work**

Run: `curl -X POST "http://95.134.250.48:3000/api/v1/tasks/TEST-ID/pause?apiKey=logotestkey"`
Expected: Error response with proper error code

---

## Task 3: Add Frontend UI - Task Action Buttons

**Files:**
- Modify: `dashboard/js/app.js:60-110`
- Create: `dashboard/css/task-actions.css`

**Step 1: Update task list rendering with action buttons**

```javascript
// Modify updateTaskList function in app.js
// Replace the row.innerHTML section (lines 87-101)

row.innerHTML = `
  <td class="py-3 font-mono text-sm">${task.id.slice(0, 8)}...</td>
  <td class="py-3">${task.trademarks?.length || 0}个</td>
  <td class="py-3">
    <div class="flex items-center gap-2">
      <div class="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all" style="width: ${percent}%"></div>
      </div>
      <span class="text-xs text-slate-400">${percent}%</span>
    </div>
  </td>
  <td class="py-3"><span class="status-badge ${statusClass}">${statusText}</span></td>
  <td class="py-3 text-sm">${new Date(task.createdAt).toLocaleString('zh-CN')}</td>
  <td class="py-3">
    <div class="flex items-center gap-2 task-actions">
      <button onclick="event.stopPropagation(); viewTask('${task.id}')" class="text-cyan-400 hover:text-cyan-300 text-sm" title="查看">👁</button>
      ${task.status === 'paused' 
        ? `<button onclick="event.stopPropagation(); startTask('${task.id}')" class="text-green-400 hover:text-green-300 text-sm" title="开始">▶</button>` 
        : (task.status === 'pending' || task.status === 'processing')
          ? `<button onclick="event.stopPropagation(); pauseTask('${task.id}')" class="text-yellow-400 hover:text-yellow-300 text-sm" title="暂停">⏸</button>`
          : ''
      }
      <button onclick="event.stopPropagation(); deleteTask('${task.id}')" class="text-red-400 hover:text-red-300 text-sm" title="删除">🗑</button>
    </div>
  </td>
`;
```

**Step 2: Add action handler functions to app.js**

```javascript
// Add to app.js after submitTask function

async function startTask(taskId) {
  if (!confirm('确定要开始这个任务吗？')) return;
  
  try {
    await api.startTask(taskId);
    alert('任务已开始');
    await refreshData();
  } catch (error) {
    alert('开始任务失败: ' + error.message);
  }
}

async function pauseTask(taskId) {
  if (!confirm('确定要暂停这个任务吗？')) return;
  
  try {
    await api.pauseTask(taskId);
    alert('任务已暂停');
    await refreshData();
  } catch (error) {
    alert('暂停任务失败: ' + error.message);
  }
}

async function deleteTask(taskId) {
  if (!confirm('确定要删除这个任务吗？此操作不可撤销。')) return;
  
  try {
    await api.deleteTask(taskId);
    alert('任务已删除');
    await refreshData();
  } catch (error) {
    alert('删除任务失败: ' + error.message);
  }
}
```

**Step 3: Add CSS for action buttons**

```css
/* Create dashboard/css/task-actions.css */
.task-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

tr:hover .task-actions {
  opacity: 1;
}

.task-actions button {
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.task-actions button:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.1);
}
```

**Step 4: Link CSS in index.html**

```html
<!-- Add to index.html head section -->
<link rel="stylesheet" href="css/task-actions.css">
```

---

## Task 4: Test Complete Workflow

**Step 1: Create test task**

Run: `curl -X POST "http://95.134.250.48:3000/api/v1/tasks?apiKey=logotestkey" \
  -H "Content-Type: application/json" \
  -d '{"trademarks": ["TEST1", "TEST2"]}'`

**Step 2: Pause the task**
Click pause button on the task
Expected: Task status changes to "paused", button changes to play icon

**Step 3: Start the task**
Click start button on the paused task
Expected: Task status changes to "pending", button changes to pause icon

**Step 4: Delete the task**
Click delete button and confirm
Expected: Task disappears from list

---

## Task 5: Update Task Drawer to Show Paused Status

**Files:**
- Modify: `dashboard/js/drawer.js:147-160`

**Step 1: Add paused status config**

```javascript
// Add to statusConfig in updateUI method
const statusConfig = {
  pending: { text: '待处理', class: 'bg-yellow-500/20 text-yellow-400' },
  processing: { text: '处理中', class: 'bg-blue-500/20 text-blue-400' },
  completed: { text: '已完成', class: 'bg-green-500/20 text-green-400' },
  failed: { text: '失败', class: 'bg-red-500/20 text-red-400' },
  paused: { text: '已暂停', class: 'bg-orange-500/20 text-orange-400' },
  cancelled: { text: '已取消', class: 'bg-slate-500/20 text-slate-400' }
};
```

---

## Task 6: Commit Changes

```bash
# From project root
git add api/src/controllers/taskController.js \
       api/src/routes/tasks.js \
       api/src/services/queueService.js \
       api/src/models/database.js \
       dashboard/js/api.js \
       dashboard/js/app.js \
       dashboard/js/drawer.js \
       dashboard/css/task-actions.css \
       dashboard/index.html

git commit -m "feat: add task management (start/pause/delete) functionality

- Add backend API endpoints for start, pause, and delete operations
- Implement queue management functions for pausing/resuming tasks
- Add frontend action buttons with icons and confirmation dialogs
- Update task drawer to show paused status
- Add CSS styling for action buttons

Closes #task-management"
```

---

## Verification Checklist

- [ ] Backend API returns proper error codes for invalid operations
- [ ] Pause button appears only for pending/processing tasks
- [ ] Start button appears only for paused tasks
- [ ] Delete button works for all non-completed tasks
- [ ] Confirmation dialogs prevent accidental actions
- [ ] UI updates immediately after action
- [ ] Task drawer shows correct status after refresh
- [ ] Queue state is synchronized with database state

---

## Notes

1. **State Machine:**
   - pending → pause → paused
   - processing → pause → paused
   - paused → start → pending
   - any (except completed/failed) → delete → removed

2. **Queue Behavior:**
   - Pause: Moves job to delayed state with long delay
   - Start: Moves job back to waiting/pending state
   - Delete: Removes job from queue entirely

3. **Error Handling:**
   - All operations validate task exists first
   - State transitions are validated before execution
   - Queue errors are logged but don't fail the operation

4. **Future Enhancements:**
   - Add retry functionality for failed tasks
   - Add bulk operations (pause all, delete selected)
   - Add task priority editing
