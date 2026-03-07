# WIPO Dashboard Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance WIPO dashboard with country display, batch export, trademark stats, and auto task-splitting.

**Architecture:** Frontend modifications to dashboard JS/HTML files, backend API enhancements to controllers. Minimal changes, no new services.

**Tech Stack:** Node.js, Express, SQLite, xlsx library, vanilla JS frontend

---

## Task 1: Country Information Display (Feature 1)

**Files:**
- Modify: `dashboard/js/drawer.js` (function `renderResultLogs`)

**Step 1: Locate the renderResultLogs function**

Read `dashboard/js/drawer.js` and find `renderResultLogs(result)` function (around line 298).

**Step 2: Add country statistics after record count**

Insert after the "记录数量" section (around line 314), before the error handling:

```javascript
// Add after: if (result.records && Array.isArray(result.records)) { ... }

// === Country Statistics ===
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

**Step 3: Verify the change**

Run: Check PM2 logs and open dashboard to view a task with results
Expected: Country statistics should appear in drawer result details

**Step 4: Commit**

```bash
git add dashboard/js/drawer.js
git commit -m "feat(dashboard): add country statistics to task result display"
```

---

## Task 2: Dashboard Trademark Statistics API (Feature 3a)

**Files:**
- Modify: `api/src/controllers/taskController.js` (function `list`)

**Step 1: Read current list function**

Read `api/src/controllers/taskController.js` and find the `list` function (around line 202).

**Step 2: Add trademark statistics calculation**

After the existing `const [tasks, stats] = await Promise.all([...])` block, add:

```javascript
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
```

**Step 3: Add trademarkStats to response**

Modify the `res.json()` call to include `trademarkStats`:

```javascript
res.json({
  success: true,
  data: {
    total: stats.total,
    pending: stats.pending,
    processing: stats.processing,
    completed: stats.completed,
    failed: stats.failed,
    trademarkStats,  // Add this line
    tasks: tasks.map(t => ({
      // ... existing mapping
    })),
    pagination: {
      // ... existing pagination
    }
  }
});
```

**Step 4: Restart API and verify**

Run:
```bash
pm2 restart wipo-api
curl -s "http://localhost:3000/api/v1/tasks?apiKey=logotestkey" | jq '.data.trademarkStats'
```
Expected: JSON with total, processed, pending, euRecords, nonEuRecords

**Step 5: Commit**

```bash
git add api/src/controllers/taskController.js
git commit -m "feat(api): add trademark-level statistics to task list endpoint"
```

---

## Task 3: Dashboard Trademark Statistics UI (Feature 3b)

**Files:**
- Modify: `dashboard/index.html`
- Modify: `dashboard/js/app.js`

**Step 1: Add trademark statistics row in HTML**

Read `dashboard/index.html`, find the first stats grid (around line 25-42). After it, add:

```html
<!-- Trademark Statistics -->
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

**Step 2: Update updateStats function in app.js**

Read `dashboard/js/app.js`, find `updateStats(data)` function (around line 46). Modify to add:

```javascript
function updateStats(data) {
    // Existing task stats
    if (data && data.total !== undefined) {
        document.getElementById('stat-total').textContent = data.total;
        document.getElementById('stat-completed').textContent = data.completed || 0;
        document.getElementById('stat-processing').textContent = data.processing || 0;
        document.getElementById('stat-failed').textContent = data.failed || 0;
    } else {
        // ... existing fallback
    }
    
    // NEW: Trademark stats
    const tmStats = data.trademarkStats || {};
    document.getElementById('stat-tm-total').textContent = tmStats.total || 0;
    document.getElementById('stat-tm-processed').textContent = tmStats.processed || 0;
    document.getElementById('stat-tm-pending').textContent = tmStats.pending || 0;
    document.getElementById('stat-tm-eu').textContent = tmStats.euRecords || 0;
    document.getElementById('stat-tm-noneu').textContent = tmStats.nonEuRecords || 0;
}
```

**Step 3: Verify in browser**

Open dashboard, check second row shows trademark statistics.
Expected: Real numbers, not dashes (if there are existing tasks)

**Step 4: Commit**

```bash
git add dashboard/index.html dashboard/js/app.js
git commit -m "feat(dashboard): add trademark-level statistics display"
```

---

## Task 4: Allow Incomplete Task Export (Feature 2a)

**Files:**
- Modify: `api/src/controllers/exportController.js`

**Step 1: Remove completed status restriction**

Read `api/src/controllers/exportController.js`. In both `exportCSV` and `exportExcel` functions, find and modify:

```javascript
// BEFORE (around line 28-33 and 110-115):
if (task.status !== 'completed' || !task.results) {
  return res.status(400).json({
    success: false,
    error: { code: 'TASK_NOT_COMPLETED', message: 'Task not completed yet' }
  });
}

// AFTER:
if (!task.results || task.results.length === 0) {
  return res.status(400).json({
    success: false,
    error: { code: 'NO_RESULTS', message: 'No results available for export' }
  });
}
```

**Step 2: Restart API and test**

Run:
```bash
pm2 restart wipo-api
```

Test with a processing task (if available).

**Step 3: Commit**

```bash
git add api/src/controllers/exportController.js
git commit -m "feat(export): allow exporting tasks that are not completed"
```

---

## Task 5: Add Batch Export Endpoint (Feature 2b)

**Files:**
- Modify: `api/src/controllers/exportController.js`
- Modify: `api/src/routes/export.js`

**Step 1: Add exportBatch function**

In `api/src/controllers/exportController.js`, add new function after `exportPDF`:

```javascript
// Batch Export - merge multiple tasks
const exportBatch = async (req, res) => {
  try {
    const { taskIds, filter } = req.body;
    
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'taskIds must be a non-empty array' }
      });
    }
    
    if (filter && !['eu', 'non-eu'].includes(filter)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILTER', message: 'Filter must be one of: eu, non-eu' }
      });
    }
    
    const allDetails = [];
    
    for (const taskId of taskIds) {
      const task = await taskDB.getById(taskId);
      
      if (!task || !task.results) continue;
      
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
            '是否展开记录': record.isExpanded ? '是' : '否',
            '任务ID': taskId,
            '查询时间': result.queryTime
          });
        }
      }
    }
    
    if (allDetails.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_DATA', message: 'No data found in selected tasks' }
      });
    }
    
    // Create Excel
    const wb = xlsx.utils.book_new();
    const wsDetails = xlsx.utils.json_to_sheet(allDetails);
    wsDetails['!cols'] = [
      {wch: 15}, {wch: 20}, {wch: 40}, {wch: 20},
      {wch: 30}, {wch: 10}, {wch: 15}, {wch: 15},
      {wch: 20}, {wch: 10}, {wch: 15}, {wch: 15},
      {wch: 36}, {wch: 20}
    ];
    xlsx.utils.book_append_sheet(wb, wsDetails, '合并结果');
    
    const filename = `batch-export-${Date.now()}-${taskIds.length}-tasks.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
    
    logger.info('Batch export completed', { taskIds, filter, records: allDetails.length });
    
  } catch (error) {
    logger.error('Batch export failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: error.message }
    });
  }
};
```

**Step 2: Export the new function**

At the bottom of the file, update module.exports:

```javascript
module.exports = {
  exportTask,
  exportCSV,
  exportExcel,
  exportPDF,
  exportBatch  // Add this
};
```

**Step 3: Add route**

In `api/src/routes/export.js`, add:

```javascript
// POST /api/v1/export/batch - Batch export multiple tasks
router.post('/batch', exportController.exportBatch);
```

**Step 4: Restart API and test**

Run:
```bash
pm2 restart wipo-api

# Test batch export
curl -X POST "http://localhost:3000/api/v1/export/batch?apiKey=logotestkey" \
  -H "Content-Type: application/json" \
  -d '{"taskIds": ["<valid-task-id>"]}' \
  --output test-batch.xlsx
```
Expected: Excel file downloaded

**Step 5: Commit**

```bash
git add api/src/controllers/exportController.js api/src/routes/export.js
git commit -m "feat(export): add batch export endpoint for multiple tasks"
```

---

## Task 6: Frontend Batch Export UI (Feature 2c)

**Files:**
- Modify: `dashboard/index.html`
- Modify: `dashboard/js/app.js`
- Modify: `dashboard/js/api.js`

**Step 1: Add batch operation bar in HTML**

In `dashboard/index.html`, find the task list section (around line 55). Before the table, add:

```html
<!-- Batch Operations Bar -->
<div id="batch-ops" class="flex items-center gap-4 mb-4" style="display: none;">
    <span class="text-slate-400 text-sm">已选择 <span id="selected-count" class="text-blue-400 font-bold">0</span> 个任务</span>
    <button onclick="batchExport()" class="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
        批量导出
    </button>
    <button onclick="clearSelection()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition">取消选择</button>
</div>
```

**Step 2: Add checkbox column to table header**

In the table thead, add before "任务ID":

```html
<th class="pb-3 w-10">
    <input type="checkbox" id="select-all" onchange="toggleSelectAll()" class="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500/50 bg-slate-700">
