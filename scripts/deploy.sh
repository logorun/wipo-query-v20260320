#!/bin/bash
# ==============================================
# WIPO Trademark Batch 一键部署脚本
# ==============================================
# 使用方法: ./scripts/deploy.sh
# ==============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
API_DIR="$PROJECT_DIR/api"

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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 打印分隔线
print_line() {
    echo "=============================================="
}

# 检查是否以 root 运行
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_warn "建议使用 root 用户运行以获得最佳体验"
    fi
}

# 检查系统依赖
check_dependencies() {
    log_step "1/7 检查系统依赖..."
    
    local missing_deps=()
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js")
    else
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt 18 ]; then
            log_error "Node.js 版本过低，需要 >= 18，当前版本: $(node --version)"
            exit 1
        fi
        log_info "Node.js: $(node --version)"
    fi
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    else
        log_info "npm: $(npm --version)"
    fi
    
    # 检查 Redis
    if ! command -v redis-server &> /dev/null; then
        log_warn "Redis 未安装，将尝试安装..."
        install_redis
    else
        log_info "Redis: $(redis-server --version | head -1)"
    fi
    
    # 检查 PM2
    if ! command -v pm2 &> /dev/null; then
        log_warn "PM2 未安装，将尝试安装..."
        install_pm2
    else
        log_info "PM2: $(pm2 --version)"
    fi
    
    # 检查 agent-browser
    if ! command -v agent-browser &> /dev/null; then
        log_warn "agent-browser 未安装，将尝试安装..."
        install_agent_browser
    else
        log_info "agent-browser: 已安装"
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "缺少依赖: ${missing_deps[*]}"
        exit 1
    fi
    
    log_info "系统依赖检查完成 ✓"
}

# 安装 Redis
install_redis() {
    log_info "安装 Redis..."
    apt-get update
    apt-get install -y redis-server
    log_info "Redis 安装完成 ✓"
}

# 安装 PM2
install_pm2() {
    log_info "安装 PM2..."
    npm install -g pm2
    log_info "PM2 安装完成 ✓"
}

# 安装 agent-browser
install_agent_browser() {
    log_info "安装 agent-browser..."
    npm install -g agent-browser
    log_info "agent-browser 安装完成 ✓"
}

# 安装项目依赖
install_dependencies() {
    log_step "2/7 安装项目依赖..."
    
    cd "$PROJECT_DIR"
    
    # 安装主项目依赖
    log_info "安装主项目依赖..."
    if [ -d "node_modules" ]; then
        log_info "主项目依赖已存在，跳过"
    else
        npm install --production
    fi
    
    # 安装 API 依赖
    log_info "安装 API 依赖..."
    cd "$API_DIR"
    if [ -d "node_modules" ]; then
        log_info "API 依赖已存在，跳过"
    else
        npm install
    fi
    
    cd "$PROJECT_DIR"
    log_info "项目依赖安装完成 ✓"
}

# 配置环境变量
setup_env() {
    log_step "3/7 配置环境变量..."
    
    cd "$API_DIR"
    
    # 检查 .env 文件
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            log_info "创建 .env 文件..."
            cp .env.example .env
            log_warn "请编辑 .env 文件配置 API_KEY 等敏感信息!"
        else
            log_error ".env.example 不存在"
            exit 1
        fi
    else
        log_info ".env 文件已存在 ✓"
    fi
    
    # 验证必要的环境变量
    source .env
    
    if [ -z "$API_KEY" ]; then
        log_warn "API_KEY 未设置，使用默认值"
        echo "API_KEY=logotestkey" >> .env
    fi
    
    cd "$PROJECT_DIR"
    log_info "环境变量配置完成 ✓"
}

# 创建必要的目录
setup_directories() {
    log_step "4/7 创建必要目录..."
    
    mkdir -p "$PROJECT_DIR/data"
    mkdir -p "$PROJECT_DIR/logs"
    mkdir -p "$PROJECT_DIR/output"
    mkdir -p "$PROJECT_DIR/data/backup"
    
    log_info "目录创建完成 ✓"
}

