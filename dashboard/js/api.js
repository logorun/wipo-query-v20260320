const API_BASE = 'https://true-clouds-scream.loca.lt/api/v1';
const API_KEY = 'logotestkey';

class WipoAPI {
    async request(endpoint, options = {}) {
        const url = \`\${API_BASE}\${endpoint}\`;
        const headers = {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            ...options.headers
        };
        try {
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async getTasks(status = 'all', limit = 50) {
        const params = new URLSearchParams({ status, limit });
        return this.request(\`/tasks?\${params}\`);
    }

    async getTask(taskId) {
        return this.request(\`/tasks/\${taskId}\`);
    }

    async submitTask(trademarks) {
        const trademarkList = trademarks.split(',').map(t => t.trim()).filter(t => t);
        return this.request('/tasks', {
            method: 'POST',
            body: JSON.stringify({ trademarks: trademarkList })
        });
    }

    async health() {
        try {
            await this.request('/health');
            return true;
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
