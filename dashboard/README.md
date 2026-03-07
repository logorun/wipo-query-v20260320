# WIPO Trademark Dashboard

前端管理界面 for WIPO Trademark Batch API

## 功能

- 📊 实时统计：总任务、已完成、处理中、失败
- 📈 图表：任务状态分布、每日查询量
- 📋 任务列表：查看、筛选、管理任务
- ➕ 提交查询：快速提交新商标查询
- 🔄 自动刷新：每30秒自动更新数据

## 启动

```bash
./start.sh
```

访问 http://localhost:8080

## 依赖

- API Server 运行在 http://localhost:3000
- API Key: logotestkey

## 技术栈

- HTML5 + Tailwind CSS (CDN)
- Vanilla JavaScript
- Chart.js for charts
