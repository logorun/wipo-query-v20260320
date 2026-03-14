module.exports = {
  apps: [
    {
      name: 'wipo-dashboard',
      script: './dashboard-server.js',
      cwd: '/home/projects/wipo-query-v20260320',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production'
      },
      log_file: '/home/projects/wipo-query-v20260320/logs/dashboard-combined.log',
      out_file: '/home/projects/wipo-query-v20260320/logs/dashboard-out.log',
      error_file: '/home/projects/wipo-query-v20260320/logs/dashboard-error.log',
      time: true,
      kill_timeout: 3000,
      min_uptime: '10s',
      max_restarts: 5,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'wipo-api',
      script: './src/server.js',
      cwd: '/home/projects/wipo-query-v20260320/api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 8002,
        // Redis Configuration - must match redis.conf
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379
      },
      log_file: '/home/projects/wipo-query-v20260320/logs/api-combined.log',
      out_file: '/home/projects/wipo-query-v20260320/logs/api-out.log',
      error_file: '/home/projects/wipo-query-v20260320/logs/api-error.log',
      time: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      // 健康检查
      health_check_grace_period: 30000,
      // 自动重启配置
      min_uptime: '10s',
      max_restarts: 5,
      // 日志切割
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'wipo-worker',
      script: './worker/queryWorker.js',
      cwd: '/home/projects/wipo-query-v20260320/api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8002
      },
      log_file: '/home/projects/wipo-query-v20260320/logs/worker-combined.log',
      out_file: '/home/projects/wipo-query-v20260320/logs/worker-out.log',
      error_file: '/home/projects/wipo-query-v20260320/logs/worker-error.log',
      time: true,
      kill_timeout: 10000,
      listen_timeout: 30000,
      min_uptime: '10s',
      max_restarts: 5,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
