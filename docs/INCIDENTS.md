# 问题记录与故障排查

## 2026-03-04: Worker 查询解析增强失败

### 问题描述
在增强 Worker 的商标查询解析功能时，代码编辑出错导致 Worker 无法启动。

### 具体原因
- 文件：`api/worker/queryWorker.js`
- 错误：重复定义了 `parseDate()` 函数
- 结果：JavaScript 语法错误，进程启动失败

### 错误信息
```
SyntaxError: Unexpected token '}'
```

### 影响范围
- 40商标批量测试任务已提交但无法执行
- 任务ID：`f4671595-74bb-4a78-9d92-a4c50cd3ff25`
- 状态：pending（队列中等待）

### 解决方案
回滚 Git 到稳定版本 `dd9ffda`，放弃本次增强改动。

### 后续计划
1. 使用原始 Worker 版本完成40商标测试
2. 测试通过后，重新正确实现字段提取增强
3. 下次编辑时先提交 Git，避免代码丢失

---

## 如何避免类似问题

1. **编辑前提交**：大改动前先 `git commit`
2. **语法检查**：使用 `node -c file.js` 检查语法
3. **小步提交**：频繁提交，便于回滚
4. **测试再重启**：本地测试通过后再用 PM2 重启

---

## 紧急回滚步骤

```bash
cd projects/wipo-trademark-batch
git log --oneline              # 查看历史提交
git reset --hard <commit-id>   # 回滚到指定版本
pm2 restart all                # 重启服务
```
