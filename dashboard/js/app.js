let allTasks = [];
let currentFilter = 'all';
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    startSmartPolling();
});

function startSmartPolling() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    refreshInterval = setInterval(smartRefresh, 5000);
}

async function smartRefresh() {
    const hasActiveTasks = allTasks.some(t => t.status === 'processing' || t.status === 'pending');
    
    if (hasActiveTasks) {
        await refreshData();
    }
}

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
    
    // Trademark stats
    const tmStats = data.trademarkStats || {};
    document.getElementById('stat-tm-total').textContent = tmStats.total || 0;
    document.getElementById('stat-tm-processed').textContent = tmStats.processed || 0;
    document.getElementById('stat-tm-pending').textContent = tmStats.pending || 0;
    document.getElementById('stat-tm-eu').textContent = tmStats.euRecords || 0;
    document.getElementById('stat-tm-noneu').textContent = tmStats.nonEuRecords || 0;
}

function updateTaskList() {
  console.log('[DEBUG] updateTaskList called, allTasks:', allTasks);
  const tbody = document.getElementById('task-list');
  if (!tbody) {
    console.error('[DEBUG] task-list element not found!');
    return;
  }
  tbody.innerHTML = '';
  const filteredTasks = currentFilter === 'all' ? allTasks : allTasks.filter(t => t.status === currentFilter);
  console.log('[DEBUG] filteredTasks:', filteredTasks.length);
  
  if (filteredTasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-8 text-center text-slate-500">暂无数据</td></tr>';
    return;
  }
  
  filteredTasks.slice(0, 20).forEach(task => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-800 cursor-pointer hover:bg-slate-800/50 transition';
    
    const statusClass = `status-${task.status}`;
    const statusText = { completed: '已完成', processing: '处理中', pending: '待处理', failed: '失败', paused: '等待开始' }[task.status] || task.status;
    
    // Calculate progress
    const progress = task.progress || {};
    const percent = progress.total ? Math.round((progress.processed / progress.total) * 100) : 0;
    
    const btnClass = "w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 border border-slate-600/50 hover:scale-110 hover:shadow-lg";
    const viewBtn = `<button onclick="event.stopPropagation(); viewTask('${task.id}')" class="${btnClass} bg-slate-800/50 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/50 hover:text-cyan-300" title="查看详情"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></button>`;
    
    let actionBtn = '';
    if (task.status === 'paused') {
      actionBtn = `<button onclick="event.stopPropagation(); startTaskHandler('${task.id}')" class="${btnClass} bg-slate-800/50 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-300" title="开始任务"><svg class="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>`;
    } else if (task.status === 'pending' || task.status === 'processing') {
      actionBtn = `<button onclick="event.stopPropagation(); pauseTaskHandler('${task.id}')" class="${btnClass} bg-slate-800/50 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-300" title="暂停任务"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg></button>`;
    }
    
    const deleteBtn = `<button onclick="event.stopPropagation(); deleteTaskHandler('${task.id}')" class="${btnClass} bg-slate-800/50 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-300" title="删除任务"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>`;
    
    const actionButtons = viewBtn + actionBtn + deleteBtn;
    
    row.innerHTML = `
      <td class="py-3"><input type="checkbox" class="task-checkbox" data-task-id="${task.id}" onchange="updateSelection()"></td>
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
      <td class="py-3"><div class="flex items-center gap-1 opacity-70 hover:opacity-100 transition">${actionButtons}</div></td>
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
        alert(`任务已提交: ${result.taskId.slice(0, 8)}...`);
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

async function startTaskHandler(taskId) {
  if (!confirm('确定要开始这个任务吗？')) return;
  
  try {
    await api.startTask(taskId);
    alert('任务已开始');
    await refreshData();
  } catch (error) {
    alert('开始任务失败: ' + error.message);
  }
}

async function pauseTaskHandler(taskId) {
  if (!confirm('确定要暂停这个任务吗？')) return;
  
  try {
    await api.pauseTask(taskId);
    alert('任务已暂停');
    await refreshData();
  } catch (error) {
    alert('暂停任务失败: ' + error.message);
  }
}

async function deleteTaskHandler(taskId) {
  if (!confirm('确定要删除这个任务吗？此操作不可撤销。')) return;
  
  try {
    await api.deleteTask(taskId);
    alert('任务已删除');
    await refreshData();
  } catch (error) {
    alert('删除任务失败: ' + error.message);
  }
}

let selectedTasks = new Set();

function updateSelection() {
  selectedTasks.clear();
  const checkboxes = document.querySelectorAll('.task-checkbox');
  checkboxes.forEach(cb => {
    if (cb.checked) {
      selectedTasks.add(cb.getAttribute('data-task-id'));
    }
  });
  
  const countEl = document.getElementById('selected-count');
  const batchBar = document.getElementById('batch-ops-bar');
  
  if (countEl) {
    countEl.textContent = selectedTasks.size;
  }
  
  if (batchBar) {
    if (selectedTasks.size > 0) {
      batchBar.classList.remove('hidden');
    } else {
      batchBar.classList.add('hidden');
    }
  }
}

function toggleSelectAll() {
  const selectAllCb = document.getElementById('select-all');
  const checkboxes = document.querySelectorAll('.task-checkbox');
  
  checkboxes.forEach(cb => {
    cb.checked = selectAllCb.checked;
  });
  
  updateSelection();
}

function clearSelection() {
  const selectAllCb = document.getElementById('select-all');
  const checkboxes = document.querySelectorAll('.task-checkbox');
  
  if (selectAllCb) {
    selectAllCb.checked = false;
  }
  
  checkboxes.forEach(cb => {
    cb.checked = false;
  });
  
  selectedTasks.clear();
  updateSelection();
}

let pendingExportTaskIds = [];

function openExportModal() {
  const modal = document.getElementById('export-modal');
  const countEl = document.getElementById('export-task-count');
  
  if (countEl) {
    countEl.textContent = selectedTasks.size;
  }
  
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeExportModal() {
  const modal = document.getElementById('export-modal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
  pendingExportTaskIds = [];
}

async function confirmBatchExport(filter) {
  const taskIds = pendingExportTaskIds;
  const exportAll = filter === 'all';
  
  closeExportModal();
  
  try {
    const blob = await api.batchExport(taskIds, filter);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    alert(`已导出 ${taskIds.length} 个任务的数据（${exportAll ? '全部' : '仅有结果'}）`);
  } catch (error) {
    alert('批量导出失败: ' + error.message);
  }
}

async function batchExport() {
  if (selectedTasks.size === 0) {
    alert('请至少选择一个任务');
    return;
  }
  
  pendingExportTaskIds = Array.from(selectedTasks);
  openExportModal();
}

document.getElementById('status-filter')?.addEventListener('change', (e) => {
    currentFilter = e.target.value;
    updateTaskList();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeExportModal();
    }
});

document.getElementById('export-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'export-modal') {
        closeExportModal();
    }
});

let extractedTrademarks = [];
let selectedTrademarks = new Set();
let currentUploadFile = null;
let currentUploadData = null;
let uploadEventSource = null;

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
            showToast('Excel 文件为空', 'error');
            document.getElementById('file-name').textContent = '';
            event.target.value = '';
            return;
        }
        
        document.getElementById('file-name').textContent = file.name + ` (${jsonData.length} 行)`;
        
        currentUploadFile = file;
        currentUploadData = jsonData;
        
        showUploadConfirmationModal(file, jsonData);
    } catch (error) {
        console.error('File processing error:', error);
        showToast('文件处理失败: ' + error.message, 'error');
    }
    
    event.target.value = '';
}

function showUploadConfirmationModal(file, data) {
    const modal = document.getElementById('upload-modal');
    const stagePreview = document.getElementById('upload-stage-preview');
    const stageProcessing = document.getElementById('upload-stage-processing');
    
    stagePreview.classList.remove('hidden');
    stageProcessing.classList.add('hidden');
    
    document.getElementById('upload-file-name').textContent = file.name;
    document.getElementById('upload-file-info').textContent = `${formatFileSize(file.size)} · ${data.length} 行`;
    document.getElementById('preview-row-count').textContent = data.length;
    document.getElementById('preview-tm-count').textContent = '~' + Math.floor(data.length * 0.3);
    
    renderExcelPreview(data);
    
    const priorityInput = document.getElementById('opt-priority');
    const priorityValue = document.getElementById('priority-value');
    priorityInput.oninput = () => {
        priorityValue.textContent = priorityInput.value;
    };
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function renderExcelPreview(data) {
    const headerRow = document.getElementById('excel-preview-header');
    const body = document.getElementById('excel-preview-body');
    
    headerRow.innerHTML = '';
    body.innerHTML = '';
    
    const previewRows = Math.min(data.length, 50);
    const rows = data.slice(0, previewRows);
    
    if (rows.length === 0) return;
    
    const firstRow = rows[0];
    const colCount = Math.min(firstRow.length || 1, 10);
    
    for (let i = 0; i < colCount; i++) {
        const th = document.createElement('th');
        th.textContent = firstRow[i] || `列 ${i + 1}`;
        th.className = 'px-4 py-3';
        headerRow.appendChild(th);
    }
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const tr = document.createElement('tr');
        tr.className = 'border-b border-slate-700/50';
        
        for (let j = 0; j < colCount; j++) {
            const td = document.createElement('td');
            td.textContent = row[j] || '';
            td.className = 'px-4 py-2 text-slate-400';
            tr.appendChild(td);
        }
        
        body.appendChild(tr);
    }
    
    if (data.length > 50) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="${colCount}" class="px-4 py-3 text-center text-slate-500 italic">... 还有 ${data.length - 50} 行数据 ...</td>`;
        body.appendChild(tr);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    
    if (uploadEventSource) {
        uploadEventSource.close();
        uploadEventSource = null;
    }
    
    currentUploadFile = null;
    currentUploadData = null;
}

async function startProcessing() {
    const autoSplit = document.getElementById('opt-auto-split').checked;
    const priority = parseInt(document.getElementById('opt-priority').value);
    
    document.getElementById('upload-stage-preview').classList.add('hidden');
    document.getElementById('upload-stage-processing').classList.remove('hidden');
    
    resetConsole();
    updateProgress(0, '准备开始处理...');
    
    appendToConsole('system', '初始化 AI 处理流程...');
    appendToConsole('info', `文件: ${currentUploadFile.name}`);
    appendToConsole('info', `数据行数: ${currentUploadData.length}`);
    appendToConsole('info', `自动拆分: ${autoSplit ? '开启' : '关闭'}`);
    appendToConsole('info', `任务优先级: ${priority}`);
    
    try {
        await processWithSSE(currentUploadData, currentUploadFile.name, { autoSplit, priority });
    } catch (error) {
        console.error('Processing error:', error);
        appendToConsole('error', `处理失败: ${error.message}`);
        updateProgress(100, '处理失败');
        showCompletionButtons();
    }
}

async function processWithSSE(data, fileName, options) {
    const API_BASE = 'http://95.134.250.48:3000/api/v1';
    const API_KEY = 'logotestkey';
    
    console.log('[DEBUG] processWithSSE starting', { fileName, dataLength: data.length, options });
    
    const url = new URL(`${API_BASE}/extract/stream`);
    url.searchParams.append('apiKey', API_KEY);
    
    console.log('[DEBUG] Fetching SSE from:', url.toString());
    
    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, fileName, options })
    });
    
    console.log('[DEBUG] SSE response received', { status: response.status, ok: response.ok });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    appendToConsole('system', '开始流式接收处理结果...');
    console.log('[DEBUG] Starting to read SSE stream...');
    
    let buffer = '';
    let eventCount = 0;
    
    while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
            console.log('[DEBUG] SSE stream done, total events:', eventCount);
            break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
                try {
                    const event = JSON.parse(line.trim().substring(6));
                    eventCount++;
                    console.log('[DEBUG] SSE event received', { type: event.type, count: eventCount });
                    handleStreamEvent(event);
                } catch (e) {
                    console.error('[DEBUG] Parse error:', line, e);
                }
            }
        }
    }
    
    console.log('[DEBUG] processWithSSE completed');
}

