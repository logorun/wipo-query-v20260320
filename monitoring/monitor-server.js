#!/usr/bin/env node
/**
 * WIPO Production Monitor Server
 * Serves monitoring dashboard and provides REAL status APIs
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { exec } = require('child_process');

const PORT = process.env.MONITOR_PORT || 8081;

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json'
};

// Get PM2 status (REAL)
function getPM2Status() {
    try {
        const output = execSync('pm2 jlist', { encoding: 'utf-8', timeout: 5000 });
        const processes = JSON.parse(output);
        
        return processes
            .filter(p => p.name.includes('wipo'))
            .map(p => ({
                name: p.name,
                pm_id: p.pm_id,
                status: p.pm2_env.status,
                cpu: p.monit.cpu,
                memory: Math.round(p.monit.memory / 1024 / 1024),
                uptime: Math.round((Date.now() - p.pm2_env.pm_uptime) / 1000),
                restarts: p.pm2_env.restart_time
            }));
    } catch (error) {
        console.error('PM2 status error:', error.message);
        return { error: error.message };
    }
}

// Get system resources (REAL)
function getSystemResources() {
    try {
        // Memory
        const memInfo = fs.readFileSync('/proc/meminfo', 'utf-8');
        const memTotal = parseInt(memInfo.match(/MemTotal:\s+(\d+)/)[1]);
        const memAvailable = parseInt(memInfo.match(/MemAvailable:\s+(\d+)/)[1]);
        const memUsed = memTotal - memAvailable;
        
        // CPU load
        const loadAvg = fs.readFileSync('/proc/loadavg', 'utf-8').split(' ');
        const cpuLoad = parseFloat(loadAvg[0]);
        
        // Disk
        const dfOutput = execSync('df -h /', { encoding: 'utf-8', timeout: 5000 });
        const diskLine = dfOutput.split('\n')[1].split(/\s+/);
        const diskPercent = parseInt(diskLine[4]);
        
        // CPU usage (more accurate)
        const cpuInfo = fs.readFileSync('/proc/stat', 'utf-8');
        const cpuLine = cpuInfo.split('\n')[0].split(/\s+/);
        const idle = parseInt(cpuLine[4]);
        const total = cpuLine.slice(1).reduce((a, b) => parseInt(a) + parseInt(b), 0);
        
        return {
            memory: {
                total: Math.round(memTotal / 1024),
                used: Math.round(memUsed / 1024),
                available: Math.round(memAvailable / 1024),
                percent: Math.round((memUsed / memTotal) * 100)
            },
            cpu: {
                load: cpuLoad,
                cores: require('os').cpus().length,
                usage: Math.round((1 - idle / total) * 100)
            },
            disk: {
                percent: diskPercent
            }
        };
    } catch (error) {
        console.error('System resources error:', error.message);
        return { error: error.message };
    }
}

// Check single proxy connectivity (REAL)
function checkProxy(port) {
    return new Promise((resolve) => {
        const timeout = 3000;
        const start = Date.now();
        
        // Use curl to test SOCKS5 proxy
        const cmd = `curl -s --socks5 23.148.244.2:${port} --connect-timeout 2 https://api.ipify.org/ 2>&1`;
        
        exec(cmd, { timeout }, (error, stdout, stderr) => {
            if (error || stderr || !stdout) {
                resolve({ port, status: 'offline', responseTime: null });
            } else {
                const responseTime = Date.now() - start;
                resolve({ 
                    port, 
                    status: 'online', 
                    ip: stdout.trim(),
                    responseTime 
                });
            }
        });
    });
}

// Get proxy status with REAL connectivity check
async function getProxyStatus() {
    const baseConfig = {
        host: '23.148.244.2',
        portRange: '10000-10252',
        totalProxies: 253,
        strategy: 'round-robin',
        whitelist: ['216.116.160.78']
    };
    
    try {
        // Check 3proxy service on proxy VM
        const checkCmd = `ssh -p 30022 -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@23.148.244.2 "systemctl is-active 3proxy" 2>&1`;
        const serviceStatus = execSync(checkCmd, { encoding: 'utf-8', timeout: 10000 }).trim();
        
        // Test a few random proxies (quick check)
        const testPorts = [10000, 10100, 10200];
        const proxyTests = await Promise.all(testPorts.map(port => checkProxy(port)));
        const onlineCount = proxyTests.filter(p => p.status === 'online').length;
        
        return {
            ...baseConfig,
            serviceStatus: serviceStatus,
            status: serviceStatus === 'active' && onlineCount > 0 ? 'online' : 'degraded',
            testedProxies: proxyTests,
            availableProxies: onlineCount > 0 ? 253 : 0 // Assume all available if service is running
        };
    } catch (error) {
        console.error('Proxy status error:', error.message);
        return {
            ...baseConfig,
            status: 'unknown',
            error: error.message
        };
    }
}

// Get queue status from Redis (REAL)
function getQueueStatus() {
    try {
        // Check Redis connection
        const redisPing = execSync('redis-cli ping', { encoding: 'utf-8', timeout: 5000 }).trim();
        
        if (redisPing !== 'PONG') {
            return { error: 'Redis not responding', status: 'offline' };
        }
        
        // Get queue lengths
        const bullQueueKeys = execSync('redis-cli keys "bull:wipo:*"', { encoding: 'utf-8', timeout: 5000 }).trim();
        const keys = bullQueueKeys.split('\n').filter(k => k);
        
        // Get counts from different queue lists
        let waiting = 0, active = 0, completed = 0, failed = 0;
        
        try {
            waiting = parseInt(execSync('redis-cli llen "bull:wipo:wait"', { encoding: 'utf-8', timeout: 5000 }).trim()) || 0;
        } catch (e) {}
        
        try {
            active = parseInt(execSync('redis-cli llen "bull:wipo:active"', { encoding: 'utf-8', timeout: 5000 }).trim()) || 0;
        } catch (e) {}
        
        try {
            completed = parseInt(execSync('redis-cli zcard "bull:wipo:completed"', { encoding: 'utf-8', timeout: 5000 }).trim()) || 0;
        } catch (e) {}
        
        try {
            failed = parseInt(execSync('redis-cli zcard "bull:wipo:failed"', { encoding: 'utf-8', timeout: 5000 }).trim()) || 0;
        } catch (e) {}
        
        return {
            status: 'online',
            waiting,
            active,
            completed,
            failed,
            total: waiting + active + completed + failed
        };
    } catch (error) {
        console.error('Queue status error:', error.message);
        return { 
            status: 'error',
            error: error.message,
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            total: 0
        };
    }
}

// Get task statistics from database (REAL)
function getTaskStats() {
    try {
        const dbPath = '/home/projects/wipo-query-v20260320/api/data/api.db';
        if (!fs.existsSync(dbPath)) {
            return { error: 'Database not found' };
        }
        
        // Use sqlite3 to query
        const cmd = `sqlite3 ${dbPath} "SELECT status, COUNT(*) as count FROM tasks GROUP BY status;"`;
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
        
        const stats = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            total: 0
        };
        
        if (output) {
            output.split('\n').forEach(line => {
                const [status, count] = line.split('|');
                const num = parseInt(count) || 0;
                stats.total += num;
                
                if (status === 'pending') stats.pending = num;
                else if (status === 'processing') stats.processing = num;
                else if (status === 'completed') stats.completed = num;
                else if (status === 'failed') stats.failed = num;
            });
        }
        
        return stats;
    } catch (error) {
        console.error('Task stats error:', error.message);
        return { error: error.message };
    }
}

// Server
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Main status endpoint
    if (url.pathname === '/api/status') {
        try {
            const proxyStatus = await getProxyStatus();
            
            res.writeHead(200);
            res.end(JSON.stringify({
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                pm2: getPM2Status(),
                system: getSystemResources(),
                proxy: proxyStatus,
                queue: getQueueStatus(),
                tasks: getTaskStats()
            }, null, 2));
        } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }
    
    // Individual endpoints
    if (url.pathname === '/api/pm2') {
        res.writeHead(200);
        res.end(JSON.stringify(getPM2Status(), null, 2));
        return;
    }
    
    if (url.pathname === '/api/system') {
        res.writeHead(200);
        res.end(JSON.stringify(getSystemResources(), null, 2));
        return;
    }
    
    if (url.pathname === '/api/proxy') {
        const proxyStatus = await getProxyStatus();
        res.writeHead(200);
        res.end(JSON.stringify(proxyStatus, null, 2));
        return;
    }
    
    if (url.pathname === '/api/queue') {
        res.writeHead(200);
        res.end(JSON.stringify(getQueueStatus(), null, 2));
        return;
    }
    
    if (url.pathname === '/api/tasks') {
        res.writeHead(200);
        res.end(JSON.stringify(getTaskStats(), null, 2));
        return;
    }
    
    // Serve dashboard
    if (url.pathname === '/' || url.pathname === '/index.html') {
        const dashboardPath = path.join(__dirname, 'monitor-dashboard.html');
        fs.readFile(dashboardPath, (err, data) => {
            if (err) {
                res.setHeader('Content-Type', 'text/plain');
                res.writeHead(500);
                res.end('Error loading dashboard');
                return;
            }
            res.setHeader('Content-Type', 'text/html');
            res.writeHead(200);
            res.end(data);
        });
        return;
    }
    
    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
    console.log(`📊 WIPO Monitor Server running on http://localhost:${PORT}`);
    console.log(`   Dashboard: http://localhost:${PORT}/`);
    console.log(`   Status API: http://localhost:${PORT}/api/status`);
    console.log(`   PM2 API: http://localhost:${PORT}/api/pm2`);
    console.log(`   System API: http://localhost:${PORT}/api/system`);
    console.log(`   Queue API: http://localhost:${PORT}/api/queue`);
    console.log(`   Tasks API: http://localhost:${PORT}/api/tasks`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down monitor server...');
    server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
    console.log('Shutting down monitor server...');
    server.close(() => process.exit(0));
});
