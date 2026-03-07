class TaskDrawer {
  constructor() {
    this.drawer = null;
    this.backdrop = null;
    this.isOpen = false;
    this.currentTaskId = null;
    this.cleanup = null;
    this.init();
  }

  init() {
    this.createDrawer();
    this.addEventListeners();
  }

  createDrawer() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-40 opacity-0 transition-opacity duration-300 pointer-events-none';
    this.backdrop.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 40; opacity: 0; transition: opacity 0.3s ease; pointer-events: none;';
    this.backdrop.addEventListener('click', () => this.close());
    document.body.appendChild(this.backdrop);

    this.drawer = document.createElement('div');
    this.drawer.className = 'fixed top-0 right-0 h-full w-full max-w-2xl bg-slate-900 border-l border-slate-700 z-50 transform translate-x-full transition-transform duration-300 ease-out shadow-2xl overflow-hidden flex flex-col';
    this.drawer.innerHTML = `
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/50">
        <div>
          <h2 class="text-xl font-bold text-white">任务详情</h2>
          <p class="text-sm text-slate-400 mt-1" id="drawer-task-id">-</p>
        </div>
        <button id="drawer-close-btn" class="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-white">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <div class="glass rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-white font-semibold">处理进度</h3>
            <span id="drawer-status-badge" class="px-3 py-1 rounded-full text-sm bg-slate-700 text-slate-300">-</span>
          </div>
          <div class="relative">
            <div class="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div id="drawer-progress-bar" class="h-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all duration-500" style="width: 0%"></div>
            </div>
            <div class="flex justify-between mt-2 text-sm text-slate-400">
              <span id="drawer-progress-text">0%</span>
              <span id="drawer-progress-count">0/0</span>
            </div>
          </div>
        </div>

        <div class="glass rounded-xl p-6">
          <h3 class="text-white font-semibold mb-4">处理日志</h3>
          <div id="drawer-logs" class="space-y-2">
            <p class="text-slate-500 text-center py-8">暂无日志</p>
          </div>
        </div>

        <div class="glass rounded-xl p-6">
          <h3 class="text-white font-semibold mb-4">查询结果</h3>
          <div id="drawer-results" class="space-y-3">
            <p class="text-slate-500 text-center py-8">暂无结果</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.drawer);

    this.elements = {
      taskId: this.drawer.querySelector('#drawer-task-id'),
      statusBadge: this.drawer.querySelector('#drawer-status-badge'),
      progressBar: this.drawer.querySelector('#drawer-progress-bar'),
      progressText: this.drawer.querySelector('#drawer-progress-text'),
      progressCount: this.drawer.querySelector('#drawer-progress-count'),
      logs: this.drawer.querySelector('#drawer-logs'),
      results: this.drawer.querySelector('#drawer-results'),
      closeBtn: this.drawer.querySelector('#drawer-close-btn')
    };
  }

  addEventListeners() {
    this.elements.closeBtn.addEventListener('click', () => this.close());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  open(taskId) {
    if (this.isOpen && this.currentTaskId === taskId) return;

    this.currentTaskId = taskId;
    this.isOpen = true;

    this.backdrop.style.opacity = '1';
    this.backdrop.style.pointerEvents = 'auto';

    this.drawer.style.transform = 'translateX(0)';

    this.loadTask(taskId);
    this.startPolling(taskId);
  }

  close() {
    if (!this.isOpen) return;

    this.isOpen = false;

    this.backdrop.style.opacity = '0';
    this.backdrop.style.pointerEvents = 'none';

    this.drawer.style.transform = 'translateX(100%)';

    if (this.cleanup) {
      this.cleanup();
      this.cleanup = null;
    }

    this.currentTaskId = null;
  }

  async loadTask(taskId) {
    try {
      const task = await api.getTask(taskId);
      this.updateUI(task);
    } catch (error) {
      console.error('Failed to load task:', error);
      this.elements.taskId.textContent = '加载失败';
    }
  }

  startPolling(taskId) {
    if (this.cleanup) {
      this.cleanup();
    }

    this.cleanup = api.pollTask(taskId, (task) => {
      this.updateUI(task);
    }, 3000);
  }

  updateUI(task) {
    this.elements.taskId.textContent = `任务ID: ${task.id}`;

    const statusConfig = {
      pending: { text: '待处理', class: 'bg-yellow-500/20 text-yellow-400' },
      processing: { text: '处理中', class: 'bg-blue-500/20 text-blue-400' },
      completed: { text: '已完成', class: 'bg-green-500/20 text-green-400' },
      failed: { text: '失败', class: 'bg-red-500/20 text-red-400' }
    };
    const config = statusConfig[task.status] || statusConfig.pending;
    this.elements.statusBadge.className = `px-3 py-1 rounded-full text-sm ${config.class}`;
    this.elements.statusBadge.textContent = config.text;

    const total = task.trademarks?.length || 0;
    const processingStatus = task.processingStatus || {};
    const completed = Object.values(processingStatus).filter(s => s === 'completed').length;
    const failed = Object.values(processingStatus).filter(s => s === 'failed').length;
    const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

    this.elements.progressBar.style.width = `${progress}%`;
    this.elements.progressText.textContent = `${progress}%`;
    this.elements.progressCount.textContent = `${completed + failed}/${total}`;

    this.updateLogs(processingStatus, task.trademarks || []);

    if (task.results && task.results.length > 0) {
      this.updateResults(task.results);
    }
  }

  updateLogs(processingStatus, trademarks) {
    if (!trademarks || trademarks.length === 0) {
      this.elements.logs.innerHTML = '<p class="text-slate-500 text-center py-8">暂无日志</p>';
      return;
    }

    const logsHtml = trademarks.map((trademark, index) => {
      const status = processingStatus[trademark] || 'pending';
      const statusIcons = {
        completed: '<span class="text-green-400">✓</span>',
        failed: '<span class="text-red-400">✗</span>',
        processing: '<span class="text-blue-400 animate-spin">⟳</span>',
        pending: '<span class="text-slate-500">○</span>'
      };
      const statusText = {
        completed: '已完成',
        failed: '失败',
        processing: '处理中',
        pending: '等待中'
      };

      return `
        <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50">
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 flex items-center justify-center">${statusIcons[status]}</span>
            <span class="text-slate-300">${trademark}</span>
          </div>
          <span class="text-sm ${status === 'completed' ? 'text-green-400' : status === 'failed' ? 'text-red-400' : status === 'processing' ? 'text-blue-400' : 'text-slate-500'}">${statusText[status]}</span>
        </div>
      `;
    }).join('');

    this.elements.logs.innerHTML = logsHtml;
  }

  updateResults(results) {
    if (!results || results.length === 0) {
      this.elements.results.innerHTML = '<p class="text-slate-500 text-center py-8">暂无结果</p>';
      return;
    }

    const resultsHtml = results.map((result, index) => {
      const hasData = result.status === 'success' && result.data;
      const brandName = result.brandName || result.trademark || '未知商标';

      return `
        <div class="border border-slate-700 rounded-lg overflow-hidden">
          <button class="w-full px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition flex items-center justify-between" onclick="drawer.toggleCard(${index})">
            <div class="flex items-center gap-3">
              <span class="text-slate-400">#${index + 1}</span>
              <span class="text-white font-medium">${brandName}</span>
              ${result.status === 'success' 
                ? '<span class="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">成功</span>'
                : '<span class="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">失败</span>'
              }
            </div>
            <svg id="card-icon-${index}" class="w-5 h-5 text-slate-400 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          <div id="card-content-${index}" class="hidden px-4 py-3 bg-slate-800/30 border-t border-slate-700">
            ${hasData ? this.renderResultData(result.data) : `<p class="text-red-400 text-sm">${result.error || '查询失败'}</p>`}
          </div>
        </div>
      `;
    }).join('');

    this.elements.results.innerHTML = resultsHtml;
  }

  renderResultData(data) {
    if (!data) return '<p class="text-slate-500 text-sm">无数据</p>';

    if (data.summary) {
      return `
        <div class="space-y-2 text-sm">
          ${data.summary.total !== undefined ? `<p class="text-slate-300">总记录数: <span class="text-white">${data.summary.total}</span></p>` : ''}
          ${data.summary.exactMatches !== undefined ? `<p class="text-slate-300">完全匹配: <span class="text-white">${data.summary.exactMatches}</span></p>` : ''}
          ${data.summary.similarMatches !== undefined ? `<p class="text-slate-300">相似匹配: <span class="text-white">${data.summary.similarMatches}</span></p>` : ''}
          ${data.summary.status ? `<p class="text-slate-300">状态: <span class="text-white">${data.summary.status}</span></p>` : ''}
        </div>
      `;
    }

    if (data.hits !== undefined) {
      return `<p class="text-slate-300 text-sm">匹配数: <span class="text-white">${data.hits}</span></p>`;
    }

    const entries = Object.entries(data).slice(0, 5);
    return `
      <div class="space-y-1 text-sm">
        ${entries.map(([key, value]) => `
          <p class="text-slate-300"><span class="text-slate-500">${key}:</span> <span class="text-white">${typeof value === 'object' ? JSON.stringify(value).slice(0, 50) : value}</span></p>
        `).join('')}
      </div>
    `;
  }

  toggleCard(index) {
    const content = document.getElementById(`card-content-${index}`);
    const icon = document.getElementById(`card-icon-${index}`);
    
    if (content && icon) {
      const isHidden = content.classList.contains('hidden');
      if (isHidden) {
        content.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
      } else {
        content.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
      }
    }
  }
}

const drawer = new TaskDrawer();
