#!/bin/bash

# WIPO Brand Database 欧盟商标批量查询工具

set -e

echo "🇪🇺 WIPO Brand Database 欧盟商标批量查询"
echo "=========================================="
echo ""

# 检查 agent-browser 是否安装
if ! command -v agent-browser &> /dev/null; then
    echo "❌ agent-browser 未安装"
    echo "请先运行: npm install -g agent-browser"
    exit 1
fi

echo "✅ agent-browser 已安装"
echo ""

# 检查依赖
echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "   安装依赖..."
    npm install
fi
echo "✅ 依赖已就绪"
echo ""

# 创建输出目录
mkdir -p output

# 检查是否有未完成进度
if [ -f "output/progress.json" ]; then
    echo "⏯️  发现未完成的查询，将从上次位置继续"
    echo ""
fi

# 运行查询
echo "🚀 开始查询..."
echo ""
node src/query-trademarks.js

echo ""
echo "=========================================="
echo "✅ 查询完成!"
echo ""
echo "输出文件:"
echo "  📄 output/trademark-eu-results.csv"
echo "  📊 output/trademark-eu-results.xlsx"
echo "  📋 output/trademark-eu-results.json"
echo ""
echo "缓存文件:"
echo "  💾 output/query-cache.json"
echo ""
if [ -f "output/progress.json" ]; then
    echo "⚠️  注意: 存在未完成的进度文件"
    echo "   如果查询意外中断，下次运行会自动继续"
fi
