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
        const response = await api.getTasks(currentFilter, 100);
        allTasks = response.tasks || [];
        updateStats();
        updateTaskList();
        charts.renderStatusChart(allTasks);
        charts.renderDailyChart(allTasks);
    } catch (error) {
        console.error('Failed to refresh:', error);
    }
}

function updateStats() {
    document.getElementById('stat-total').textContent = allTasks.length;
    document.getElementById('stat-completed').textContent = allTasks.filter(t => t.status === 'completed').length;
    document.getElementById('stat-processing').textContent = allTasks.filter(t => t.status === 'processing').length;
    document.getElementById('stat-failed').textContent = allTasks.filter(t => t.status === 'failed').length;
}

function updateTaskList() {
    const tbody = document.getElementById('task-list');
    tbody.innerHTML = '';
    const filteredTasks = currentFilter === 'all' ? allTasks : allTasks.filter(t => t.status === currentFilter);
    filteredTasks.slice(0, 20).forEach(task => {
        const row = document.createElement('tr');
        row.className = 'border-b border-slate-800';
        const statusClass = \`status-\${task.status}\`;
        const statusText = { completed: '已完成', processing: '处理中', pending: '待处理', failed: '失败' }[task.status] || task.status;
        row.innerHTML = \`
            <td class="py-3 font-mono text-sm">\${task.id.slice(0, 8)}...</td>
            <td class="py-3">\${task.trademarks?.join(', ') || '-'}</td>
            <td class="py-3"><span class="status-badge \${statusClass}">\${statusText}</span></td>
            <td class="py-3 text-sm">\${new Date(task.createdAt).toLocaleString('zh-CN')}</td>
            <td class="py-3"><button onclick="viewTask('\${task.id}')" class="text-blue-400 hover:text-blue-300 text-sm">查看</button></td>
        \`;
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

async function viewTask(taskId) {
    try {
        const task = await api.getTask(taskId);
        alert(JSON.stringify(task, null, 2));
    } catch (error) {
        alert('获取任务详情失败');
    }
}

document.getElementById('status-filter')?.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    updateTaskList();
});
