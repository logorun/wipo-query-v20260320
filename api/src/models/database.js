const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');
const DatabaseMigration = require('../utils/migration');
const { Logger } = require('../utils/logger');
const { DatabaseError } = require('../utils/errors');

const logger = new Logger('database');

// 连接状态
const connectionState = {
  isConnected: false,
  lastError: null,
  lastHealthCheck: null,
  queryCount: 0,
  errorCount: 0
};

// 确保数据目录存在
const dataDir = path.dirname(config.database.path);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new sqlite3.Database(config.database.path, (err) => {
  if (err) {
    logger.error('Failed to open database', { error: err.message });
    connectionState.lastError = err.message;
  } else {
    logger.info('Database connected', { path: config.database.path });
    connectionState.isConnected = true;
  }
});

// 启用外键约束
db.run('PRAGMA foreign_keys = ON');

// 性能优化设置
db.run('PRAGMA journal_mode = WAL');      // 使用 WAL 模式提高并发性能
db.run('PRAGMA synchronous = NORMAL');    // 平衡性能和安全性
db.run('PRAGMA cache_size = 10000');      // 增加缓存大小

/**
 * 健康检查
 */
const healthCheck = async () => {
  try {
    await run('SELECT 1');
    connectionState.lastHealthCheck = new Date().toISOString();
    connectionState.isConnected = true;
    return {
      healthy: true,
      state: connectionState
    };
  } catch (error) {
    connectionState.isConnected = false;
    connectionState.lastError = error.message;
    return {
      healthy: false,
      error: error.message,
      state: connectionState
    };
  }
};

/**
 * 包装查询方法，添加错误处理和指标
 */
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    connectionState.queryCount++;
    
    db.run(sql, params, function(err) {
      if (err) {
        connectionState.errorCount++;
        logger.error('Database run error', { sql, error: err.message });
        reject(new DatabaseError(err.message, { sql, code: err.code }));
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    connectionState.queryCount++;
    
    db.get(sql, params, (err, row) => {
      if (err) {
        connectionState.errorCount++;
        logger.error('Database get error', { sql, error: err.message });
        reject(new DatabaseError(err.message, { sql, code: err.code }));
      } else {
        resolve(row);
      }
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    connectionState.queryCount++;
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        connectionState.errorCount++;
        logger.error('Database all error', { sql, error: err.message });
        reject(new DatabaseError(err.message, { sql, code: err.code }));
      } else {
        resolve(rows);
      }
    });
  });
};

/**
 * 事务支持
 */
