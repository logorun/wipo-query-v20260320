#!/bin/bash
# WIPO 任务查询工具

API_URL="http://localhost:3000/api/v1"
API_KEY="logotestkey"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

case "$1" in
  pending)
    echo -e "${YELLOW}待处理任务:${NC}"
    curl -s "$API_URL/tasks?status=pending" -H "X-API-Key: $API_KEY" | jq -r '.data.tasks[] | "  \(.id) | \(.trademarks | join(", "))"'
    ;;
  processing)
    echo -e "${BLUE}处理中任务:${NC}"
    curl -s "$API_URL/tasks?status=processing" -H "X-API-Key: $API_KEY" | jq -r '.data.tasks[] | "  \(.id) | \(.trademarks | join(", "))"'
    ;;
  completed)
    echo -e "${GREEN}已完成任务:${NC}"
    curl -s "$API_URL/tasks?status=completed&limit=5" -H "X-API-Key: $API_KEY" | jq -r '.data.tasks[] | "  \(.id) | \(.trademarks | join(", ")) | ✅"'
    ;;
  all|"")
    echo -e "${YELLOW}📋 任务队列总览${NC}"
    curl -s "$API_URL/tasks?status=all" -H "X-API-Key: $API_KEY" | jq -r '
      "待处理: \(.data.pending) | 处理中: \(.data.processing) | 已完成: \(.data.completed) | 失败: \(.data.failed)",
      "",
      "最近任务:",
      (.data.tasks[:5] | .[] | "  [\(.status)] \(.id[:8])... | \(.trademarks | join(","))")
    '
    ;;
  *)
    echo "用法: $0 [pending|processing|completed|all]"
    echo "  pending    - 查看待处理任务"
    echo "  processing - 查看处理中任务"
    echo "  completed  - 查看最新已完成任务"
    echo "  all        - 查看所有状态汇总 (默认)"
    ;;
esac
