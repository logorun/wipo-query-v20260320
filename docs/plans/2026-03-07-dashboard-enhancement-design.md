# WIPO Dashboard Enhancement Design

> Date: 2026-03-07
> Status: Approved

## Overview

Enhance the WIPO trademark batch query system with 4 features:
1. Country information display in task results
2. Batch export functionality (incomplete tasks + cross-task merge)
3. Dashboard overview with trademark-level statistics
4. Multi-task splitting for large Excel uploads

---

## Feature 1: Country Information Display

### Goal
Show EU/non-EU country breakdown in drawer result logs.

### Changes
**File: `dashboard/js/drawer.js`**

Modify `renderResultLogs()` function to add:

```javascript
// After existing stats (queryTime, queryStatus, fromCache, recordCount)

if (result.records && result.records.length > 0) {
  const euRecords = result.records.filter(r => r.isEU);
  const nonEuRecords = result.records.filter(r => !r.isEU);
  
  if (euRecords.length > 0) {
    const euCountries = [...new Set(euRecords.map(r => r.countryCode).filter(Boolean))];
    parts.push(`<p class="text-slate-300 text-sm"><span class="text-slate-500">欧盟记录:</span> <span class="text-green-400">${euRecords.length}</span> <span class="text-slate-400">(${euCountries.join(', ')})</span></p>`);
  }
  
  if (nonEuRecords.length > 0) {
    const nonEuCountries = [...new Set(nonEuRecords.map(r => r.countryCode).filter(Boolean))];
    parts.push(`<p class="text-slate-300 text-sm"><span class="text-slate-500">非欧盟:</span> <span class="text-yellow-400">${nonEuRecords.length}</span> <span class="text-slate-400">(${nonEuCountries.join(', ')})</span></p>`);
  }
}
```

### Display Format
```
欧盟记录: 3 (ES, DE, FR)
非欧盟: 1 (CH)
```

---

## Feature 2: Batch Export Functionality

### Goal
1. Allow exporting incomplete tasks (not just completed)
2. Support cross-task batch export (merge multiple tasks into one Excel)

### Changes

#### 2.1 Allow Incomplete Task Export
**File: `api/src/controllers/exportController.js`**

Change:
```javascript
// Before
if (task.status !== 'completed' || !task.results) {
  return res.status(400).json({ error: 'Task not completed yet' });
}

// After
if (!task.results || task.results.length === 0) {
  return res.status(400).json({ error: 'No results available for export' });
}
// Removed status restriction - allow processing/completed/paused/failed
```

#### 2.2 Add Batch Export Endpoint
**File: `api/src/controllers/exportController.js`**

Add new function:
```javascript
const exportBatch = async (req, res) => {
  const { taskIds, filter } = req.body;
  
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({ error: 'taskIds must be a non-empty array' });
  }
  
  const allDetails = [];
  const allSummary = [];
  
  for (const taskId of taskIds) {
    const task = await taskDB.getById(taskId);
    if (task && task.results) {
      // Reuse existing Excel export logic for each task
      for (const result of task.results) {
        for (const record of result.records || []) {
          if (filter === 'eu' && !record.isEU) continue;
          if (filter === 'non-eu' && record.isEU) continue;
          
          allDetails.push({
            '查询商标': result.trademark,
            '品牌名称': record.brandName || '',
            '持有人': record.owner || '',
            '状态': record.status || '',
            '国家/地区': record.country || '',
            '国家代码': record.countryCode || '',
            '注册号': record.regNumber || '',
            '注册日期': record.regDate || '',
            '尼斯分类': (record.niceClasses || []).join(', '),
            '是否欧盟': record.isEU ? '是' : '否',
            '是否国际注册': record.isInternational ? '是' : '否',
            '任务ID': taskId
          });
        }
      }
    }
  }
  
  // Generate merged Excel
  const wb = xlsx.utils.book_new();
  const wsDetails = xlsx.utils.json_to_sheet(allDetails);
  xlsx.utils.book_append_sheet(wb, wsDetails, '合并结果');
  
  // Send file
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="batch-export-${Date.now()}.xlsx"`);
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.send(buffer);
};
```

**File: `api/src/routes/export.js`**

Add route:
```javascript
router.post('/batch', exportController.exportBatch);
```

#### 2.3 Frontend UI
**File: `dashboard/index.html`**

Add batch operation bar above task table:
```html
<div class="flex items-center gap-4 mb-4" id="batch-ops" style="display: none;">
  <span class="text-slate-400 text-sm">已选择 <span id="selected-count">0</span> 个任务</span>
  <button onclick="batchExport()" class="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition">批量导出</button>
  <button onclick="clearSelection()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition">取消选择</button>