const transaction = async (operations) => {
  try {
    await run('BEGIN TRANSACTION');
    const result = await operations();
    await run('COMMIT');
    return result;
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
};

// 初始化数据库（使用迁移）
const initDB = async () => {
  try {
    const migration = new DatabaseMigration(db);
    await migration.migrate();
    logger.info('✅ Database initialized');
    
    // 执行健康检查
    await healthCheck();
  } catch (error) {
    logger.error('Failed to initialize database', { error: error.message });
    throw error;
  }
};

// 任务相关操作
const taskDB = {
  create: async (task) => {
    const { id, trademarks, status, priority, callbackUrl, userId, orgId, planType } = task;
    
    try {
      const result = await run(`
        INSERT INTO tasks (id, trademarks, status, priority, callback_url, progress_total, user_id, org_id, plan_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, 
        JSON.stringify(trademarks), 
        status, 
        priority, 
        callbackUrl || null, 
        trademarks.length,
        userId || null,
        orgId || null,
        planType || 'free'
      ]);
      
      logger.debug('Task created', { id, trademarkCount: trademarks.length });
      return { id, ...task };
    } catch (error) {
      logger.error('Failed to create task', { id, error: error.message });
      throw error;
    }
  },

  getById: async (id) => {
    try {
      const row = await get('SELECT * FROM tasks WHERE id = ?', [id]);
      
      if (row) {
        row.trademarks = JSON.parse(row.trademarks);
        row.results = row.results ? JSON.parse(row.results) : null;
      }
      
      return row;
    } catch (error) {
      logger.error('Failed to get task', { id, error: error.message });
      throw error;
    }
  },

  updateStatus: async (id, status, data = {}) => {
    try {
      const fields = ['status = ?'];
      const values = [status];

      if (data.startedAt) {
        fields.push('started_at = ?');
        values.push(data.startedAt);
      }
      if (data.completedAt) {
        fields.push('completed_at = ?');
        values.push(data.completedAt);
      }
      if (data.progress) {
        fields.push('progress_processed = ?', 'progress_failed = ?');
        values.push(data.progress.processed, data.progress.failed);
      }
      if (data.results) {
        fields.push('results = ?');
        values.push(JSON.stringify(data.results));
      }
      if (data.error) {
        fields.push('error = ?');
        values.push(data.error);
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const sql = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`;
      const result = await run(sql, values);
      
      logger.debug('Task status updated', { id, status, changes: result.changes });
      return { id, status, ...data };
    } catch (error) {
      logger.error('Failed to update task status', { id, error: error.message });
      throw error;
    }
  },

  list: async (options = {}) => {
    try {
      const { status, limit = 20, offset = 0 } = options;
      let sql = 'SELECT * FROM tasks';
      const params = [];

      if (status && status !== 'all') {
        sql += ' WHERE status = ?';
        params.push(status);
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const rows = await all(sql, params);
      
      rows.forEach(row => {
        row.trademarks = JSON.parse(row.trademarks);
        row.results = row.results ? JSON.parse(row.results) : null;
      });
      
      return rows;
    } catch (error) {
      logger.error('Failed to list tasks', { error: error.message });
      throw error;
    }
  },

  getStats: async () => {
    try {
      const rows = await all(`
        SELECT status, COUNT(*) as count 
        FROM tasks 
        GROUP BY status
      `);
      
      const stats = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
      rows.forEach(row => {
        stats[row.status] = row.count;
        stats.total += row.count;
      });
      
      return stats;
    } catch (error) {
      logger.error('Failed to get task stats', { error: error.message });
      throw error;
    }
  },

  /**
   * 获取过期的待处理任务（可能卡死的任务）
   */
  getStaleTasks: async (olderThanMinutes = 30) => {
    try {
      const rows = await all(`
        SELECT * FROM tasks 
        WHERE status = 'processing' 
        AND datetime(updated_at) < datetime('now', '-${olderThanMinutes} minutes')
      `);
      
      rows.forEach(row => {
        row.trademarks = JSON.parse(row.trademarks);
      });
      
      return rows;
    } catch (error) {
      logger.error('Failed to get stale tasks', { error: error.message });
      return [];
    }
  },

  /**
   * 标记任务为失败
   */
  markFailed: async (id, error) => {
    try {
      await run(`
        UPDATE tasks 
        SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [error, id]);
      
      logger.info('Task marked as failed', { id, error });
    } catch (err) {
      logger.error('Failed to mark task as failed', { id, error: err.message });
    }
  }
};

// 缓存相关操作
const cacheDB = {
  get: async (trademark) => {
    try {
      const row = await get(
        'SELECT * FROM cache WHERE trademark = ? AND expires_at > datetime("now")', 
        [trademark]
      );
      
      if (row) {
        row.data = JSON.parse(row.data);
        // 异步更新命中计数
        run('UPDATE cache SET hit_count = hit_count + 1 WHERE trademark = ?', [trademark])
          .catch(err => logger.debug('Failed to update hit count', { error: err.message }));
      }
      
      return row;
    } catch (error) {
      logger.error('Failed to get cache', { trademark, error: error.message });
      return null;
    }
  },

  set: async (trademark, data, ttlHours = config.cache.ttlHours) => {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ttlHours);

      await run(`
        INSERT INTO cache (trademark, data, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(trademark) DO UPDATE SET
          data = excluded.data,
          updated_at = CURRENT_TIMESTAMP,
          expires_at = excluded.expires_at,
          hit_count = 0
      `, [trademark, JSON.stringify(data), expiresAt.toISOString()]);
      
      logger.debug('Cache set', { trademark, ttlHours });
      return { trademark, expiresAt };
    } catch (error) {
      logger.error('Failed to set cache', { trademark, error: error.message });
      throw error;
    }
  },

  delete: async (trademark) => {
    try {
      const result = await run('DELETE FROM cache WHERE trademark = ?', [trademark]);
      logger.debug('Cache deleted', { trademark, deleted: result.changes > 0 });
      return { deleted: result.changes > 0 };
    } catch (error) {
      logger.error('Failed to delete cache', { trademark, error: error.message });
      throw error;
    }
  },

  clearExpired: async () => {
    try {
      const result = await run('DELETE FROM cache WHERE expires_at <= datetime("now")');
      logger.info('Expired cache cleared', { deleted: result.changes });
      return { deleted: result.changes };
    } catch (error) {
      logger.error('Failed to clear expired cache', { error: error.message });
      throw error;
    }
  },

  /**
   * 获取缓存统计
   */
  getStats: async () => {
    try {
      const [total, expired, hitStats] = await Promise.all([
        all('SELECT COUNT(*) as count FROM cache'),
        all('SELECT COUNT(*) as count FROM cache WHERE expires_at <= datetime("now")'),
        all('SELECT AVG(hit_count) as avg_hits, MAX(hit_count) as max_hits FROM cache')
      ]);
      
      return {
        total: total[0]?.count || 0,
        expired: expired[0]?.count || 0,
        avgHits: Math.round(hitStats[0]?.avg_hits || 0),
        maxHits: hitStats[0]?.max_hits || 0
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error: error.message });
      return { total: 0, expired: 0, avgHits: 0, maxHits: 0 };
    }
  }
};

module.exports = { 
  db, 
  initDB, 
  taskDB, 
  cacheDB, 
  healthCheck, 
  connectionState,
  run,
  get,
  all,
  transaction
};
