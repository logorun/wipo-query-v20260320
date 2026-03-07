// ========================================
// WIPO 商标查询系统 - 前端应用
// ========================================

// API 配置
const API_BASE = '/api/v1';
let apiKey = localStorage.getItem('apiKey') || '';

// 状态管理
let statusChart = null;
let trendChart = null;
let currentTasks = [];
let pollingInterval = null;

// 页面加载
window.onload = function() {
  // 初始化主题
  initTheme();
  
  if (apiKey) {
    showMainPage();
  } else {
    showLoginPage();
  }
};

// ========================================
// 主题管理
// ========================================
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('.theme-toggle i');
  if (icon) {
    icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
  }
}

// ========================================
// 登录/登出
// ========================================
function login() {
  const key = document.getElementById('api-key').value.trim();
  if (!key) {
    showToast('请输入 API Key', 'error');
    return;
  }
  
  apiKey = key;
  localStorage.setItem('apiKey', apiKey);
  showMainPage();
  showToast('登录成功', 'success');
}

function logout() {
  apiKey = '';
  localStorage.removeItem('apiKey');
  stopPolling();
  showLoginPage();
}

// ========================================
// 页面导航
// ========================================
function showLoginPage() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('main-page').classList.add('hidden');
}

function showMainPage() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('main-page').classList.remove('hidden');
  showPage('dashboard');
}

function showPage(page) {
  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
    if (el.dataset.page === page) {
      el.classList.add('active');
    }
  });
  
  // 隐藏所有内容页面
  document.querySelectorAll('.content-page').forEach(el => {
    el.classList.add('hidden');
  });
  
  // 显示指定页面
  document.getElementById(page + '-page').classList.remove('hidden');
  
  // 加载数据
  switch(page) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'tasks':
      loadTasks();
      break;
  }
}

// ========================================
// API 请求
// ========================================
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (response.status === 401 || response.status === 403) {
      showToast('API Key 无效，请重新登录', 'error');
      logout();
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('API请求失败:', error);
    showToast('网络请求失败', 'error');
    return null;
  }
}

// ========================================
// 仪表盘
// ========================================
async function loadDashboard() {
  // 加载统计数据
  const data = await apiRequest(`${API_BASE}/tasks?limit=100`);
  
  if (!data || !data.success) {
    return;
  }
  
  const tasks = data.data.tasks;
  
  // 统计各状态数量
  const stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  };
  
  tasks.forEach(task => {
    if (stats[task.status] !== undefined) {
      stats[task.status]++;
    }
  });
  
  // 更新统计卡片
  document.getElementById('stat-pending').textContent = stats.pending;
  document.getElementById('stat-processing').textContent = stats.processing;
  document.getElementById('stat-completed').textContent = stats.completed;
  document.getElementById('stat-failed').textContent = stats.failed;
  
  // 渲染图表
  renderStatusChart(stats);
  renderTrendChart(tasks);
  
  // 加载最近任务
  renderRecentTasks(tasks.slice(0, 5));
  
  // 启动轮询
  startPolling();
}

function renderStatusChart(stats) {
  const ctx = document.getElementById('statusChart');
  if (!ctx) return;
  
  if (statusChart) {
    statusChart.destroy();
  }
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  
  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['等待中', '处理中', '已完成', '失败'],
      datasets: [{
        data: [stats.pending, stats.processing, stats.completed, stats.failed],
        backgroundColor: [
          '#f59e0b',
          '#3b82f6',
          '#10b981',
          '#ef4444'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            padding: 20,
            usePointStyle: true
          }
        }
      },
      cutout: '65%'
    }
  });
}

function renderTrendChart(tasks) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;
  
  if (trendChart) {
    trendChart.destroy();
  }
  
  // 计算最近7天的数据
  const days = [];
  const completedData = [];
  const createdData = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    days.push(date.getMonth() + 1 + '/' + date.getDate());
    
    const dayTasks = tasks.filter(t => {
      const taskDate = new Date(t.createdAt).toISOString().split('T')[0];
      return taskDate === dateStr;
    });
    
    createdData.push(dayTasks.length);
    completedData.push(dayTasks.filter(t => t.status === 'completed').length);
  }
  
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  
  trendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        {
          label: '创建',
          data: createdData,
          backgroundColor: '#6366f1',
          borderRadius: 4
        },
        {
          label: '完成',
          data: completedData,
          backgroundColor: '#10b981',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            padding: 20,
            usePointStyle: true
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { 
            color: textColor,
            stepSize: 1
          }
        }
      }
    }
  });
}

