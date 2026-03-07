# WIPO Brand Database 欧盟商标批量查询工具 - 详细使用说明

## 📋 目录

1. [工作原理](#工作原理)
2. [使用步骤](#使用步骤)
3. [配置详解](#配置详解)
4. [输出格式](#输出格式)
5. [故障排除](#故障排除)
6. [进阶用法](#进阶用法)

---

## 工作原理

### 查询流程

```
1. 打开 WIPO Brand Database Advanced Search
   ↓
2. 输入 Brand name (商标名称)
   ↓
3. 选择 Search strategy: "is matching exact expression"
   ↓
4. 点击 Search 按钮
   ↓
5. 获取结果 → 解析 → 筛选欧盟国家
   ↓
6. 保存到 CSV/Excel/JSON
```

### 技术实现

- **工具**: agent-browser (Vercel Labs)
- **数据库**: WIPO Brand Database (https://branddb.wipo.int/)
- **查询方式**: 窗口自动化 (绕过 CAPTCHA)
- **匹配策略**: 精确匹配 (is matching exact expression)
- **筛选**: 仅限欧盟国家 (EM + 27 成员国)

---

## 使用步骤

### 步骤 1: 安装全局依赖

```bash
npm install -g agent-browser
```

### 步骤 2: 进入项目并安装依赖

```bash
cd projects/wipo-trademark-batch
npm install
```

### 步骤 3: 配置商标列表

编辑 `src/query-trademarks.js`：

```javascript
// 第 17 行左右
const trademarks = [
  '9TRANSPORT',     // 示例：在西班牙注册
  'DISNEY',         // 示例：全球知名品牌
  'YOUR_BRAND',     // 替换为你的商标
  // 添加更多...
];
```

**注意**: 每个商标一行，用逗号分隔，最后一个不需要逗号。

### 步骤 4: 运行查询

```bash
npm start
```

### 步骤 5: 查看结果

```bash
ls output/
```

生成的文件：
- `trademark-eu-results.csv` - 逗号分隔值格式
- `trademark-eu-results.xlsx` - Excel 电子表格
- `trademark-eu-results.json` - JSON 数据格式
- `query-cache.json` - 缓存文件（可删除）

---

## 配置详解

### 配置文件位置

`src/query-trademarks.js` 中的 `CONFIG` 对象：

```javascript
const CONFIG = {
  maxResultsPerTrademark: 20,  // 每个商标最多结果数
  retryAttempts: 3,            // 失败重试次数
  retryDelay: 5000,            // 重试间隔 (毫秒)
  queryDelay: 3000,            // 查询间隔 (毫秒)
  enableCache: true,           // 启用缓存
  enableResume: true           // 启用断点续传
};
```

---

## 故障排除

### 问题 1: agent-browser 未找到

```bash
npm install -g agent-browser
```

### 问题 2: 查询结果为 0

1. 检查商标拼写
2. 确认在欧盟有注册
3. 删除缓存重试: `rm output/query-cache.json`

### 问题 3: 查询中断

直接重新运行 `npm start`，会自动继续。

---

## 参考

- [WIPO Brand Database](https://branddb.wipo.int/)
- [踩坑记录](lessons-learned.md)
- [更新日志](UPDATE_LOG.md)