function handleStreamEvent(event) {
    console.log('[DEBUG] Handling stream event:', event.type, event);
    
    switch (event.type) {
        case 'log':
            appendToConsole(event.level || 'info', event.message);
            break;
        case 'progress':
            updateProgress(event.percent, event.message);
            break;
        case 'trademark':
            document.getElementById('stat-extracted').textContent = event.count;
            appendToConsole('success', `提取到商标: ${event.name}`);
            break;
        case 'task':
            document.getElementById('stat-tasks').textContent = event.current;
            appendToConsole('info', `任务 ${event.current}/${event.total} 创建成功 (ID: ${event.id.slice(0, 8)}...)`);
            break;
        case 'complete':
            updateProgress(100, '处理完成！');
            appendToConsole('success', `✓ 处理完成！共提取 ${event.totalTrademarks} 个商标，创建 ${event.totalTasks} 个任务`);
            showCompletionButtons();
            break;
        case 'error':
            appendToConsole('error', event.message);
            break;
        case 'ai_start':
            appendToConsole('ai', event.message || 'AI 开始分析...');
            break;
        case 'ai_output':
            appendAIOutput(event.content);
            break;
        case 'ai_end':
            appendToConsole('ai', '---');
            break;
    }
}

function updateProgress(percent, message) {
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-percent');
    const status = document.getElementById('progress-status');
    
    bar.style.width = percent + '%';
    text.textContent = Math.round(percent) + '%';
    status.innerHTML = `<span class="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>${message}`;
}

