#!/bin/bash
# Redis Setup Script for WIPO Trademark Batch
# Configures and starts Redis with persistence enabled

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REDIS_CONF="$PROJECT_DIR/redis.conf"
REDIS_DIR="$PROJECT_DIR"
DATA_DIR="$PROJECT_DIR/data"
LOG_DIR="$PROJECT_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Redis is installed
check_redis_installed() {
    if ! command -v redis-server &> /dev/null; then
        log_error "Redis is not installed. Installing..."
        install_redis
    else
        log_info "Redis is installed: $(redis-server --version)"
    fi
}

# Install Redis (Debian/Ubuntu)
install_redis() {
    apt-get update
    apt-get install -y redis-server
}

# Create required directories
setup_directories() {
    log_info "Creating required directories..."
    mkdir -p "$DATA_DIR"
    mkdir -p "$LOG_DIR"
    chmod 755 "$DATA_DIR" "$LOG_DIR"
}

# Start Redis with custom config
start_redis() {
    log_info "Starting Redis with persistence configuration..."
    
    # Check if Redis is already running
    if redis-cli ping &> /dev/null; then
        log_warn "Redis is already running!"
        return 0
    fi
    
    cd "$REDIS_DIR"
    redis-server "$REDIS_CONF" --daemonize yes
    
    # Wait for Redis to start
    sleep 2
    
    if redis-cli ping &> /dev/null; then
        log_info "Redis started successfully!"
        
        # Verify persistence is enabled
        if redis-cli CONFIG GET appendonly | grep -q "yes"; then
            log_info "AOF persistence is enabled"
        else
            log_warn "AOF persistence is NOT enabled!"
        fi
        
        if redis-cli CONFIG GET save | grep -q "900"; then
            log_info "RDB persistence is configured"
        fi
        
        echo ""
        log_info "Redis info:"
        echo "  - Host: localhost"
        echo "  - Port: 6379"
        echo "  - Data dir: $DATA_DIR"
        echo "  - Log dir: $LOG_DIR"
        echo "  - Persistence: RDB + AOF (everysec)"
        echo "  - Max memory: 256MB (allkeys-lru)"
    else
        log_error "Failed to start Redis. Check log: $LOG_DIR/redis.log"
        exit 1
    fi
}

# Stop Redis
stop_redis() {
    log_info "Stopping Redis..."
    if redis-cli shutdown 2>/dev/null; then
        log_info "Redis stopped"
    else
        log_warn "Redis was not running"
    fi
}

# Setup systemd service (optional)
setup_systemd_service() {
    log_info "Setting up systemd service..."
    
    SERVICE_FILE="/etc/systemd/system/wipo-redis.service"
    
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=WIPO Redis Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$REDIS_DIR
ExecStart=/usr/bin/redis-server $REDIS_CONF
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable wipo-redis.service
    log_info "Systemd service created: wipo-redis"
}

# Main
case "${1:-start}" in
    start)
        check_redis_installed
        setup_directories
        start_redis
        ;;
    stop)
        stop_redis
        ;;
    restart)
        stop_redis
        sleep 1
        start_redis
        ;;
    install)
        install_redis
        ;;
    systemd)
        setup_systemd_service
        echo "Usage: $0 {start|stop|restart|install|systemd}"
        exit 1
        ;;
    *)
        ;;
esac
