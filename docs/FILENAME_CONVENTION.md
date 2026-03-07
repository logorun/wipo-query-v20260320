# Excel 报告命名规范

## 命名规则

### 基础格式
```
wipo-trademark-report-{date}-{time}-{count}-{type}-{taskId}.{ext}
```

### 字段说明

| 字段 | 格式 | 说明 | 示例 |
|------|------|------|------|
| `wipo-trademark-report` | 固定前缀 | 标识报告类型 | - |
| `{date}` | YYYYMMDD | 查询日期 | 20260304 |
| `{time}` | HHMMSS | 查询时间 | 174822 |
| `{count}` | N-items | 商标数量 | 5-items |
| `{type}` | 类型标识 | 报告类型 | full / registered / eu-only |
| `{taskId}` | UUID前8位 | 任务ID（可选） | a1b2c3d4 |
| `{ext}` | 扩展名 | 文件格式 | xlsx / csv / pdf |

### 类型标识 (type)

| 标识 | 含义 | 说明 |
|------|------|------|
| `full` | 完整版 | 包含所有查询结果 |
| `registered` | 仅已注册 | 只包含 Registered 状态 |
| `eu-only` | 仅欧盟 | 只包含欧盟国家记录 |
| `summary` | 汇总版 | 只有汇总统计 |

### 命名示例

```
# 完整版报告
wipo-trademark-report-20260304-174822-5-items-full.xlsx

# 仅已注册报告
wipo-trademark-report-20260304-174822-5-items-registered.xlsx

# 带任务ID的完整报告
wipo-trademark-report-20260304-174822-5-items-full-a1b2c3d4.xlsx

# 仅欧盟国家
wipo-trademark-report-20260304-174822-5-items-eu-only.xlsx

# CSV 格式
wipo-trademark-report-20260304-174822-5-items-full.csv
```

## 代码实现

### 命名生成函数

```javascript
const path = require('path');

/**
 * 生成规范的文件名
 * @param {Object} options
 * @param {Date} options.date - 日期时间（默认当前时间）
 * @param {number} options.count - 商标数量
 * @param {string} options.type - 报告类型 (full/registered/eu-only/summary)
 * @param {string} options.taskId - 任务ID（可选）
 * @param {string} options.ext - 扩展名 (默认 xlsx)
 * @returns {string} 规范的文件名
 */
function generateReportFilename(options = {}) {
  const {
    date = new Date(),
    count = 0,
    type = 'full',
    taskId = null,
    ext = 'xlsx'
  } = options;

  // 格式化日期: YYYYMMDD
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  
  // 格式化时间: HHMMSS
  const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
  
  // 商标数量
  const countStr = `${count}-items`;
  
  // 任务ID（取前8位，如果有）
  const taskIdStr = taskId ? `-${taskId.slice(0, 8)}` : '';
  
  // 扩展名
  const extStr = ext.startsWith('.') ? ext.slice(1) : ext;
  
  // 组合文件名
  const filename = `wipo-trademark-report-${dateStr}-${timeStr}-${countStr}-${type}${taskIdStr}.${extStr}`;
  
  return filename;
}

// 使用示例
const filename1 = generateReportFilename({
  count: 5,
  type: 'full',
  taskId: '398191a0-aff8-4dce-aa5a-16ee14a168a7'
});
// 结果: wipo-trademark-report-20260304-174822-5-items-full-398191a0.xlsx

const filename2 = generateReportFilename({
  count: 40,
  type: 'registered',
  ext: 'csv'
});
// 结果: wipo-trademark-report-20260304-174822-40-items-registered.csv
```

## 旧文件名迁移

### 旧格式（不规范）
```
商标查询结果-5个商标-完整版.xlsx
```

### 新格式（规范）
```
wipo-trademark-report-20260304-174822-5-items-full.xlsx
```

## 目录结构建议

```
output/
├── reports/
│   ├── 2026/
│   │   ├── 03/
│   │   │   ├── 04/
│   │   │   │   ├── wipo-trademark-report-20260304-174822-5-items-full.xlsx
│   │   │   │   ├── wipo-trademark-report-20260304-174822-5-items-registered.xlsx
│   │   │   │   └── ...
│   │   │   └── 05/
│   │   └── 04/
│   └── archive/          # 归档旧报告
├── evidence/             # 截图证据
│   └── 20260304/
│       ├── WIIM-20260304-174822.png
│       └── ...
└── cache/                # 缓存文件
```

## 实施步骤

1. **更新代码**: 在生成 Excel 时使用新命名规则
2. **创建工具函数**: 添加 `generateReportFilename()` 函数
3. **更新文档**: 修改 README 中的文件名示例
4. **迁移旧文件**: 将旧报告移动到 archive 目录
5. **添加配置**: 允许用户自定义前缀和日期格式

---

**记录时间**: 2026-03-04  
**生效版本**: v3.3.0+