function renderRecentTasks(tasks) {
  const container = document.getElementById('recent-tasks-list');
  
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-inbox"></i>
        <p>暂无任务</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = tasks.map(task => `
    <div class="task-item" onclick="viewTask('${task.id}')">
      <div class="task-item-info">
        <span class="task-item-id">${task.id.slice(0, 8)}...</span>
        <span class="task-item-count">${task.trademarks.length} 个商标</span>
      </div>
      <span class="status status-${task.status}">
        ${getStatusText(task.status)}
      </span>
    </div>
  `).join('');
}

// ========================================
// 任务列表
// ========================================
async function loadTasks() {
  const status = document.getElementById('status-filter').value;
  const tbody = document.getElementById('tasks-table-body');
  
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="loading-cell">
        <i class="fas fa-spinner fa-spin"></i> 加载中...
      </td>
    </tr>
  `;
  
  try {
    const data = await apiRequest(`${API_BASE}/tasks?status=${status}&limit=50`);
    
    if (!data || !data.success) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="loading-cell">加载失败</td>
        </tr>
      `;
      return;
    }
    
    currentTasks = data.data.tasks;
    
    if (currentTasks.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="loading-cell">暂无任务</td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = currentTasks.map(task => `
      <tr>
        <td>
          <code style="font-size: 12px;">${task.id.slice(0, 8)}...</code>
        </td>
        <td>${task.trademarks.length}</td>
        <td>
          <span class="status status-${task.status}">
            ${getStatusText(task.status)}
          </span>
        </td>
        <td>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${calculateProgress(task.progress)}%"></div>
          </div>
          <span style="font-size: 12px; color: var(--text-muted);">
            ${task.progress.processed}/${task.progress.total}
          </span>
        </td>
        <td>${formatTime(task.createdAt)}</td>
        <td>
          <button class="btn btn-sm" onclick="event.stopPropagation(); viewTask('${task.id}')">
            <i class="fas fa-eye"></i> 查看
          </button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="loading-cell">加载失败: ${error.message}</td>
      </tr>
    `;
  }
}

// ========================================
// 任务详情
// ========================================
async function viewTask(taskId) {
  showPage('task-detail');
  window.currentTaskId = taskId;
  
  const infoDiv = document.getElementById('task-info');
  const statsDiv = document.getElementById('task-stats');
  const resultsDiv = document.getElementById('task-results');
  
  infoDiv.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div>';
  statsDiv.innerHTML = '<div class="skeleton-line"></div><div class="skeleton-line"></div>';
  resultsDiv.innerHTML = '';
  
  try {
    const data = await apiRequest(`${API_BASE}/tasks/${taskId}`);
    
    if (!data || !data.success) {
      infoDiv.innerHTML = '<p>加载失败</p>';
      return;
    }
    
    const task = data.data;
    
    // 任务信息
    infoDiv.innerHTML = `
      <p>
        <span class="label">任务ID:</span>
        <span class="value">${task.id.slice(0, 12)}...</span>
      </p>
      <p>
        <span class="label">状态:</span>
        <span class="value">
          <span class="status status-${task.status}">${getStatusText(task.status)}</span>
        </span>
      </p>
      <p>
        <span class="label">创建时间:</span>
        <span class="value">${formatTime(task.createdAt)}</span>
      </p>
      ${task.completedAt ? `
        <p>
          <span class="label">完成时间:</span>
          <span class="value">${formatTime(task.completedAt)}</span>
        </p>
      ` : ''}
    `;
    
    // 统计信息
    const totalRecords = task.results ? task.results.reduce((sum, r) => sum + (r.records?.length || 0), 0) : 0;
    const euRecords = task.results ? task.results.reduce((sum, r) => sum + (r.records?.filter(rec => rec.isEU).length || 0), 0) : 0;
    
    statsDiv.innerHTML = `
      <p>
        <span class="label">商标数量:</span>
        <span class="value">${task.trademarks.length}</span>
      </p>
      <p>
        <span class="label">处理进度:</span>
        <span class="value">${task.progress.processed}/${task.progress.total} (${calculateProgress(task.progress)}%)</span>
      </p>
      <p>
        <span class="label">总记录数:</span>
        <span class="value">${totalRecords}</span>
      </p>
      <p>
        <span class="label">欧盟记录:</span>
        <span class="value">${euRecords}</span>
      </p>
    `;
    
    // 结果展示
    if (task.status === 'completed' && task.results && task.results.length > 0) {
      resultsDiv.innerHTML = `
        <div class="summary-cards">
          <div class="card">
            <h4>总记录数</h4>
            <p class="number">${totalRecords}</p>
          </div>
          <div class="card">
            <h4>欧盟记录</h4>
            <p class="number">${euRecords}</p>
          </div>
          <div class="card">
            <h4>非欧盟记录</h4>
            <p class="number">${totalRecords - euRecords}</p>
          </div>
        </div>
        
        <div class="table-container" style="margin-top: 20px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>查询商标</th>
                <th>品牌名称</th>
                <th>状态</th>
                <th>国家/地区</th>
                <th>注册号</th>
              </tr>
            </thead>
            <tbody>
              ${task.results.flatMap(r => (r.records || []).map(rec => `
                <tr>
                  <td>${r.trademark}</td>
                  <td>${rec.brandName || '-'}</td>
                  <td>${rec.status || '-'}</td>
                  <td>${rec.country || '-'}</td>
                  <td>${rec.regNumber || '-'}</td>
                </tr>
              `)).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (task.status === 'processing') {
      resultsDiv.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-spinner fa-spin" style="font-size: 32px;"></i>
          <p>任务处理中，请稍后刷新...</p>
          <p style="font-size: 12px; margin-top: 8px;">
            进度: ${task.progress.processed}/${task.progress.total}
          </p>
        </div>
      `;
      // 自动刷新
      setTimeout(() => viewTask(taskId), 5000);
    } else if (task.status === 'pending') {
      resultsDiv.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-clock" style="font-size: 32px;"></i>
          <p>任务等待中...</p>
        </div>
      `;
    } else {
      resultsDiv.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-inbox" style="font-size: 32px;"></i>
          <p>暂无结果</p>
        </div>
      `;
    }
  } catch (error) {
    infoDiv.innerHTML = `<p>加载失败: ${error.message}</p>`;
  }
}

