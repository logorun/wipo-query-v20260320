const fs = require('fs');
const path = require('path');

/**
 * 数据库迁移管理
 */
class DatabaseMigration {
  constructor(db) {
    this.db = db;
    this.migrationsDir = path.join(__dirname, '../../migrations');
  }

  // 初始化迁移表
  async init() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // 获取已应用的迁移
  async getAppliedMigrations() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT name FROM migrations ORDER BY id', (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.name));
      });
    });
  }

  // 应用迁移
  async migrate() {
    await this.init();
    
    const applied = await this.getAppliedMigrations();
    const migrations = this.loadMigrations().filter(m => !applied.includes(m.name));

    if (migrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📦 Applying ${migrations.length} migration(s)...`);

    for (const migration of migrations) {
      try {
        await this.applyMigration(migration);
        console.log(`  ✅ ${migration.name}`);
      } catch (err) {
        console.error(`  ❌ ${migration.name}:`, err.message);
        throw err;
      }
    }

    console.log('✅ All migrations applied');
  }

  // 加载迁移文件
  loadMigrations() {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    return fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()
      .map(filename => ({
        name: filename,
        sql: fs.readFileSync(path.join(this.migrationsDir, filename), 'utf-8')
      }));
  }

  // 执行单个迁移
  async applyMigration(migration) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.exec('BEGIN TRANSACTION');
        
        this.db.exec(migration.sql, (err) => {
          if (err) {
            this.db.exec('ROLLBACK');
            reject(err);
            return;
          }

          this.db.run(
            'INSERT INTO migrations (name) VALUES (?)',
            [migration.name],
            (err) => {
              if (err) {
                this.db.exec('ROLLBACK');
                reject(err);
              } else {
                this.db.exec('COMMIT');
                resolve();
              }
            }
          );
        });
      });
    });
  }

  // 回滚最后一个迁移
  async rollback() {
    const applied = await this.getAppliedMigrations();
    if (applied.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastMigration = applied[applied.length - 1];
    console.log(`Rolling back: ${lastMigration}`);
    
    // 注意：SQLite 不支持 DROP COLUMN 等复杂回滚
    // 这里只是记录，实际回滚需要手动处理
    console.log('⚠️  Manual rollback required for SQLite');
  }

  // 查看状态
  async status() {
    await this.init();
    const applied = await this.getAppliedMigrations();
    const available = this.loadMigrations().map(m => m.name);

    console.log('\n📊 Migration Status:');
    console.log('===================');
    console.log(`Applied: ${applied.length}`);
    console.log(`Available: ${available.length}`);
    console.log(`Pending: ${available.length - applied.length}`);
    
    if (applied.length > 0) {
      console.log('\n✅ Applied:');
      applied.forEach(m => console.log(`  - ${m}`));
    }

    const pending = available.filter(m => !applied.includes(m));
    if (pending.length > 0) {
      console.log('\n⏳ Pending:');
      pending.forEach(m => console.log(`  - ${m}`));
    }
  }
}

module.exports = DatabaseMigration;
