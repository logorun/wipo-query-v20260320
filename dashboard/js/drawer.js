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
      const response = await api.getTask(taskId);
      const task = response.data || response;
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

    this.cleanup = api.pollTask(taskId, (response) => {
      const task = response.data || response;
      this.updateUI(task);
    }, 3000);
  }

  updateUI(task) {
    this.elements.taskId.textContent = `任务ID: ${task.id}`;

    const statusConfig = {
      pending: { text: '待处理', class: 'bg-yellow-500/20 text-yellow-400' },
      processing: { text: '处理中', class: 'bg-blue-500/20 text-blue-400' },
      completed: { text: '已完成', class: 'bg-green-500/20 text-green-400' },
      failed: { text: '失败', class: 'bg-red-500/20 text-red-400' },
      paused: { text: '已暂停', class: 'bg-orange-500/20 text-orange-400' },
      cancelled: { text: '已取消', class: 'bg-slate-500/20 text-slate-400' }
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

    this.updateLogs(processingStatus, task.trademarks || [], task.results || []);

    if (task.results && task.results.length > 0) {
      this.updateResults(task.results);
    }
  }

  updateLogs(processingStatus, trademarks, results) {
    if (!trademarks || trademarks.length === 0) {
      this.elements.logs.innerHTML = '<p class="text-slate-500 text-center py-8">暂无日志</p>';
      return;
    }

    const queryStatusMap = {};
    if (results && results.length > 0) {
      results.forEach(result => {
        const tm = result.trademark || result.brandName;
        if (tm) {
          queryStatusMap[tm] = result.queryStatus;
        }
      });
    }

    const logsHtml = trademarks.map((trademark) => {
      const processingState = processingStatus[trademark] || 'pending';
      const queryState = queryStatusMap[trademark];
      
      let displayStatus, displayText, statusColor;
      
      if (processingState === 'processing') {
        displayStatus = 'processing';
        displayText = '处理中';
        statusColor = 'text-blue-400';
      } else if (processingState === 'pending') {
        displayStatus = 'pending';
        displayText = '等待中';
        statusColor = 'text-slate-500';
      } else if (processingState === 'completed' || processingState === 'failed') {
        const isError = queryState === 'error' || queryState === 'skipped';
        const isSuccess = queryState === 'found' || queryState === 'not_found';
        
        if (isError) {
          displayStatus = 'failed';
          displayText = '失败';
          statusColor = 'text-red-400';
        } else if (isSuccess) {
          displayStatus = 'success';
          displayText = '成功';
          statusColor = 'text-green-400';
        } else {
          displayStatus = processingState === 'completed' ? 'success' : 'failed';
          displayText = processingState === 'completed' ? '已完成' : '失败';
          statusColor = processingState === 'completed' ? 'text-green-400' : 'text-red-400';
        }
      }

      const statusIcons = {
        success: '<span class="text-green-400">✓</span>',
        failed: '<span class="text-red-400">✗</span>',
        processing: '<span class="text-blue-400 animate-spin">⟳</span>',
        pending: '<span class="text-slate-500">○</span>'
      };

      return `
        <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-800/50">
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 flex items-center justify-center">${statusIcons[displayStatus]}</span>
            <span class="text-slate-300">${trademark}</span>
          </div>
          <span class="text-sm ${statusColor}">${displayText}</span>
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
      const brandName = result.brandName || result.trademark || '未知商标';
      const queryStatus = result.queryStatus || 'error';
      const hasRecords = result.records && result.records.length > 0;
      
      let statusBadge, statusClass;
      if (queryStatus === 'error' || queryStatus === 'skipped') {
        statusBadge = '失败';
        statusClass = 'bg-red-500/20 text-red-400';
      } else if (queryStatus === 'not_found' || !hasRecords) {
        statusBadge = '无结果';
        statusClass = 'bg-yellow-500/20 text-yellow-400';
      } else {
        statusBadge = '成功';
        statusClass = 'bg-green-500/20 text-green-400';
      }

      const logsContent = this.renderResultLogs(result);

      return `
        <div class="border border-slate-700 rounded-lg overflow-hidden">
          <button class="w-full px-4 py-3 bg-slate-800/50 hover:bg-slate-800 transition flex items-center justify-between" onclick="drawer.toggleCard(${index})">
            <div class="flex items-center gap-3">
              <span class="text-slate-400">#${index + 1}</span>
              <span class="text-white font-medium">${brandName}</span>
              <span class="px-2 py-0.5 rounded text-xs ${statusClass}">${statusBadge}</span>
            </div>
            <svg id="card-icon-${index}" class="w-5 h-5 text-slate-400 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          <div id="card-content-${index}" class="hidden px-4 py-3 bg-slate-800/30 border-t border-slate-700">
            ${logsContent}
          </div>
        </div>
      `;
    }).join('');

    this.elements.results.innerHTML = resultsHtml;
  }

  renderResultLogs(result) {
    const parts = [];
    
    if (result.queryTime) {
      parts.push(`<p class="text-slate-300 text-sm"><span class="text-slate-500">查询时间:</span> <span class="text-white">${new Date(result.queryTime).toLocaleString()}</span></p>`);
    }
    
    if (result.queryStatus) {
      parts.push(`<p class="text-slate-300 text-sm"><span class="text-slate-500">查询状态:</span> <span class="text-white">${result.queryStatus}</span></p>`);
    }
    
    if (result.fromCache !== undefined) {
      parts.push(`<p class="text-slate-300 text-sm"><span class="text-slate-500">来自缓存:</span> <span class="text-white">${result.fromCache ? '是' : '否'}</span></p>`);
    }
    
    if (result.records && Array.isArray(result.records)) {
      parts.push(`<p class="text-slate-300 text-sm"><span class="text-slate-500">记录数量:</span> <span class="text-white">${result.records.length}</span></p>`);
    }
    
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
    
    if (result.error) {
      parts.push(`<p class="text-red-400 text-sm mt-2"><span class="text-slate-500">错误信息:</span> ${result.error}</p>`);
    }
    
    if (result.records && result.records.length > 0) {
      const recordPreview = result.records.map((record, i) => 
        `<div class="mt-2 p-2 bg-slate-700/50 rounded text-xs">
          <p class="text-slate-400">记录 #${i + 1}</p>
          ${Object.entries(record).map(([key, value]) => 
            `<p class="text-slate-300"><span class="text-slate-500">${key}:</span> ${typeof value === 'object' ? JSON.stringify(value) : String(value)}</p>`
          ).join('')}
        </div>`
      ).join('');
      parts.push(recordPreview);
    }
    
    return parts.length > 0 ? parts.join('') : '<p class="text-slate-500 text-sm">无详细信息</p>';
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
