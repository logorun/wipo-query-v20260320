# 🚀 快速开始指南

## 1. 安装依赖 (只需一次)

```bash
# 安装 agent-browser (全局)
npm install -g agent-browser

# 进入项目目录
cd projects/wipo-trademark-batch

# 安装项目依赖
npm install
```

## 2. 配置商标列表

编辑 `src/query-trademarks.js`：

```javascript
// 找到这一行，修改为你想查询的商标
const trademarks = [
  '9TRANSPORT',
  'DISNEY',
  'APPLE',
  // 添加更多...
];
```

## 3. 运行查询

```bash
npm start
```

## 4. 查看结果

查询完成后，查看 `output/` 目录：

```bash
ls output/
# trademark-eu-results.csv
# trademark-eu-results.xlsx  <-- 推荐用这个
# trademark-eu-results.json
```

## ⚠️ 常见问题

**Q: 查询中断怎么办？**  
A: 重新运行 `npm start`，会自动继续。

**Q: 想重新查询怎么办？**  
A: 删除缓存 `rm output/query-cache.json`，然后重新运行。

**Q: 为什么有些商标没结果？**  
A: 可能该商标未在欧盟注册，或拼写不同。

## 📞 需要帮助？

1. 查看完整文档: [README.md](README.md)
2. 查看踩坑记录: [docs/lessons-learned.md](docs/lessons-learned.md)

---

**⏱️ 查询时间**: 40 个商标约 15-20 分钟