</div>
```

Add checkbox to each task row:
```html
<td class="py-3">
  <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" onchange="updateSelection()">
</td>
```

**File: `dashboard/js/app.js`**

Add selection logic:
```javascript
let selectedTasks = new Set();

function updateSelection() {
  selectedTasks.clear();
  document.querySelectorAll('.task-checkbox:checked').forEach(cb => {
    selectedTasks.add(cb.dataset.taskId);
  });
  document.getElementById('selected-count').textContent = selectedTasks.size;
  document.getElementById('batch-ops').style.display = selectedTasks.size > 0 ? 'flex' : 'none';
}

function clearSelection() {
  document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false);
  selectedTasks.clear();
  updateSelection();
}

async function batchExport() {
  if (selectedTasks.size === 0) return;
  
  const taskIds = Array.from(selectedTasks);
  const result = await api.batchExport(taskIds);
  // Download file
}
```

**File: `dashboard/js/api.js`**

Add API function:
```javascript
async batchExport(taskIds, filter) {
  const response = await fetch(`${API_BASE}/export/batch?apiKey=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskIds, filter })
  });
  return response.blob();
}
```

---

## Feature 3: Dashboard Overview Enhancement

### Goal
Add trademark-level statistics to dashboard overview.

### Layout
Two rows:
- Row 1: Task statistics (existing)
- Row 2: Trademark statistics (new)

### Changes

#### 3.1 API Enhancement
**File: `api/src/controllers/taskController.js`**

Modify `list` function to calculate real trademark stats:
```javascript
list: asyncHandler(async (req, res) => {
  // ... existing validation ...
  
  const [tasks, stats] = await Promise.all([
    taskDB.list(options),
    taskDB.getStats()
  ]);
  
  // Calculate real trademark statistics
  const allTasks = await taskDB.list({ limit: 10000 });
  const trademarkStats = {
    total: 0,
    processed: 0,
    pending: 0,
    euRecords: 0,
    nonEuRecords: 0
  };
  
  for (const task of allTasks) {
    trademarkStats.total += task.trademarks?.length || 0;
    
    if (task.status === 'completed' || task.status === 'processing') {
      trademarkStats.processed += task.progress_processed || 0;
      trademarkStats.pending += (task.trademarks?.length || 0) - (task.progress_processed || 0);
      
      if (task.results) {
        for (const result of task.results) {
          trademarkStats.euRecords += result.euRecords || 0;
          trademarkStats.nonEuRecords += result.nonEURecords || 0;
        }
      }
    } else if (task.status === 'pending') {
      trademarkStats.pending += task.trademarks?.length || 0;
    }
  }
  
  res.json({
    success: true,
    data: {
      total: stats.total,
      pending: stats.pending,
      processing: stats.processing,
      completed: stats.completed,
      failed: stats.failed,
      trademarkStats,  // Real data
      tasks: [...]
    }
  });
});
```

#### 3.2 Frontend Layout
**File: `dashboard/index.html`**

Add second row after existing stats:
```html
<!-- Row 2: Trademark Statistics -->
<div class="grid grid-cols-1 md:grid-cols-5 gap-4">
  <div class="glass rounded-xl p-6">
    <h3 class="text-slate-400 text-sm">总商标数</h3>
    <p id="stat-tm-total" class="text-3xl font-bold text-white mt-2">-</p>
  </div>
  <div class="glass rounded-xl p-6">
    <h3 class="text-slate-400 text-sm">已处理</h3>
    <p id="stat-tm-processed" class="text-3xl font-bold text-green-400 mt-2">-</p>
  </div>
  <div class="glass rounded-xl p-6">
    <h3 class="text-slate-400 text-sm">待处理</h3>
    <p id="stat-tm-pending" class="text-3xl font-bold text-yellow-400 mt-2">-</p>
  </div>
  <div class="glass rounded-xl p-6">
    <h3 class="text-slate-400 text-sm">欧盟记录</h3>
    <p id="stat-tm-eu" class="text-3xl font-bold text-blue-400 mt-2">-</p>
  </div>
  <div class="glass rounded-xl p-6">
    <h3 class="text-slate-400 text-sm">非欧盟记录</h3>
    <p id="stat-tm-noneu" class="text-3xl font-bold text-purple-400 mt-2">-</p>
  </div>
</div>
```

#### 3.3 Frontend Logic
**File: `dashboard/js/app.js`**

Update `updateStats` function:
```javascript
function updateStats(data) {
  // Existing: task stats
  document.getElementById('stat-total').textContent = data.total;
  document.getElementById('stat-completed').textContent = data.completed || 0;
  document.getElementById('stat-processing').textContent = data.processing || 0;
  document.getElementById('stat-failed').textContent = data.failed || 0;
  
  // New: trademark stats
  const tmStats = data.trademarkStats || {};
  document.getElementById('stat-tm-total').textContent = tmStats.total || 0;
  document.getElementById('stat-tm-processed').textContent = tmStats.processed || 0;
  document.getElementById('stat-tm-pending').textContent = tmStats.pending || 0;
  document.getElementById('stat-tm-eu').textContent = tmStats.euRecords || 0;
  document.getElementById('stat-tm-noneu').textContent = tmStats.nonEuRecords || 0;
}
```

---

## Feature 4: Multi-Task Splitting for Excel Upload

### Goal
Automatically split large Excel uploads (250+ trademarks) into multiple tasks for future multi-threading.

### Config
- Batch size: 250 trademarks per task
- Trigger: Excel upload with AI extraction

### Changes

#### 4.1 Backend Logic
**File: `api/src/controllers/extractController.js`**

Modify `extractFromData` to auto-split:
```javascript
extractFromData: asyncHandler(async (req, res) => {
  const { data, fileName } = req.body;
  
  // ... existing validation ...
  
  const trademarks = await aiService.extractTrademarks(data);
  
  if (trademarks.length === 0) {
    return res.status(400).json({ error: 'No trademarks found' });
  }
  
  // Auto-split if > 250
  const BATCH_SIZE = 250;
  
  if (trademarks.length <= BATCH_SIZE) {
    // Single task - use existing endpoint
    res.json({
      success: true,
      data: {
        fileName,
        totalRows: data.length,
        extractedCount: trademarks.length,
        trademarks,
        needsSplit: false
      }
    });
  } else {
    // Multiple tasks
    const batches = [];
    for (let i = 0; i < trademarks.length; i += BATCH_SIZE) {
      batches.push(trademarks.slice(i, i + BATCH_SIZE));
    }
    
    // Create tasks immediately
    const createdTasks = [];
    for (let i = 0; i < batches.length; i++) {
      const taskId = uuidv4();
      const batchTrademarks = batches[i];
      
      const task = {
        id: taskId,
        trademarks: batchTrademarks.map(t => t.trim().toUpperCase()),
        status: 'pending',
        priority: 5,
        batchIndex: i + 1,
        totalBatches: batches.length,
        sourceFile: fileName
      };
      
      await taskDB.create(task);
      await addTaskToQueue(taskId, task.trademarks, task.priority);
      
      createdTasks.push({
        taskId,
        batchNumber: i + 1,
        trademarkCount: batchTrademarks.length
      });
    }
    
    res.json({
      success: true,
      data: {
        fileName,
        totalRows: data.length,
        extractedCount: trademarks.length,
        batchCount: batches.length,
        tasks: createdTasks,
        needsSplit: true
      }
    });
  }
});
```

#### 4.2 Frontend UI
**File: `dashboard/js/app.js`**

Modify `handleFileSelect`:
```javascript
async function handleFileSelect(event) {
  // ... existing parsing code ...
  
  const result = await api.extractFromData(jsonData, file.name);
  
  if (result.success && result.data.trademarks.length > 0) {
    if (result.data.needsSplit) {
      // Already created tasks on backend
      alert(`成功提取 ${result.data.extractedCount} 个商标，已拆分为 ${result.data.batchCount} 个任务`);
      await refreshData();
    } else {
      // Show selection modal as before
      extractedTrademarks = result.data.trademarks;
      selectedTrademarks = new Set(extractedTrademarks);
      showTrademarkConfirmationModal(result.data);
    }
  }
}
```

---

## Implementation Order

1. **Feature 1** (Country display) - Simplest, single file
2. **Feature 3** (Dashboard stats) - API + Frontend
3. **Feature 2** (Batch export) - API + Frontend
4. **Feature 4** (Task splitting) - Logic change

---

## Files Changed Summary

| File | Feature |
|------|---------|
| `dashboard/js/drawer.js` | 1 |
| `api/src/controllers/taskController.js` | 3 |
| `dashboard/index.html` | 2, 3 |
| `dashboard/js/app.js` | 2, 3, 4 |
| `dashboard/js/api.js` | 2 |
| `api/src/controllers/exportController.js` | 2 |
| `api/src/routes/export.js` | 2 |
| `api/src/controllers/extractController.js` | 4 |

---

## Testing Checklist

- [ ] Feature 1: View task drawer, check country display
- [ ] Feature 2a: Export incomplete task (processing status)
- [ ] Feature 2b: Select multiple tasks, batch export
- [ ] Feature 3: Dashboard shows correct trademark counts
- [ ] Feature 4: Upload 300+ trademarks Excel, verify task split