# 启动 Redis
start_redis() {
    log_step "5/7 启动 Redis..."
    
    # 检查 Redis 是否已运行
    if redis-cli ping &> /dev/null; then
        log_info "Redis 已在运行 ✓"
    else
        log_info "启动 Redis 服务..."
        bash "$SCRIPT_DIR/setup-redis.sh" start
        
        # 等待 Redis 启动
        sleep 2
        
        if redis-cli ping &> /dev/null; then
            log_info "Redis 启动成功 ✓"
        else
            log_error "Redis 启动失败"
            exit 1
        fi
    fi
    
    # 验证 Redis 配置
    log_info "Redis 配置验证:"
    log_info "  - 持久化 (AOF): $(redis-cli CONFIG GET appendonly | tail -1)"
    log_info "  - 最大内存: $(redis-cli CONFIG GET maxmemory | tail -1)"
}

# 使用 PM2 启动服务
start_services() {
    log_step "6/7 启动服务 (PM2)..."
    
    cd "$PROJECT_DIR"
    
    # 检查 PM2 进程
    if pm2 describe wipo-api &> /dev/null; then
        log_warn "wipo-api 已存在，重新加载..."
        pm2 reload wipo-api
    else
        log_info "启动 API 服务..."
        pm2 start "$API_DIR/ecosystem.config.js"
    fi
    
    # 等待服务启动
    sleep 3
    
    # 显示状态
    log_info "PM2 服务状态:"
    pm2 status
    
    log_info "服务启动完成 ✓"
}

# 健康检查
health_check() {
    log_step "7/7 执行健康检查..."
    
    local max_attempts=10
    local attempt=1
    local api_url="http://localhost:${PORT:-3000}/health"
    
    log_info "检查 API 健康状态..."
    log_info "URL: $api_url"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$api_url" > /dev/null 2>&1; then
            log_info "API 健康检查通过 ✓"
            
            # 显示 API 信息
            echo ""
            log_info "服务信息:"
            echo "  - API 地址: http://localhost:${PORT:-3000}"
            echo "  - API Key: ${API_KEY:-logotestkey}"
            echo "  - Web UI: http://localhost:${PORT:-3000}/"
            echo ""
            
            return 0
        fi
        
        log_warn "等待服务启动... ($attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "健康检查失败，服务可能未正常启动"
    log_warn "查看日志排查问题:"
    echo "  pm2 logs wipo-api"
    echo "  pm2 logs wipo-worker"
    
    return 1
}

# 打印完成信息
print_complete() {
    print_line
    log_info "🎉 部署完成!"
    print_line
    echo ""
    echo "📋 常用命令:"
    echo "  - 查看日志: pm2 logs"
    echo "  - 重启服务: pm2 restart all"
    echo "  - 停止服务: pm2 stop all"
    echo ""
    echo "🌐 访问地址:"
    echo "  - API: http://localhost:${PORT:-3000}"
    echo "  - Web: http://localhost:${PORT:-3000}/"
    echo ""
    echo "📁 重要目录:"
    echo "  - 项目: $PROJECT_DIR"
    echo "  - 日志: $PROJECT_DIR/logs"
    echo "  - 数据: $PROJECT_DIR/data"
    echo ""
}

# 主函数
main() {
    print_line
    log_info "🚀 WIPO Trademark Batch 部署脚本"
    log_info "项目路径: $PROJECT_DIR"
    print_line
    echo ""
    
    # 执行部署步骤
    check_root
    check_dependencies
    install_dependencies
    setup_env
    setup_directories
    start_redis
    start_services
    
    # 健康检查 (可选，失败不退出)
    health_check || true
    
    print_complete
}

# 执行主函数
main "$@"
