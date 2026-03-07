# Dashboard Web UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time web dashboard for WIPO trademark query system with drawer-based task details, progress tracking, and results visualization.

**Architecture:** Extend existing dashboard with new drawer component, real-time polling system, and results table. Use vanilla JS with Tailwind CSS, maintain single-page architecture.

**Tech Stack:** HTML5, Vanilla JavaScript, Tailwind CSS (CDN), Chart.js (CDN)

---

## Prerequisites

Existing dashboard at `/root/.openclaw/workspace/projects/wipo-trademark-batch/dashboard/`
- `index.html` - main page
- `js/api.js` - API client
- `js/app.js` - main app logic
- `js/charts.js` - chart components

---

## Task 1: Enhance API Client for Real-time Updates

**Files:**
- Modify: `dashboard/js/api.js`

**Step 1: Add polling method**

```javascript
// Add to api object
pollTask: async function(taskId, onUpdate, interval = 5000) {
  const poll = async () => {
    try {
      const task = await this.getTask(taskId);
      onUpdate(task);
      
      // Continue polling if not completed
      if (task.status === 'processing' || task.status === 'pending') {
        return setTimeout(poll, interval);
      }
    } catch (error) {
      console.error('Poll error:', error);
      setTimeout(poll, interval * 2); // Backoff on error
    }
  };
  
  const timeoutId = await poll();
  
  // Return cleanup function
  return () => clearTimeout(timeoutId);
}
```

**Step 2: Test the polling**

Run: Open browser console, test:
```javascript
const cleanup = await api.pollTask('some-task-id', (task) => {
  console.log('Updated:', task.status);
});
```

**Step 3: Commit**

```bash
git add dashboard/js/api.js
git commit -m "feat(api): add polling method for real-time task updates"
```

---

## Task 2: Create Drawer Component

**Files:**
- Create: `dashboard/js/drawer.js`
- Create: `dashboard/css/drawer.css`

**Step 1: Create drawer.js**

```javascript
class TaskDrawer {
  constructor() {
    this.drawer = null;
    this.isOpen = false;
    this.currentTaskId = null;
    this.cleanup = null;
    this.init();
  }
  
  init() {
    // Create drawer DOM structure
    this.drawer = document.createElement('div');
    this.drawer.className = 'task-drawer';
    this.drawer.innerHTML = `
      <div class="drawer-backdrop"></div>
      <div class="drawer-content">
        <div class="drawer-header">
          <h2>任务详情</h2>
          <button class="drawer-close">&times;</button>
        </div>
        <div class="drawer-body">
          <div class="progress-section">
            <div class="progress-header">
              <span>总体进度</span>
              <span class="progress-percent">0%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
          </div>
          <div class="log-section">
            <h3>实时处理日志</h3>
            <div class="log-container"></div>
          </div>
          <div class="results-section">
            <h3>查询结果</h3>
            <div class="results-container"></div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.drawer);
    
    // Event listeners
    this.drawer.querySelector('.drawer-close').addEventListener('click', () => this.close());
    this.drawer.querySelector('.drawer-backdrop').addEventListener('click', () => this.close());
    
    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }
  
  open(taskId) {
    this.currentTaskId = taskId;
    this.isOpen = true;
    this.drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    // Start polling
    this.loadTask(taskId);
    this.startPolling(taskId);
  }
  
  close() {
    this.isOpen = false;
    this.drawer.classList.remove('open');
    document.body.style.overflow = '';
    
    // Stop polling
    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }
  }
  
  async loadTask(taskId) {
    try {
      const task = await api.getTask(taskId);
      this.updateUI(task);
    } catch (error) {
      console.error('Failed to load task:', error);
    }
  }
  
  startPolling(taskId) {
    this.cleanup = api.pollTask(taskId, (task) => {
      this.updateUI(task);
    });
  }
  
  updateUI(task) {
    // Update progress
    const progress = task.progress || {};
    const percent = progress.total ? Math.round((progress.processed / progress.total) * 100) : 0;
    
    this.drawer.querySelector('.progress-percent').textContent = `${percent}%`;
    this.drawer.querySelector('.progress-fill').style.width = `${percent}%`;
    
    // Update logs
    if (task.processingStatus) {
      this.updateLogs(task.processingStatus, task.results);
    }
    
    // Update results
    if (task.results) {
      this.updateResults(task.results);
    }
  }
  
  updateLogs(processingStatus, results) {
    const container = this.drawer.querySelector('.log-container');
    const { completedTrademarks = [], pendingTrademarks = [] } = processingStatus;
    
    let html = '';
    
    // Completed items
    completedTrademarks.forEach(tm => {
      const result = results.find(r => r.trademark === tm);
      const count = result ? result.totalRecords : 0;
      html += `<div class="log-item completed">
        <span class="log-icon">✓</span>
        <span class="log-name">${tm}</span>
        <span class="log-status">完成 (${count}条记录)</span>
      </div>`;
    });
    
    // Pending items
    pendingTrademarks.forEach(tm => {
      html += `<div class="log-item pending">
        <span class="log-icon">⏸</span>
        <span class="log-name">${tm}</span>
        <span class="log-status">等待中</span>
      </div>`;
    });
    
    container.innerHTML = html;
  }
  
  updateResults(results) {
    const container = this.drawer.querySelector('.results-container');
    
    // Flatten all records from all results
    const allRecords = [];
    results.forEach(result => {
      if (result.records && result.records.length > 0) {
        result.records.forEach(record => {
          allRecords.push({
            ...record,
            trademark: result.trademark
          });
        });
      }
    });
    
    if (allRecords.length === 0) {
      container.innerHTML = '<div class="no-results">暂无结果</div>';
      return;
    }
    
    // Create table
    let html = `
      <table class="results-table">
        <thead>
          <tr>
            <th>商标</th>
            <th>状态</th>
            <th>日期</th>
            <th>国家</th>
            <th>注册号</th>
            <th>欧盟</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    allRecords.forEach((record, index) => {
      html += `
        <tr data-index="${index}">
          <td>${record.trademark}</td>
          <td><span class="status-badge ${record.status?.toLowerCase()}">${record.status || 'N/A'}</span></td>
          <td>${record.statusDate || '-'}</td>
          <td>${record.country || '-'}</td>
          <td>${record.regNumber || '-'}</td>
          <td>${record.isEU ? '是' : '否'}</td>
          <td><button class="btn-expand" onclick="drawer.toggleCard(${index})">详情</button></td>
        </tr>
        <tr class="card-row" id="card-${index}" style="display: none;">
          <td colspan="7">
            <div class="detail-card">
              <div class="detail-row"><span>持有人:</span> ${record.owner || '-'}</div>
              <div class="detail-row"><span>国家代码:</span> ${record.countryCode || '-'}</div>
              <div class="detail-row"><span>尼斯分类:</span> ${record.niceClasses?.join(', ') || '-'}</div>
              <div class="detail-row"><span>是否欧洲:</span> ${record.isEurope ? '是' : '否'}</div>
              <div class="detail-row"><span>是否国际注册:</span> ${record.isInternational ? '是' : '否'}</div>
            </div>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  
  toggleCard(index) {
    const card = document.getElementById(`card-${index}`);
    if (card) {
      card.style.display = card.style.display === 'none' ? 'table-row' : 'none';
    }
  }
}