// ========================================
// 提交任务
// ========================================
async function submitTask() {
  const trademarksText = document.getElementById('trademarks').value.trim();
  const priority = document.getElementById('priority').value;
  
  if (!trademarksText) {
    showToast('请输入商标列表', 'error');
    return;
  }
  
  const trademarks = trademarksText.split('\n').map(t => t.trim()).filter(t => t);
  
  if (trademarks.length === 0) {
    showToast('请输入有效的商标', 'error');
    return;
  }
  
  const resultDiv = document.getElementById('submit-result');
  resultDiv.innerHTML = `
    <div class="result-card">
      <h4><i class="fas fa-spinner fa-spin"></i> 提交中...</h4>
    </div>
  `;
  
  try {
    const data = await apiRequest(`${API_BASE}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ 
        trademarks, 
        priority: parseInt(priority) 
      })
    });
    
    if (data && data.success) {
      resultDiv.innerHTML = `
        <div class="result-card success">
          <h4><i class="fas fa-check-circle"></i> 任务提交成功</h4>
          <p style="margin-top: 12px;">
            <strong>任务ID:</strong> ${data.data.taskId.slice(0, 12)}...<br>
            <strong>商标数量:</strong> ${trademarks.length}<br>
            <strong>预计耗时:</strong> ${data.data.estimatedTime || '计算中...'}
          </p>
        </div>
      `;
      document.getElementById('trademarks').value = '';
      updateTrademarkCount();
      showToast('任务提交成功', 'success');
      
      // 刷新仪表盘
      if (document.getElementById('dashboard-page').classList.contains('hidden') === false) {
        loadDashboard();
      }
    } else {
      resultDiv.innerHTML = `
        <div class="result-card error">
          <h4><i class="fas fa-times-circle"></i> 提交失败</h4>
          <p style="margin-top: 12px;">${data?.error?.message || '未知错误'}</p>
        </div>
      `;
      showToast('提交失败: ' + (data?.error?.message || '未知错误'), 'error');
    }
  } catch (error) {
    resultDiv.innerHTML = `
      <div class="result-card error">
        <h4><i class="fas fa-times-circle"></i> 请求失败</h4>
        <p style="margin-top: 12px;">${error.message}</p>
      </div>
    `;
    showToast('请求失败: ' + error.message, 'error');
  }
}

// 快速添加示例
function addExample(text) {
  const textarea = document.getElementById('trademarks');
  textarea.value = text;
  updateTrademarkCount();
}

// 商标计数
function updateTrademarkCount() {
  const text = document.getElementById('trademarks').value;
  const count = text.split('\n').filter(t => t.trim()).length;
  document.getElementById('trademark-count').textContent = count;
}

// 监听商标输入
document.addEventListener('DOMContentLoaded', function() {
  const textarea = document.getElementById('trademarks');
  if (textarea) {
    textarea.addEventListener('input', updateTrademarkCount);
  }
});

// ========================================
// 导出任务
// ========================================
function exportTask(format) {
  if (!window.currentTaskId) {
    showToast('请先选择任务', 'error');
    return;
  }
  
  window.open(`${API_BASE}/export/${window.currentTaskId}?format=${format}&apiKey=${apiKey}`, '_blank');
  showToast('正在导出...', 'info');
}

// ========================================
// 缓存查询
// ========================================
async function queryCache() {
  const trademark = document.getElementById('cache-trademark').value.trim();
  if (!trademark) {
    showToast('请输入商标名称', 'error');
    return;
  }
  
  const resultDiv = document.getElementById('cache-result');
  resultDiv.innerHTML = `
    <div class="result-card">
      <h4><i class="fas fa-spinner fa-spin"></i> 查询中...</h4>
    </div>
  `;
  
  try {
    const data = await apiRequest(`${API_BASE}/cache/${encodeURIComponent(trademark)}`);
    
    if (!data || !data.success) {
      resultDiv.innerHTML = `
        <div class="result-card error">
          <h4><i class="fas fa-times-circle"></i> 查询失败</h4>
        </div>
      `;
      return;
    }
    
    if (data.data.cached) {
      resultDiv.innerHTML = `
        <div class="result-card success">
          <h4><i class="fas fa-check-circle"></i> 缓存命中</h4>
          <p style="margin-top: 12px;">
            <strong>商标:</strong> ${data.data.trademark}<br>
            <strong>缓存时间:</strong> ${formatTime(data.data.cacheInfo.createdAt)}<br>
            <strong>过期时间:</strong> ${formatTime(data.data.cacheInfo.expiresAt)}<br>
            <strong>命中次数:</strong> ${data.data.cacheInfo.hitCount}<br>
            <strong>总记录数:</strong> ${data.data.data.totalRecords || data.data.data.records?.length || 0}
          </p>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <div class="result-card">
          <h4><i class="fas fa-info-circle"></i> 未找到缓存</h4>
          <p style="margin-top: 12px;">点击"强制刷新"从WIPO获取最新数据</p>
        </div>
      `;
    }
  } catch (error) {
    resultDiv.innerHTML = `
      <div class="result-card error">
        <h4><i class="fas fa-times-circle"></i> 查询失败</h4>
        <p style="margin-top: 12px;">${error.message}</p>
      </div>
    `;
  }
}

// 强制刷新缓存
async function forceRefresh() {
  const trademark = document.getElementById('cache-trademark').value.trim();
  if (!trademark) {
    showToast('请输入商标名称', 'error');
    return;
  }
  
  const resultDiv = document.getElementById('cache-result');
  resultDiv.innerHTML = `
    <div class="result-card">
      <h4><i class="fas fa-bolt"></i> 正在刷新...</h4>
    </div>
  `;
  
  try {
    const data = await apiRequest(`${API_BASE}/cache/${encodeURIComponent(trademark)}?forceRefresh=true`);
    
    if (!data || !data.success) {
      resultDiv.innerHTML = `
        <div class="result-card error">
          <h4><i class="fas fa-times-circle"></i> 刷新失败</h4>
        </div>
      `;
      return;
    }
    
    resultDiv.innerHTML = `
      <div class="result-card success">
        <h4><i class="fas fa-check-circle"></i> 刷新已启动</h4>
        <p style="margin-top: 12px;">
          <strong>任务ID:</strong> ${data.data.taskId}
        </p>
        <p>请在任务列表中查看进度</p>
      </div>
    `;
    showToast('刷新任务已启动', 'success');
  } catch (error) {
    resultDiv.innerHTML = `
      <div class="result-card error">
        <h4><i class="fas fa-times-circle"></i> 刷新失败</h4>
        <p style="margin-top: 12px;">${error.message}</p>
      </div>
    `;
  }
}

// ========================================
// 轮询
// ========================================
function startPolling() {
  if (pollingInterval) return;
  
  pollingInterval = setInterval(async () => {
    // 更新任务列表
    const data = await apiRequest(`${API_BASE}/tasks?limit=100`);
    if (data && data.success) {
      // 更新统计卡片
      const stats = { pending: 0, processing: 0, completed: 0, failed: 0 };
      data.data.tasks.forEach(task => {
        if (stats[task.status] !== undefined) stats[task.status]++;
      });
      
      document.getElementById('stat-pending').textContent = stats.pending;
      document.getElementById('stat-processing').textContent = stats.processing;
      document.getElementById('stat-completed').textContent = stats.completed;
      document.getElementById('stat-failed').textContent = stats.failed;
      
      // 更新图表
      renderStatusChart(stats);
      renderTrendChart(data.data.tasks);
      
      // 更新最近任务
      renderRecentTasks(data.data.tasks.slice(0, 5));
    }
  }, 10000); // 每10秒刷新
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// ========================================
// Toast 通知
// ========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    info: 'fa-info-circle'
  };
  
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <i class="fas fa-times"></i>
    </button>
  `;
  
  container.appendChild(toast);
  
  // 3秒后自动移除
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 3000);
}

// ========================================
// 辅助函数
// ========================================
function getStatusText(status) {
  const map = {
    pending: '等待中',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  };
  return map[status] || status;
}

function calculateProgress(progress) {
  if (!progress || progress.total === 0) return 0;
  return Math.round((progress.processed / progress.total) * 100);
}

function formatTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