function appendToConsole(level, message) {
    const output = document.getElementById('console-output');
    const emptyMsg = output.querySelector('.italic');
    if (emptyMsg) emptyMsg.remove();
    
    const line = document.createElement('div');
    line.className = `console-line console-${level}`;
    
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour12: false });
    
    let prefix = '>';
    if (level === 'success') prefix = '✓';
    if (level === 'error') prefix = '✗';
    if (level === 'warn') prefix = '!';
    if (level === 'system') prefix = '►';
    if (level === 'ai') prefix = '🤖';
    
    line.innerHTML = `<span class="console-timestamp">[${time}]</span> <span class="console-prefix">${prefix}</span> ${escapeHtml(message)}`;
    
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

let aiOutputLine = null;

function appendAIOutput(content) {
    const output = document.getElementById('console-output');
    const emptyMsg = output.querySelector('.italic');
    if (emptyMsg) emptyMsg.remove();
    
    if (!aiOutputLine) {
        aiOutputLine = document.createElement('div');
        aiOutputLine.className = 'console-line console-ai-stream';
        
        const now = new Date();
        const time = now.toLocaleTimeString('zh-CN', { hour12: false });
        
        aiOutputLine.innerHTML = `<span class="console-timestamp">[${time}]</span> <span class="console-prefix">🤖</span> <span class="ai-content"></span>`;
        output.appendChild(aiOutputLine);
    }
    
    const contentSpan = aiOutputLine.querySelector('.ai-content');
    contentSpan.textContent += content;
    output.scrollTop = output.scrollHeight;
}

