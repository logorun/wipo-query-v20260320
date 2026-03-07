#!/bin/bash
# ==============================================
# WIPO Trademark Batch 备份脚本
# ==============================================
# 使用方法:
#   ./scripts/backup.sh           交互式备份
#   ./scripts/backup.sh auto      自动备份
#   ./scripts/backup.sh restore   恢复数据
# ==============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/data/backup"
DATA_DIR="$PROJECT_DIR/data"
LOG_DIR="$PROJECT_DIR/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 创建备份目录
init_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$BACKUP_DIR/redis"
    mkdir -p "$BACKUP_DIR/sqlite"
    mkdir -p "$BACKUP_DIR/logs"
}

# 备份 Redis 数据
backup_redis() {
    log_info "备份 Redis 数据..."
    
    # 触发 RDB 快照
    redis-cli BGSAVE
    
    # 等待 SAVE 完成
    sleep 2
    
    # 复制 RDB 文件
    if [ -f "$DATA_DIR/dump.rdb" ]; then
        cp "$DATA_DIR/dump.rdb" "$BACKUP_DIR/redis/dump_${TIMESTAMP}.rdb"
        log_info "Redis RDB 备份完成"
    else
        log_warn "Redis RDB 文件不存在"
    fi
    
    # 复制 AOF 文件
    if [ -f "$DATA_DIR/appendonly.aof" ]; then
        cp "$DATA_DIR/appendonly.aof" "$BACKUP_DIR/redis/appendonly_${TIMESTAMP}.aof"
        log_info "Redis AOF 备份完成"
    fi
}

# 备份 SQLite 数据库
backup_sqlite() {
    log_info "备份 SQLite 数据库..."
    
    if [ -f "$DATA_DIR/trademark.db" ]; then
        # 使用 sqlite3 VACUUM INTO 导出备份
        sqlite3 "$DATA_DIR/trademark.db" "VACUUM INTO '$BACKUP_DIR/sqlite/trademark_${TIMESTAMP}.db';"
        
        # 备份 WAL 和 SHM 文件
        [ -f "$DATA_DIR/trademark.db-wal" ] && cp "$DATA_DIR/trademark.db-wal" "$BACKUP_DIR/sqlite/"
        [ -f "$DATA_DIR/trademark.db-shm" ] && cp "$DATA_DIR/trademark.db-shm" "$BACKUP_DIR/sqlite/"
        
        log_info "SQLite 数据库备份完成"
    else
        log_warn "SQLite 数据库不存在"
    fi
}

# 备份配置文件
backup_config() {
    log_info "备份配置文件..."
    
    # 备份 .env 文件
    if [ -f "$PROJECT_DIR/api/.env" ]; then
        cp "$PROJECT_DIR/api/.env" "$BACKUP_DIR/config_${TIMESTAMP}.env"
        log_info "配置文件备份完成"
    fi
    
    # 备份 redis.conf
    if [ -f "$PROJECT_DIR/redis.conf" ]; then
        cp "$PROJECT_DIR/redis.conf" "$BACKUP_DIR/redis.conf"
        log_info "Redis 配置备份完成"
    fi
}

# 备份日志文件
backup_logs() {
    log_info "备份最近日志..."
    
    # 备份最近 7 天的日志
    find "$LOG_DIR" -name "*.log" -mtime -7 -exec gzip {} \; -exec cp {}.gz "$BACKUP_DIR/logs/" \;
    
    # 保留最近日志文件
    [ -f "$LOG_DIR/redis.log" ] && cp "$LOG_DIR/redis.log" "$BACKUP_DIR/logs/"
    
    log_info "日志备份完成"
}

# 清理旧备份
cleanup_old_backups() {
    log_info "清理旧备份..."
    
    # 保留最近 7 天的备份
    find "$BACKUP_DIR" -type f -mtime +7 -delete
    
    # 保留最近 30 天的 Redis 数据
    find "$BACKUP_DIR/redis" -name "*.rdb" -mtime +30 -delete
    find "$BACKUP_DIR/redis" -name "*.aof" -mtime +30 -delete
    
    # 保留最近 30 天的数据库
    find "$BACKUP_DIR/sqlite" -name "*.db" -mtime +30 -delete
    
    log_info "旧备份清理完成"
}