</th>
```

**Step 3: Add checkbox to each row in app.js**

In `updateTaskList()` function, modify the row.innerHTML to add checkbox as first td:

```javascript
row.innerHTML = `
  <td class="py-3">
    <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" onchange="updateSelection()">
  </td>
  <td class="py-3 font-mono text-sm">${task.id.slice(0, 8)}...</td>
  // ... rest of existing columns
`;
```

**Step 4: Add selection functions in app.js**

Add after `deleteTaskHandler` function:

```javascript
let selectedTasks = new Set();

function updateSelection() {
    selectedTasks.clear();
    document.querySelectorAll('.task-checkbox:checked').forEach(cb => {
        selectedTasks.add(cb.dataset.taskId);
    });
    
    const countEl = document.getElementById('selected-count');
    const opsEl = document.getElementById('batch-ops');
    
    if (countEl) countEl.textContent = selectedTasks.size;
    if (opsEl) opsEl.style.display = selectedTasks.size > 0 ? 'flex' : 'none';
    
    // Update select-all checkbox state
    const selectAll = document.getElementById('select-all');
    const totalCheckboxes = document.querySelectorAll('.task-checkbox').length;
    if (selectAll) {
        selectAll.checked = selectedTasks.size === totalCheckboxes && totalCheckboxes > 0;
    }
}

function toggleSelectAll() {
    const selectAll = document.getElementById('select-all');
    const checkboxes = document.querySelectorAll('.task-checkbox');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
    });
    
    updateSelection();
}

function clearSelection() {
    document.querySelectorAll('.task-checkbox').forEach(cb => {
        cb.checked = false;
    });
    document.getElementById('select-all').checked = false;
    updateSelection();
}