// Initialize
drawer = new TaskDrawer();
```

**Step 2: Create drawer.css**

```css
.task-drawer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  visibility: hidden;
  opacity: 0;
  transition: visibility 0s, opacity 0.3s;
}

.task-drawer.open {
  visibility: visible;
  opacity: 1;
}

.drawer-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.drawer-content {
  position: absolute;
  top: 0;
  right: 0;
  width: 600px;
  max-width: 90vw;
  height: 100%;
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  border-left: 1px solid rgba(148, 163, 184, 0.2);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;
}

.task-drawer.open .drawer-content {
  transform: translateX(0);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.drawer-header h2 {
  color: #f8fafc;
  font-size: 1.25rem;
  margin: 0;
}

.drawer-close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  line-height: 1;
  transition: color 0.2s;
}

.drawer-close:hover {
  color: #f8fafc;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.progress-section {
  margin-bottom: 2rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  color: #94a3b8;
  margin-bottom: 0.5rem;
}

.progress-percent {
  color: #06b6d4;
  font-weight: 600;
}

.progress-bar {
  height: 8px;
  background: rgba(148, 163, 184, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #06b6d4, #10b981);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.log-section,
.results-section {
  margin-bottom: 2rem;
}

.log-section h3,
.results-section h3 {
  color: #f8fafc;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.log-container {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  padding: 1rem;
  max-height: 200px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.log-item:last-child {
  border-bottom: none;
}

.log-icon {
  width: 20px;
  text-align: center;
}

.log-item.completed .log-icon {
  color: #10b981;
}

.log-item.pending .log-icon {
  color: #64748b;
}

.log-name {
  flex: 1;
  color: #f8fafc;
  font-weight: 500;
}

.log-status {
  color: #94a3b8;
  font-size: 0.875rem;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.results-table th {
  text-align: left;
  padding: 0.75rem;
  color: #94a3b8;
  font-weight: 500;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.results-table td {
  padding: 0.75rem;
  color: #f8fafc;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.registered {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.btn-expand {
  background: rgba(6, 182, 212, 0.2);
  color: #06b6d4;
  border: none;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: background 0.2s;
}

.btn-expand:hover {
  background: rgba(6, 182, 212, 0.3);
}

.card-row {
  background: rgba(15, 23, 42, 0.5);
}

.detail-card {
  padding: 1rem;
  margin: 0.5rem;
  background: rgba(30, 41, 59, 0.8);
  border-radius: 8px;
}

.detail-row {
  display: flex;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row span:first-child {
  width: 120px;
  color: #94a3b8;
}

.detail-row span:last-child {
  color: #f8fafc;
  flex: 1;
}

.no-results {
  text-align: center;
  padding: 2rem;
  color: #64748b;
}

@media (max-width: 768px) {
  .drawer-content {
    width: 100%;
    max-width: 100%;
  }
}
```

**Step 3: Commit**

```bash
git add dashboard/js/drawer.js dashboard/css/drawer.css
git commit -m "feat(drawer): add task detail drawer component with real-time updates"
```

---

## Task 3: Integrate Drawer with Task List

**Files:**
- Modify: `dashboard/js/app.js`

**Step 1: Update viewTask function**

```javascript
// Replace existing viewTask function
async function viewTask(taskId) {
  if (typeof drawer !== 'undefined') {
    drawer.open(taskId);
  } else {
    console.error('Drawer not initialized');
  }
}
```

**Step 2: Update task list rendering to show progress**

```javascript
// Update updateTaskList function
function updateTaskList() {
  const tbody = document.getElementById('task-list');
  tbody.innerHTML = '';
  const filteredTasks = currentFilter === 'all' ? allTasks : allTasks.filter(t => t.status === currentFilter);
  
  filteredTasks.slice(0, 20).forEach(task => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 transition';
    
    const statusClass = `status-${task.status}`;
    const statusText = { completed: '已完成', processing: '处理中', pending: '待处理', failed: '失败' }[task.status] || task.status;
    
    // Calculate progress
    const progress = task.progress || {};
    const percent = progress.total ? Math.round((progress.processed / progress.total) * 100) : 0;
    
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
      <td class="py-3"><button onclick="event.stopPropagation(); viewTask('${task.id}')" class="text-cyan-400 hover:text-cyan-300 text-sm">查看</button></td>
    `;
    
    // Click row to open drawer
    row.addEventListener('click', () => viewTask(task.id));
    
    tbody.appendChild(row);
  });
}
```

**Step 3: Test drawer integration**

1. Open dashboard in browser
2. Click any task row or "查看" button
3. Verify drawer opens from right
4. Verify progress, logs, and results display

**Step 4: Commit**

```bash
git add dashboard/js/app.js
git commit -m "feat(app): integrate drawer with task list, add progress bars"
```

---

## Task 4: Update Dashboard HTML

**Files:**
- Modify: `dashboard/index.html`

**Step 1: Add drawer CSS and JS imports**

Add before closing `</body>`:
```html
<link rel="stylesheet" href="css/drawer.css">
<script src="js/drawer.js"></script>
```

**Step 2: Update table headers**

Change:
```html
<tr class="text-slate-400 border-b border-slate-700">
  <th class="pb-3">任务ID</th>
  <th class="pb-3">商标</th>
  <th class="pb-3">状态</th>
  <th class="pb-3">创建时间</th>
  <th class="pb-3">操作</th>
</tr>
```

To:
```html
<tr class="text-slate-400 border-b border-slate-700">
  <th class="pb-3">任务ID</th>
  <th class="pb-3">商标数</th>
  <th class="pb-3">进度</th>
  <th class="pb-3">状态</th>
  <th class="pb-3">创建时间</th>
  <th class="pb-3">操作</th>
</tr>
```

**Step 3: Test complete dashboard**

1. Refresh dashboard page
2. Verify all components load
3. Test drawer functionality
4. Test real-time updates

**Step 4: Commit**

```bash
git add dashboard/index.html
git commit -m "feat(html): update dashboard layout, add drawer imports"
```

---

## Task 5: Final Testing and Documentation

**Files:**
- Test: `dashboard/` (all files)
- Create: `dashboard/README.md`

**Step 1: Create README**

```markdown
# WIPO Dashboard

Web interface for WIPO trademark query system.

## Features
- Real-time task monitoring with progress bars
- Drawer-based task detail view
- Live processing logs
- Results table with expandable cards
- Status distribution charts

## Usage
1. Open `index.html` in browser
2. API must be running at `http://localhost:3000`
3. Click any task to view details
4. Drawer shows real-time updates every 5 seconds

## File Structure
- `index.html` - Main page
- `js/api.js` - API client
- `js/app.js` - Main application
- `js/drawer.js` - Task detail drawer
- `js/charts.js` - Chart components
- `css/styles.css` - Main styles
- `css/drawer.css` - Drawer styles
```

**Step 2: Final test checklist**

- [ ] Dashboard loads without errors
- [ ] Task list displays with progress bars
- [ ] Clicking task opens drawer
- [ ] Drawer shows progress percentage
- [ ] Real-time logs update during processing
- [ ] Results table displays correctly
- [ ] Card details expand/collapse
- [ ] Drawer closes properly
- [ ] Auto-refresh works (30s interval)

**Step 3: Final commit**

```bash
git add dashboard/README.md
git commit -m "docs: add dashboard readme"
git log --oneline -10
```

---

## Summary

**Implementation complete!**

New features added:
1. ✅ Real-time polling for task updates
2. ✅ Drawer component for task details
3. ✅ Progress bars in task list
4. ✅ Live processing logs
5. ✅ Results table with expandable cards
6. ✅ Tech industrial aesthetic design

**Testing:**
- Start API: `pm2 start api/ecosystem.config.js`
- Open: `dashboard/index.html`
- Test with active tasks

---

Plan complete and saved to `docs/plans/2026-03-07-dashboard-implementation.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks
2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution

Which approach?
