module.exports = {
  apps: [
    {
      name: 'wipo-api',
      script: './src/server.js',
      cwd: '/root/.openclaw/workspace/projects/wipo-trademark-batch/api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Redis Configuration - must match redis.conf
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379
      },
      log_file: '/root/.openclaw/workspace/projects/wipo-trademark-batch/logs/api-combined.log',
      out_file: '/root/.openclaw/workspace/projects/wipo-trademark-batch/logs/api-out.log',
      error_file: '/root/.openclaw/workspace/projects/wipo-trademark-batch/logs/api-error.log',
      time: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      // 健康检查
      health_check_grace_period: 30000,
      // 自动重启配置
      min_uptime: '10s',
      max_restarts: 5,
      // 日志切割
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // 环境变量文件
      env_file: '/root/.openclaw/workspace/projects/wipo-trademark-batch/api/.env'
    },
    {
      name: 'wipo-worker',
      script: './worker/queryWorker.js',
      cwd: '/root/.openclaw/workspace/projects/wipo-trademark-batch/api',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      log_file: '/root/.openclaw/workspace/projects/wipo-trademark-batch/logs/worker-combined.log',
      out_file: '/root/.openclaw/workspace/projects/wipo-trademark-batch/logs/worker-out.log',
      error_file: '/root/.openclaw/workspace/projects/wipo-trademark-batch/logs/worker-error.log',
      time: true,
      kill_timeout: 10000,
      listen_timeout: 30000,
      min_uptime: '10s',
      max_restarts: 5,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env_file: '/root/.openclaw/workspace/projects/wipo-trademark-batch/api/.env'
    }
  ]
};
