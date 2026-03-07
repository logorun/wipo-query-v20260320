# WIPO 商标批量查询 - 踩坑记录

## 问题与解决方案

### 1. ❌ URL 参数搜索无效

**问题**: 直接通过 `https://www3.wipo.int/madrid/monitor/en/?q=KEYWORD` 传递搜索参数，页面不会自动执行搜索。

**原因**: WIPO Madrid Monitor 使用前端 JavaScript 处理搜索，URL 参数不会被后端识别。

**解决**: 必须手动操作页面元素：
1. 打开基础页面
2. 找到搜索输入框 (textbox)
3. 填入关键词
4. 点击搜索按钮

```javascript
// ❌ 错误
await page.goto('https://www3.wipo.int/madrid/monitor/en/?q=KEYWORD');

// ✅ 正确
execAgent('open "https://www3.wipo.int/madrid/monitor/en/"');
// 找到搜索框 ref
execAgent(`fill "@${textboxRef}" "KEYWORD"`);
execAgent(`click "@${searchRef}"`);
```

---

### 2. ❌ 页面元素引用 (ref) 动态变化

**问题**: 使用固定的 `@e16`、`@e17` 等 ref 值在不同页面加载时可能失效。

**原因**: agent-browser 每次 snapshot 生成的 ref ID 是动态分配的，不是固定的 CSS 选择器。

**解决**: 每次页面加载后重新获取 snapshot，动态解析元素 ref：

```javascript
const snapshot = execAgent('snapshot');
const textboxMatch = snapshot.match(/textbox\s*\[ref=([e\d]+)\]/);
const searchMatch = snapshot.match(/link\s*"🔎"\s*\[ref=([e\d]+)\]/);
const textboxRef = textboxMatch[1];
const searchRef = searchMatch[1];
```

---

### 3. ❌ 等待时间不足导致数据获取失败

**问题**: 搜索结果需要异步加载，立即获取 snapshot 可能得到空白页面或无结果提示。

**现象**: 
- "⚠️ Not found"
- "⚠️ No data"
- 搜索结果数量与实际不符

**解决**: 增加等待时间，确保 AJAX 请求完成：

```javascript
// ❌ 不够
await sleep(3000);

// ✅ 合适
await sleep(10000); // 搜索结果加载需要较长时间
```

---

### 4. ❌ Playwright 直接访问表格解析困难

**问题**: 使用 Playwright 直接访问 WIPO 页面时，表格结构复杂，CSS 选择器难以定位。

**原因**: WIPO 使用自定义 Web Components 和动态生成的表格结构。

**解决**: 使用 agent-browser 的 accessibility tree 解析，它对动态内容更友好：

```javascript
// agent-browser 的 snapshot 输出示例:
// - row "DISNEY VILLAINS International registration..."
//   - gridcell "Mark ROM.1428460"
//   - gridcell "DISNEY VILLAINS"
//   - gridcell "Active"
```

---

### 5. ❌ 搜索结果数量大导致解析遗漏

**问题**: 某些商标（如 COULEUR、SAMSONITE、NIKON）返回 20-30 条结果，容易漏掉部分数据。

**解决**: 
- 限制每条商标取前 5 条结果（避免数据过多）
- 使用循环解析所有匹配的行
- 在日志中记录找到的总数

```javascript
const lines = snapshot.split('\n');
for (const line of lines) {
  if (line.includes('row') && line.toUpperCase().includes(trademark.toUpperCase())) {
    // 解析每条记录
  }
}
```

---

### 6. ❌ 持有人信息解析不完整

**问题**: 持有人名称可能分布在多个元素中，简单匹配可能导致信息缺失。

**解决**: 累积所有匹配的元素文本：

```javascript
let holder = '';
if (detail.includes('emphasis:')) {
  const holderMatch = detail.match(/emphasis:\s*"([^"]+)"/);
  if (holderMatch) holder += holderMatch[1] + ' ';
}
holder = holder.trim();
```

---

### 7. ❌ 查询间隔过短导致被封

**问题**: 连续快速查询可能触发 WIPO 的访问限制。

**解决**: 设置合理的查询间隔：

```javascript
if (i < trademarks.length - 1) {
  await sleep(2000); // 至少 2 秒间隔
}
```

---

