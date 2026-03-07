const API_BASE = 'http://95.134.250.48:3000/api/v1';
const API_KEY = 'logotestkey';
const HEALTH_URL = 'http://95.134.250.48:3000/health';

class WipoAPI {
    async request(endpoint, options = {}) {
        let url = `${API_BASE}${endpoint}`;
        
        // Add API key as query parameter
        const separator = url.includes('?') ? '&' : '?';
        url += `${separator}apiKey=${API_KEY}`;
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        console.log('[API] Requesting:', url);
        
        try {
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) {
                const text = await response.text();
                console.error('[API] Error response:', text);
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('[API] Error:', error);
            throw error;
        }
    }

    async getTasks(status = 'all', limit = 50) {
        const params = new URLSearchParams({ status, limit });
        return this.request(`/tasks?${params.toString()}`);
    }

    async getTask(taskId) {
        return this.request(`/tasks/${taskId}`);
    }

    async submitTask(trademarks) {
        let trademarkList;
        if (Array.isArray(trademarks)) {
            trademarkList = trademarks.map(t => t.trim()).filter(t => t);
        } else {
            trademarkList = trademarks.split(',').map(t => t.trim()).filter(t => t);
        }
        return this.request('/tasks', {
            method: 'POST',
            body: JSON.stringify({ trademarks: trademarkList })
        });
    }

    async extractFromExcel(fileContent, fileName) {
        return this.request('/extract/excel', {
            method: 'POST',
            body: JSON.stringify({ fileContent, fileName })
        });
    }

    async extractFromData(data, fileName) {
        return this.request('/extract/data', {
            method: 'POST',
            body: JSON.stringify({ data, fileName })
        });
    }

    async startTask(taskId) {
        return this.request(`/tasks/${taskId}/start`, { method: 'POST' });
    }

    async pauseTask(taskId) {
        return this.request(`/tasks/${taskId}/pause`, { method: 'POST' });
    }

    async deleteTask(taskId) {
        return this.request(`/tasks/${taskId}/delete`, { method: 'DELETE' });
    }

    async health() {
        try {
            const response = await fetch(HEALTH_URL);
            const data = await response.json();
            return data.status === 'healthy';
        } catch {
            return false;
        }
    }

    pollTask(taskId, onUpdate, interval = 5000) {
        let currentInterval = interval;
        let timeoutId = null;
        let isRunning = true;
        
        const poll = async () => {
            if (!isRunning) return;
            
            try {
                const task = await this.getTask(taskId);
                onUpdate(task);
                
                // Continue polling if not completed
                if (task.status === 'processing' || task.status === 'pending') {
                    timeoutId = setTimeout(poll, currentInterval);
                }
            } catch (error) {
                console.error('Poll error:', error);
                // Exponential backoff on error
                currentInterval = Math.min(currentInterval * 2, 60000);
                timeoutId = setTimeout(poll, currentInterval);
            }
        };
        
        // Start polling
        poll();
        
        // Return cleanup function
        return () => {
            isRunning = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }
}

const api = new WipoAPI();