# 创建备份清单
create_backup_manifest() {
    cat > "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt" << EOF
WIPO Trademark Batch Backup Manifest
=====================================
Backup Date: $(date)
Hostname: $(hostname)
Project: $PROJECT_DIR

Files Included:
---------------
EOF
    
    echo "Redis Data:" >> "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt"
    ls -la "$BACKUP_DIR/redis/" >> "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt" 2>/dev/null || echo "  (none)" >> "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt"
    
    echo "" >> "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt"
    echo "SQLite Database:" >> "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt"
    ls -la "$BACKUP_DIR/sqlite/" >> "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt" 2>/dev/null || echo "  (none)" >> "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt"
    
    echo "" >> "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt"
    echo "Config:" >> "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt"
    ls -la "$BACKUP_DIR"/*.env "$BACKUP_DIR/redis.conf" >> "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt" 2>/dev/null || echo "  (none)" >> "$BACKUP_DIR/backup_manifest_${TIMESTAMP}.txt"
    
    log_info "备份清单已创建"
}

# 执行完整备份
do_backup() {
    log_info "开始备份..."
    log_info "项目目录: $PROJECT_DIR"
    log_info "备份目录: $BACKUP_DIR"
    echo ""
    
    init_backup_dir
    backup_redis
    backup_sqlite
    backup_config
    backup_logs
    cleanup_old_backups
    create_backup_manifest
    
    echo ""
    log_info "✅ 备份完成!"
    log_info "备份位置: $BACKUP_DIR"
    
    # 显示备份大小
    du -sh "$BACKUP_DIR"
}

# 恢复数据
do_restore() {
    echo ""
    log_warn "⚠️  此操作将停止所有服务并恢复数据"
    log_warn "请确保在进行恢复前已停止服务"
    echo ""
    
    read -p "确认继续? (y/n): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "恢复已取消"
        exit 0
    fi
    
    # 列出可用备份
    echo "可用备份:"
    ls -1 "$BACKUP_DIR/redis/" 2>/dev/null | grep -E "\.(rdb|aof)$" || echo "无 Redis 备份"
    ls -1 "$BACKUP_DIR/sqlite/" 2>/dev/null | grep "\.db$" || echo "无 SQLite 备份"
    echo ""
    
    # 选择 Redis 备份
    echo "请选择要恢复的 Redis RDB 文件:"
    select rdb_file in "$BACKUP_DIR/redis/"dump_*.rdb; do
        if [ -n "$rdb_file" ]; then
            log_info "已选择: $rdb_file"
            break
        fi
    done
    
    # 选择 SQLite 备份
    echo "请选择要恢复的 SQLite 数据库:"
    select db_file in "$BACKUP_DIR/sqlite/"trademark_*.db; do
        if [ -n "$db_file" ]; then
            log_info "已选择: $db_file"
            break
        fi
    done
    
    # 停止服务
    log_info "停止服务..."
    pm2 stop all 2>/dev/null || true
    
    # 停止 Redis
    redis-cli shutdown 2>/dev/null || true
    sleep 1
    
    # 恢复 Redis
    if [ -n "$rdb_file" ] && [ -f "$rdb_file" ]; then
        log_info "恢复 Redis 数据..."
        cp "$rdb_file" "$DATA_DIR/dump.rdb"
    fi
    
    # 恢复 SQLite
    if [ -n "$db_file" ] && [ -f "$db_file" ]; then
        log_info "恢复 SQLite 数据库..."
        cp "$db_file" "$DATA_DIR/trademark.db"
    fi
    
    # 启动 Redis
    log_info "启动 Redis..."
    bash "$SCRIPT_DIR/setup-redis.sh" start
    
    # 启动服务
    log_info "启动服务..."
    pm2 start all
    
    log_info "✅ 恢复完成!"
}

# 显示备份状态
show_status() {
    echo ""
    log_info "📊 备份状态"
    echo "============"
    echo ""
    
    echo "备份目录: $BACKUP_DIR"
    echo ""
    
    echo "📁 Redis 备份:"
    ls -lh "$BACKUP_DIR/redis/" 2>/dev/null || echo "  (无备份)"
    echo ""
    
    echo "📁 SQLite 备份:"
    ls -lh "$BACKUP_DIR/sqlite/" 2>/dev/null || echo "  (无备份)"
    echo ""
    
    echo "📁 配置文件:"
    ls -lh "$BACKUP_DIR"/*.env "$BACKUP_DIR/redis.conf" 2>/dev/null || echo "  (无备份)"
    echo ""
    
    # 显示磁盘使用
    echo "💾 磁盘使用:"
    du -sh "$BACKUP_DIR" 2>/dev/null || echo "  0"
    echo ""
}

# 主函数
main() {
    case "${1:-}" in
        auto)
            do_backup
            ;;
        restore)
            do_restore
            ;;
        status)
            show_status
            ;;
        *)
            echo "用法: $0 {auto|restore|status}"
            echo ""
            echo "命令说明:"
            echo "  auto     - 执行自动备份 (无交互)"
            echo "  restore  - 从备份恢复数据"
            echo "  status   - 显示备份状态"
            echo ""
            echo "示例:"
            echo "  $0           # 交互式备份"
            echo "  $0 auto      # 自动备份 (适合 cron)"
            echo "  $0 restore   # 恢复数据"
            echo "  $0 status    # 查看备份状态"
            ;;
    esac
}

main "$@"