### 8. ❌ Brand Database 搜索策略选择不生效

**问题**: 选择 "Match exact expression" 后，实际查询仍使用 "contains" 策略，导致返回大量模糊匹配结果。

**正确流程**:
1. 访问 https://branddb.wipo.int/en/advancedsearch
2. 在 Brand name 字段输入商标名
3. **关键**: 点击 Search strategy 下拉框
4. 选择 "Match exact expression" 选项
5. **等待页面更新** (需要重新获取 snapshot)
6. 点击 Search 按钮
7. **验证**: 确认页面显示 "is matching exact expression" 而不是 "contains"

**错误代码**:
```javascript
// ❌ 错误：直接点击选项，没有展开下拉框
execAgent('click "@e15"'); // 可能点不到
```

**正确代码**:
```javascript
// ✅ 正确：先点击下拉框，再选择选项
execAgent('click "@e13"'); // 点击下拉框
await sleep(2000);
snapshot = execAgent('snapshot'); // 重新获取
const option = snapshot.match(/option\s*"Match exact expression"\s*\[ref=([e\d]+)\]/);
execAgent(`click "@${option[1]}"`); // 点击选项
```

**验证方法**:
```javascript
// 搜索后检查页面文本
if (snapshot.includes('is matching exact expression')) {
  console.log('✅ 精确匹配策略已生效');
} else if (snapshot.includes('contains')) {
  console.log('⚠️ 仍是包含搜索，需要重试');
}
```

---

## 优化建议

### 速率优化

1. **并行查询**: 当前串行查询 40 个商标需要 ~15 分钟。可以考虑：
   - 使用多个 browser context 并行查询（需注意 WIPO 限制）
   - 分批查询，每批间隔更长时间

2. **缓存机制**: 
   - 对已查询的商标结果进行缓存
   - 避免重复查询相同商标

3. **增量更新**:
   - 只查询新增或状态可能变化的商标
   - 根据注册日期判断是否需要更新

### 可靠性优化

1. **重试机制**: 对失败的查询自动重试 2-3 次
2. **错误分类**: 区分 "未找到"、"网络错误"、"解析错误"
3. **断点续传**: 保存查询进度，中断后可从上次位置继续

### 功能扩展

1. **详情页抓取**: 当前只获取列表页信息，可以点击进入详情页获取更多字段
2. **图片下载**: 下载商标图片
3. **状态监控**: 定期监控商标状态变化并发送通知

### 输出优化

1. **数据清洗**: 标准化状态字段、日期格式
2. **去重**: 相同商标可能多次出现，需要去重
3. **分类统计**: 按状态、来源国、持有人等维度生成统计报告

---

## 关键代码片段

### 动态获取元素 ref
```javascript
function findSearchRefs(snapshot) {
  const searchRef = snapshot.match(/textbox\s*\[ref=([e\d]+)\]/)?.[1];
  const buttonRef = snapshot.match(/link\s*"🔎"\s*\[ref=([e\d]+)\]/)?.[1];
  return { searchRef, buttonRef };
}
```

### 解析商标结果
```javascript
function parseSnapshot(snapshot, trademark) {
  const results = [];
  const lines = snapshot.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('row') && line.toUpperCase().includes(trademark.toUpperCase())) {
      // 解析单行数据...
      results.push(result);
    }
  }
  
  return results;
}
```

### 完整的查询流程
```javascript
async function queryTrademark(name, index) {
  // 1. 打开页面
  execAgent('open "https://www3.wipo.int/madrid/monitor/en/"');
  await sleep(6000);
  
  // 2. 获取 refs
  const snapshot = execAgent('snapshot');
  const { searchRef, buttonRef } = findSearchRefs(snapshot);
  
  // 3. 执行搜索
  execAgent(`fill "@${searchRef}" "${name}"`);
  execAgent(`click "@${buttonRef}"`);
  await sleep(10000);
  
  // 4. 获取结果
  const resultSnapshot = execAgent('snapshot');
  return parseSnapshot(resultSnapshot, name);
}
```

---

## 参考

- [agent-browser GitHub](https://github.com/vercel-labs/agent-browser)
- [WIPO Madrid Monitor](https://www3.wipo.int/madrid/monitor/en/)
- [Madrid System](https://www.wipo.int/madrid/en/)
