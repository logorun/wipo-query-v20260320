let allTasks = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    setInterval(refreshData, 30000);
});

async function initDashboard() {
    const isHealthy = await api.health();
    const statusEl = document.getElementById('api-status');
    if (isHealthy) {
        statusEl.textContent = 'API Online';
        statusEl.className = 'px-3 py-1 rounded-full text-sm bg-green-500/20 text-green-400';
    } else {
        statusEl.textContent = 'API Offline';
        statusEl.className = 'px-3 py-1 rounded-full text-sm bg-red-500/20 text-red-400';
    }
    await refreshData();
}

async function refreshData() {
    try {
        console.log('[DEBUG] Fetching tasks...');
        const response = await api.getTasks(currentFilter, 100);
        console.log('[DEBUG] API response:', response);
        const data = response.data || response;
        console.log('[DEBUG] Extracted data:', data);
        allTasks = data.tasks || [];
        console.log('[DEBUG] allTasks:', allTasks.length, 'items');
        updateStats(data);
        updateTaskList();
        if (typeof charts !== 'undefined') {
            charts.renderStatusChart(allTasks);
            charts.renderDailyChart(allTasks);
        } else {
            console.warn('[DEBUG] charts object not defined');
        }
    } catch (error) {
        console.error('Failed to refresh:', error);
        document.getElementById('api-status').textContent = 'API Error';
        document.getElementById('api-status').className = 'px-3 py-1 rounded-full text-sm bg-red-500/20 text-red-400';
    }
}

function updateStats(data) {
    if (data && data.total !== undefined) {
        document.getElementById('stat-total').textContent = data.total;
        document.getElementById('stat-completed').textContent = data.completed || 0;
        document.getElementById('stat-processing').textContent = data.processing || 0;
        document.getElementById('stat-failed').textContent = data.failed || 0;
    } else {
        document.getElementById('stat-total').textContent = allTasks.length;
        document.getElementById('stat-completed').textContent = allTasks.filter(t => t.status === 'completed').length;
        document.getElementById('stat-processing').textContent = allTasks.filter(t => t.status === 'processing').length;
        document.getElementById('stat-failed').textContent = allTasks.filter(t => t.status === 'failed').length;
    }
}

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

async function submitTask() {
    const input = document.getElementById('new-trademarks');
    const trademarks = input.value.trim();
    if (!trademarks) { alert('请输入商标名称'); return; }
    try {
        const result = await api.submitTask(trademarks);
        alert(\`任务已提交: \${result.taskId.slice(0, 8)}...\`);
        input.value = '';
        await refreshData();
    } catch (error) {
        alert('提交任务失败: ' + error.message);
    }
}

function viewTask(taskId) {
  if (typeof drawer !== 'undefined') {
    drawer.open(taskId);
  } else {
    console.error('Drawer not initialized');
  }
}

document.getElementById('status-filter')?.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    updateTaskList();
});
