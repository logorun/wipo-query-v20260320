-- Initial schema creation
-- 001_initial.sql
-- SaaS READY: 预留了 user_id 和 org_id 字段用于多租户

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  trademarks TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  progress_total INTEGER DEFAULT 0,
  progress_processed INTEGER DEFAULT 0,
  progress_failed INTEGER DEFAULT 0,
  results TEXT,
  error TEXT,
  callback_url TEXT,
  -- SaaS 预留字段
  user_id TEXT,              -- 关联 users 表 (未来实现)
  org_id TEXT,               -- 关联 organizations 表 (未来实现)
  plan_type TEXT DEFAULT 'free'  -- free, basic, pro, enterprise
);

-- Cache table (全局缓存，未来可按用户隔离)
CREATE TABLE IF NOT EXISTS cache (
  trademark TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  hit_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);      -- SaaS 预留
CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(org_id);        -- SaaS 预留
CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache(expires_at);

-- SaaS 预留表结构 (注释，未来实现时取消注释)
/*
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'active',  -- active, suspended, deleted
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Organizations table (团队/企业)
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  plan_type TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Organization members
CREATE TABLE organization_members (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',  -- owner, admin, member
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (org_id, user_id)
);

-- Subscription plans
CREATE TABLE subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,          -- free, basic, pro, enterprise
  monthly_queries INTEGER,     -- 每月查询配额
  max_trademarks_per_batch INTEGER,  -- 每批最大商标数
  price_monthly INTEGER,       -- 月费 (分)
  features TEXT                -- JSON 功能列表
);

-- User subscriptions
CREATE TABLE user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',  -- active, cancelled, expired
  started_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Query quotas tracking
CREATE TABLE query_quotas (
  user_id TEXT PRIMARY KEY,
  monthly_limit INTEGER DEFAULT 5,   -- 免费版默认5次
  used_this_month INTEGER DEFAULT 0,
  reset_date DATE,                    -- 每月重置日期
  extra_queries INTEGER DEFAULT 0     -- 额外购买的查询次数
);

-- Saved searches (用户保存的搜索历史)
CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,                          -- 搜索名称
  trademarks TEXT NOT NULL,           -- JSON 商标列表
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Watchlist (监控列表)
CREATE TABLE watchlist (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  trademark TEXT NOT NULL,
  notify_on_change BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
*/