async function batchExport() {
    if (selectedTasks.size === 0) {
        alert('请先选择要导出的任务');
        return;
    }
    
    const filter = prompt('筛选条件 (留空=全部, eu=仅欧盟, non-eu=仅非欧盟):') || '';
    const filterValue = filter.toLowerCase().trim();
    
    if (filterValue && !['eu', 'non-eu'].includes(filterValue)) {
        alert('无效的筛选条件，请使用 eu 或 non-eu');
        return;
    }
    
    try {
        const taskIds = Array.from(selectedTasks);
        const blob = await api.batchExport(taskIds, filterValue || null);
        
        // Download file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch-export-${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert(`成功导出 ${taskIds.length} 个任务`);
        clearSelection();
    } catch (error) {
        alert('批量导出失败: ' + error.message);
    }
}
```

**Step 5: Add API function in api.js**

In `dashboard/js/api.js`, add:

```javascript
async batchExport(taskIds, filter) {
    const response = await fetch(`${API_BASE}/export/batch?apiKey=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, filter })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Export failed');
    }
    
    return response.blob();
}
```

**Step 6: Test in browser**

- Open dashboard
- Select multiple tasks with checkboxes
- Click "批量导出"
- Verify Excel file downloads with merged data

**Step 7: Commit**

```bash
git add dashboard/index.html dashboard/js/app.js dashboard/js/api.js
git commit -m "feat(dashboard): add batch export UI with task selection"
```

---

## Task 7: Multi-Task Auto-Splitting (Feature 4)

**Files:**
- Modify: `api/src/controllers/extractController.js`
- Modify: `dashboard/js/app.js`

**Step 1: Add imports to extractController.js**

At the top of `api/src/controllers/extractController.js`, ensure these are imported:

```javascript
const { v4: uuidv4 } = require('uuid');
const { taskDB } = require('../models/database');
const { addTaskToQueue } = require('../services/queueService');
```

**Step 2: Modify extractFromData function**

Replace the entire `extractFromData` function:

```javascript
extractFromData: asyncHandler(async (req, res) => {
    const { data, fileName } = req.body;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
            success: false,
            error: { code: 'MISSING_DATA', message: 'Data array is required' }
        });
    }
    
    try {
        logger.info('Processing data', { fileName, rows: data.length });
        
        const trademarks = await aiService.extractTrademarks(data);
        
        if (trademarks.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_TRADEMARKS_FOUND', message: 'No trademarks found in the data' }
            });
        }
        
        const BATCH_SIZE = 250;
        
        // If small enough, return for frontend modal
        if (trademarks.length <= BATCH_SIZE) {
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
            // Auto-split into multiple tasks
            const batches = [];
            for (let i = 0; i < trademarks.length; i += BATCH_SIZE) {
                batches.push(trademarks.slice(i, i + BATCH_SIZE));
            }
            
            const createdTasks = [];
            
            for (let i = 0; i < batches.length; i++) {
                const taskId = uuidv4();
                const batchTrademarks = batches[i].map(t => t.trim().toUpperCase());
                
                const task = {
                    id: taskId,
                    trademarks: batchTrademarks,
                    status: 'pending',
                    priority: 5,
                    batchIndex: i + 1,
                    totalBatches: batches.length,
                    sourceFile: fileName
                };
                
                await taskDB.create(task);
                await addTaskToQueue(taskId, batchTrademarks, task.priority);
                
                const estimatedSeconds = batchTrademarks.length * 35;
                const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
                
                createdTasks.push({
                    taskId,
                    batchNumber: i + 1,
                    trademarkCount: batchTrademarks.length,
                    estimatedTime: estimatedMinutes > 60 
                        ? `${Math.ceil(estimatedMinutes / 60)}小时`
                        : `${estimatedMinutes}分钟`
                });
            }
            
            logger.info('Auto-split completed', {
                fileName,
                totalTrademarks: trademarks.length,
                batchCount: batches.length
            });
            
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
    } catch (error) {
        logger.error('Data extraction failed', { error: error.message, fileName });
        res.status(500).json({
            success: false,
            error: {
                code: 'EXTRACTION_FAILED',
                message: 'Failed to extract trademarks from data',
                details: error.message
            }
        });
    }
})
```

**Step 3: Update frontend handleFileSelect in app.js**

Modify `handleFileSelect` function to handle split response:

```javascript
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    document.getElementById('file-name').textContent = file.name + ' (解析中...)';
    
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (!jsonData || jsonData.length === 0) {
            alert('Excel 文件为空');
            document.getElementById('file-name').textContent = '';
            return;
        }
        
        document.getElementById('file-name').textContent = file.name + ` (${jsonData.length} 行)`;
        
        const result = await api.extractFromData(jsonData, file.name);
        
        if (result.success && result.data.extractedCount > 0) {
            if (result.data.needsSplit) {
                // Auto-split happened on backend
                const taskList = result.data.tasks.map((t, i) => 
                    `任务${t.batchNumber}: ${t.trademarkCount}个商标 (预计${t.estimatedTime})`
                ).join('\n');
                
                alert(`成功提取 ${result.data.extractedCount} 个商标\n\n已自动拆分为 ${result.data.batchCount} 个任务:\n${taskList}`);
                document.getElementById('file-name').textContent = '';
                await refreshData();
            } else {
                // Show selection modal as before
                extractedTrademarks = result.data.trademarks;
                selectedTrademarks = new Set(extractedTrademarks);
                showTrademarkConfirmationModal(result.data);
            }
        } else {
            alert('未能从文件中提取到商标，请检查文件格式');
        }
    } catch (error) {
        console.error('File processing error:', error);
        alert('文件处理失败: ' + error.message);
    }
    
    event.target.value = '';
}
```

**Step 4: Restart API and test**

Run:
```bash
pm2 restart wipo-api
```

Test: Upload an Excel with 300+ trademarks
Expected: Alert showing tasks were auto-split

**Step 5: Commit**

```bash
git add api/src/controllers/extractController.js dashboard/js/app.js
git commit -m "feat(extract): auto-split large uploads into multiple tasks (250 per task)"
```

---

## Task 8: Final Verification

**Step 1: Run all services**

```bash
pm2 status
```
Expected: All services online

**Step 2: Test Feature 1**

- Open dashboard
- Click on a completed task
- Verify country statistics show in drawer

**Step 3: Test Feature 2**

- Select multiple tasks with checkboxes
- Click batch export
- Verify merged Excel downloads

**Step 4: Test Feature 3**

- Check dashboard shows trademark statistics row
- Verify numbers are real (not hardcoded)

**Step 5: Test Feature 4**

- Upload Excel with 300+ trademarks
- Verify auto-split alert appears
- Check task list for multiple new tasks

**Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: final adjustments for dashboard enhancement"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Country display | `drawer.js` |
| 2 | Trademark stats API | `taskController.js` |
| 3 | Trademark stats UI | `index.html`, `app.js` |
| 4 | Allow incomplete export | `exportController.js` |
| 5 | Batch export endpoint | `exportController.js`, `export.js` |
| 6 | Batch export UI | `index.html`, `app.js`, `api.js` |
| 7 | Auto-split uploads | `extractController.js`, `app.js` |
| 8 | Final verification | All |
