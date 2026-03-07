class DashboardCharts {
    constructor() {
        this.statusChart = null;
        this.dailyChart = null;
    }

    renderStatusChart(tasks) {
        const canvas = document.getElementById('statusChart');
        const ctx = canvas.getContext('2d');
        const counts = {
            completed: tasks.filter(t => t.status === 'completed').length,
            processing: tasks.filter(t => t.status === 'processing').length,
            pending: tasks.filter(t => t.status === 'pending').length,
            failed: tasks.filter(t => t.status === 'failed').length
        };
        if (this.statusChart) this.statusChart.destroy();
        this.statusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['已完成', '处理中', '待处理', '失败'],
                datasets: [{
                    data: [counts.completed, counts.processing, counts.pending, counts.failed],
                    backgroundColor: ['#4ade80', '#3b82f6', '#facc15', '#f87171'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        position: 'bottom', 
                        labels: { color: '#94a3b8', padding: 15 } 
                    } 
                }
            }
        });
    }

    renderDailyChart(tasks) {
        const canvas = document.getElementById('dailyChart');
        const ctx = canvas.getContext('2d');
        const dailyData = {};
        tasks.forEach(task => {
            const date = new Date(task.createdAt).toLocaleDateString('zh-CN');
            dailyData[date] = (dailyData[date] || 0) + 1;
        });
        const sortedDates = Object.keys(dailyData).sort().slice(-7);
        if (this.dailyChart) this.dailyChart.destroy();
        this.dailyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedDates,
                datasets: [{
                    label: '查询量',
                    data: sortedDates.map(d => dailyData[d]),
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: '#3b82f6',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        });
    }
}

const charts = new DashboardCharts();