function resetConsole() {
    const output = document.getElementById('console-output');
    output.innerHTML = '<div class="text-slate-500 italic">Waiting for process to start...</div>';
    document.getElementById('stat-extracted').textContent = '0';
    document.getElementById('stat-tasks').textContent = '0';
    aiOutputLine = null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showCompletionButtons() {
    const footer = document.getElementById('processing-footer');
    footer.classList.remove('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium transform transition-all duration-300 translate-y-10 opacity-0 z-50 ${
        type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    });
    
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function showTrademarkConfirmationModal(data) {
    const existingModal = document.getElementById('trademark-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'trademark-modal';
    modal.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="glass rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div class="p-6 border-b border-slate-700">
                <div class="flex items-center justify-between">
                    <h3 class="text-xl font-semibold text-white">确认商标列表</h3>
                    <button onclick="closeTrademarkModal()" class="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>
                <p class="text-slate-400 text-sm mt-2">
                    从 "${data.fileName}" 中提取到 ${data.extractedCount} 个商标
                    <span id="selected-count" class="text-blue-400 ml-2">已选择: ${selectedTrademarks.size}</span>
                </p>
            </div>
            
            <div class="p-4 border-b border-slate-700 flex gap-4">
                <button onclick="selectAllTrademarks()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition">全选</button>
                <button onclick="deselectAllTrademarks()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition">取消全选</button>
                <button onclick="invertTrademarkSelection()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition">反选</button>
            </div>
            
            <div class="flex-1 overflow-y-auto p-6">
                <div id="trademark-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    ${data.trademarks.map((tm, idx) => `
                        <label class="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition border border-slate-700 hover:border-blue-500/50">
                            <input type="checkbox" 
                                   value="${tm}" 
                                   ${selectedTrademarks.has(tm) ? 'checked' : ''}
                                   onchange="toggleTrademarkSelection('${tm.replace(/'/g, "\\'")}')"
                                   class="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500/50 bg-slate-700">
                            <span class="text-slate-300 text-sm truncate" title="${tm}">${tm}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            
            <div class="p-6 border-t border-slate-700 flex justify-end gap-4">
                <button onclick="closeTrademarkModal()" class="px-6 py-2 text-slate-400 hover:text-white transition">取消</button>
                <button onclick="submitSelectedTrademarks()" class="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition font-medium">
                    确认并提交 (${selectedTrademarks.size} 个商标)
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeTrademarkModal() {
    const modal = document.getElementById('trademark-modal');
    if (modal) {
        modal.remove();
    }
    extractedTrademarks = [];
    selectedTrademarks.clear();
}

function toggleTrademarkSelection(trademark) {
    if (selectedTrademarks.has(trademark)) {
        selectedTrademarks.delete(trademark);
    } else {
        selectedTrademarks.add(trademark);
    }
    updateSelectedCount();
}

function selectAllTrademarks() {
    extractedTrademarks.forEach(tm => selectedTrademarks.add(tm));
    refreshTrademarkCheckboxes();
    updateSelectedCount();
}

function deselectAllTrademarks() {
    selectedTrademarks.clear();
    refreshTrademarkCheckboxes();
    updateSelectedCount();
}

function invertTrademarkSelection() {
    extractedTrademarks.forEach(tm => {
        if (selectedTrademarks.has(tm)) {
            selectedTrademarks.delete(tm);
        } else {
            selectedTrademarks.add(tm);
        }
    });
    refreshTrademarkCheckboxes();
    updateSelectedCount();
}

function refreshTrademarkCheckboxes() {
    const checkboxes = document.querySelectorAll('#trademark-grid input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = selectedTrademarks.has(cb.value);
    });
}

function updateSelectedCount() {
    const countEl = document.getElementById('selected-count');
    const submitBtn = document.querySelector('#trademark-modal button[onclick="submitSelectedTrademarks()"]');
    
    if (countEl) {
        countEl.textContent = `已选择: ${selectedTrademarks.size}`;
    }
    if (submitBtn) {
        submitBtn.textContent = `确认并提交 (${selectedTrademarks.size} 个商标)`;
    }
}

async function submitSelectedTrademarks() {
    if (selectedTrademarks.size === 0) {
        alert('请至少选择一个商标');
        return;
    }

    if (selectedTrademarks.size > 1000) {
        alert('每次最多只能提交1000个商标');
        return;
    }

    const trademarks = Array.from(selectedTrademarks);
    
    try {
        const result = await api.submitTask(trademarks);
        alert(`成功提交 ${selectedTrademarks.size} 个商标查询任务`);
        closeTrademarkModal();
        await refreshData();
    } catch (error) {
        alert('提交任务失败: ' + error.message);
    }
}
