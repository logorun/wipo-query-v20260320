# WIPO 商标查询系统增强设计

**日期**: 2026-03-07  
**版本**: v1.0  
**状态**: 待实施

---

## 📋 概述

### 背景

当前 WIPO 商标查询系统使用 `agent-browser` 进行自动化查询，通过 regex 解析页面快照提取数据。存在以下问题：

1. **数据提取不准确** - regex 解析容易遗漏字段
2. **字段不完整** - 缺少持有人、申请国家全称、尼斯分类等信息
3. **国际注册处理困难** - 指定国家展开逻辑复杂
4. **错误率高** - 页面结构变化会导致解析失败

### 目标

1. 集成 **Kimi K2.5 视觉模型** 进行智能数据提取
2. **GLM-5** 负责代码逻辑和决策
3. **增强输出字段** - 从 7 个字段扩展到 12+ 个字段
4. **测试验证** - 使用 3 个商标验证系统功能

### 方案选择

经过对比三种方案，选择 **方案 A：增强现有系统**：

- 保留 `agent-browser` 负责浏览器操作
- 新增 `Kimi K2.5` 视觉层负责页面理解和数据提取
- GLM-5 负责代码逻辑和决策

**优势**：
- ✅ 最小改动，风险低
- ✅ 快速见效（1-2 天）
- ✅ 保留现有熔断器、重试、缓存机制

---

## 🏗️ 系统架构

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (Express)                   │
│  POST /api/v1/tasks  →  创建查询任务                      │
│  GET  /api/v1/tasks/:id  →  查询状态                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                  Worker (Bull Queue)                     │
│  1. 检查缓存                                              │
│  2. 调用 agent-browser 打开页面、操作                     │
│  3. 截图 → Kimi K2.5 视觉提取  ⭐ NEW                     │
│  4. 数据处理 & 验证 (GLM-5)  ⭐ NEW                       │
│  5. 保存到缓存 & 数据库                                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              Enhanced Output Layer                       │
│  - Excel (新增 Owner, Nice Classes, Filing Date)        │
│  - JSON (完整结构化数据)                                  │
│  - Evidence Screenshots (带时间戳)                       │
└─────────────────────────────────────────────────────────┘
```

### 数据流

```
用户提交商标列表
    ↓
API 创建任务 → Bull 队列
    ↓
Worker 处理任务
    ├─ 检查缓存 (Redis)
    ├─ agent-browser 操作浏览器
    │   ├─ 打开 WIPO 页面
    │   ├─ 选择精确匹配
    │   ├─ 输入商标名
    │   ├─ 点击搜索
    │   └─ 截图保存
    ├─ Kimi K2.5 分析截图 ⭐
    │   ├─ 视觉识别表格
    │   ├─ 提取所有字段
    │   └─ 返回结构化数据
    ├─ GLM-5 验证数据 ⭐
    │   ├─ 检查完整性
    │   ├─ 展开国际注册
    │   └─ 标记欧盟国家
    └─ 保存结果
        ├─ 缓存 (24h TTL)
        ├─ 数据库 (SQLite)
        └─ 输出文件 (Excel/JSON)
```

---

## 🔧 技术实现

### 1. Kimi K2.5 视觉提取模块

**文件**: `api/src/services/visionExtractor.js`

```javascript
const axios = require('axios');
const fs = require('fs');
const { Logger } = require('../utils/logger');

class VisionExtractor {
  constructor() {
    this.apiKey = process.env.KIMI_API_KEY;
    this.endpoint = process.env.KIMI_ENDPOINT || 'https://api.moonshot.cn/v1/chat/completions';
    this.model = process.env.KIMI_MODEL || 'moonshot-v1-8k-vision';
    this.logger = new Logger('vision-extractor');
  }

  /**
   * 从 WIPO 页面截图提取结构化数据
   * @param {string} imagePath - 截图路径
   * @param {string} trademark - 商标名称
   * @returns {Promise<Object>} 提取的数据
   */
  async extractFromScreenshot(imagePath, trademark) {
    const startTime = Date.now();

    try {
      // 读取图片并转为 base64
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBase64 = imageBuffer.toString('base64');
      const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

      // 构造 Kimi API 请求
      const response = await axios.post(
        this.endpoint,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: this.buildExtractionPrompt(trademark)
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          temperature: 0.1,  // 低温度，提高一致性
          max_tokens: 4000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const result = this.parseKimiResponse(response.data, trademark);
      
      this.logger.info('Kimi extraction completed', {
        trademark,
        recordsCount: result.records.length,
        confidence: result.confidence,
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`
      });

      return result;

    } catch (error) {
      this.logger.error('Kimi extraction failed', {
        trademark,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 构造提取提示词
   */
  buildExtractionPrompt(trademark) {
    return `
分析这张 WIPO Brand Database 搜索结果页面截图，提取商标 "${trademark}" 的所有信息。

请以严格的 JSON 格式返回以下结构（不要包含 markdown 代码块标记）：

{
  "records": [
    {
      "brandName": "商标名称（精确匹配）",
      "owner": "持有人全称",
      "status": "状态（Registered/Pending/Expired/Refused）",
      "countryOfFiling": "申请国家全称（如 Germany, Spain）",
      "countryCode": "国家代码（如 DE, ES, EM）",
      "registrationNumber": "注册号",
      "filingDate": "申请日期 (YYYY-MM-DD 格式)",
      "registrationDate": "注册日期 (YYYY-MM-DD 格式)",
      "niceClasses": ["尼斯分类数组，如 25, 35"],
      "isInternational": "是否国际注册（true/false）",
      "designatedCountries": [
        {
          "name": "指定国家名",
          "code": "国家代码",
          "isEU": "是否欧盟国家（true/false）"
        }
      ]
    }
  ],
  "totalCount": "总结果数（数字）",
  "confidence": "提取置信度（0-1 之间的数字）"
}

关键要求：
1. 如果有多条记录，全部提取
2. 优先识别欧盟国家（EM + 27 成员国：AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IE, IT, LV, LT, LU, MT, NL, PL, PT, RO, SK, SI, ES, SE）
3. 国际注册必须展开 designatedCountries 数组
4. 如果某个字段看不清楚或不存在，填 null
5. brandName 必须与 "${trademark}" 完全匹配（忽略大小写）
6. niceClasses 只保留数字，如 ["25", "28", "35"]
7. 日期格式必须是 YYYY-MM-DD

返回纯 JSON，不要有任何额外文字或代码块标记。
`;
  }

  /**
   * 解析 Kimi API 响应
   */
  parseKimiResponse(response, trademark) {
    try {
      const content = response.choices[0].message.content;
      
      // 移除可能的 markdown 代码块标记
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const data = JSON.parse(jsonStr);

      // 验证基本结构
      if (!data.records || !Array.isArray(data.records)) {
        throw new Error('Invalid response structure: missing records array');
      }

      // 标准化数据
      const normalizedRecords = data.records.map(record => ({
        brandName: record.brandName || trademark,
        owner: record.owner || null,
        status: record.status || 'Unknown',
        countryOfFiling: record.countryOfFiling || null,
        countryCode: record.countryCode || null,
        registrationNumber: record.registrationNumber || null,
        filingDate: record.filingDate || null,
        registrationDate: record.registrationDate || null,
        niceClasses: record.niceClasses || [],
        isInternational: record.isInternational || false,
        designatedCountries: record.designatedCountries || [],
        isEU: this.isEUCountry(record.countryCode),
        extractionMethod: 'kimi-vision',
        confidence: data.confidence || 0.8
      }));

      return {
        trademark,
        records: normalizedRecords,
        totalCount: data.totalCount || normalizedRecords.length,
        confidence: data.confidence || 0.8,
        extractionMethod: 'kimi-vision',
        rawResponse: content
      };

    } catch (error) {
      this.logger.error('Failed to parse Kimi response', {
        trademark,
        error: error.message,
        response: response.choices?.[0]?.message?.content
      });
      throw new Error(`Kimi response parsing failed: ${error.message}`);
    }
  }

  /**
   * 判断是否为欧盟国家
   */
  isEUCountry(countryCode) {
    const EU_CODES = ['EM', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 
                       'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 
                       'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
    return EU_CODES.includes(countryCode);
  }
}

module.exports = new VisionExtractor();
```

### 2. Worker 集成改造

**文件**: `api/worker/queryWorker.js` (修改)

在 `doQueryTrademark()` 函数中集成视觉提取：

```javascript
const visionExtractor = require('../src/services/visionExtractor');

const doQueryTrademark = async (trademark, shouldSaveEvidence) => {
  const startTime = Date.now();

  // 1-5. 现有的 agent-browser 操作（保持不变）
  logger.debug('Step 1: Opening page...', { trademark });
  execAgent('open "https://branddb.wipo.int/en/advancedsearch" --json', 60000);
  await sleep(10000);

  logger.debug('Step 2: Getting page state...', { trademark });
  let snapshot = execAgent('snapshot', 15000);

  logger.debug('Step 3: Setting search strategy...', { trademark });
  execAgent('select "e39" "is matching exact expression"', 30000);
  await sleep(2000);

  logger.debug('Step 4: Entering trademark...', { trademark });
  execAgent(`fill "e45" "${trademark}"`, 30000);
  await sleep(1000);

  logger.debug('Step 5: Clicking search...', { trademark });
  execAgent('click "e10"', 30000);
  await sleep(15000);

  // 6. 保存高分辨率截图（用于 Kimi 分析）
  logger.debug('Step 6: Taking screenshot for vision analysis...', { trademark });
  const screenshotPath = path.join(
    __dirname, 
    '../../output/evidence', 
    `${trademark}-${Date.now()}.png`
  );
  execAgent(`screenshot "${screenshotPath}"`, 10000);

  // 7. 关闭浏览器
  execAgent('close', 10000);

  // 8. 使用 Kimi K2.5 提取数据 ⭐ NEW
  logger.debug('Step 7: Extracting data with Kimi K2.5...', { trademark });
  let visionResult;
  try {
    visionResult = await visionExtractor.extractFromScreenshot(screenshotPath, trademark);
  } catch (error) {
    logger.error('Vision extraction failed, falling back to regex', {
      trademark,
      error: error.message
    });
    // 降级到原有的 regex 解析
    snapshot = execAgent('snapshot', 30000);
    const records = parseSnapshot(snapshot, trademark);
    visionResult = { records, extractionMethod: 'regex-fallback' };
  }

  // 9. 数据后处理（展开国际注册）
  const expandedRecords = [];
  for (const record of visionResult.records) {
    if (record.isInternational && record.designatedCountries.length > 0) {
      const euCountries = record.designatedCountries.filter(c => c.isEU);
      for (const country of euCountries) {
        expandedRecords.push({
          ...record,
          countryOfFiling: country.name,
          countryCode: country.code,
          isEU: true,
          isExpanded: true
        });
      }
    } else {
      expandedRecords.push(record);
    }
  }

  const euRecords = expandedRecords.filter(r => r.isEU);
  const nonEURecords = expandedRecords.filter(r => !r.isEU);

  logger.info('Query result summary', {
    trademark,
    totalRecords: expandedRecords.length,
    euRecords: euRecords.length,
    nonEURecords: nonEURecords.length,
    extractionMethod: visionResult.extractionMethod,
    confidence: visionResult.confidence
  });

  return {
    trademark,
    queryStatus: expandedRecords.length > 0 ? 'found' : 'not_found',
    totalRecords: expandedRecords.length,
    euRecords: euRecords.length,
    nonEURecords: nonEURecords.length,
    records: expandedRecords,
    queryTime: new Date().toISOString(),
    fromCache: false,
    queryDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    evidencePath: screenshotPath,
    isInternational: expandedRecords.some(r => r.isInternational),
    extractionMethod: visionResult.extractionMethod,
    confidence: visionResult.confidence || 0.8
  };
};
```

### 3. 增强的输出字段

**新字段列表**：

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| brandName | String | 商标名称 | "ADIDAS" |
| owner | String | 持有人 | "ADIDAS AG" |
| status | String | 状态 | "Registered" |
| countryOfFiling | String | 申请国家全称 | "Germany" |
| countryCode | String | 国家代码 | "DE" |
| registrationNumber | String | 注册号 | "1234567" |
| filingDate | String | 申请日期 | "2020-05-15" |
| registrationDate | String | 注册日期 | "2021-03-20" |
| niceClasses | Array | 尼斯分类 | ["25", "28", "35"] |
| isInternational | Boolean | 是否国际注册 | true |
| designatedCountries | Array | 指定国家列表 | [{name: "Spain", code: "ES", isEU: true}] |
| isEU | Boolean | 是否欧盟国家 | true |
| extractionMethod | String | 提取方式 | "kimi-vision" |
| confidence | Number | 提取置信度 | 0.95 |

### 4. Excel 报告生成改进

**文件**: `api/src/utils/excelGenerator.js` (新增)

```javascript
const xlsx = require('xlsx');

class ExcelGenerator {
  /**
   * 生成增强版 Excel 报告
   */
  static generateEnhancedReport(results, outputPath) {
    const detailData = [];

    results.forEach((result, idx) => {
      if (result.records && result.records.length > 0) {
        result.records.forEach((record, recIdx) => {
          detailData.push({
            '序号': idx + 1,
            '商标名称': record.brandName,
            '持有人': record.owner || '-',
            '状态': record.status,
            '申请国家': record.countryOfFiling || '-',
            '国家代码': record.countryCode || '-',
            '注册号': record.registrationNumber || '-',
            '申请日期': record.filingDate || '-',
            '注册日期': record.registrationDate || '-',
            '尼斯分类': record.niceClasses.join(', ') || '-',
            '是否国际注册': record.isInternational ? '是' : '否',
            '是否EU': record.isEU ? '是' : '否',
            '指定国家': record.designatedCountries?.map(c => c.name).join(', ') || '-',
            '提取方式': record.extractionMethod || '-',
            '置信度': record.confidence ? (record.confidence * 100).toFixed(0) + '%' : '-',
            '查询时间': new Date(result.queryTime).toLocaleString('zh-CN'),
            '耗时': result.queryDuration,
            '来源缓存': result.fromCache ? '是' : '否'
          });
        });
      } else {
        detailData.push({
          '序号': idx + 1,
          '商标名称': result.trademark,
          '持有人': '-',
          '状态': result.queryStatus === 'found' ? '找到记录' : '未找到',
          '申请国家': '-',
          '国家代码': '-',
          '注册号': '-',
          '申请日期': '-',
          '注册日期': '-',
          '尼斯分类': '-',
          '是否国际注册': '-',
          '是否EU': '-',
          '指定国家': '-',
          '提取方式': result.extractionMethod || '-',
          '置信度': '-',
          '查询时间': new Date(result.queryTime).toLocaleString('zh-CN'),
          '耗时': result.queryDuration,
          '来源缓存': result.fromCache ? '是' : '否'
        });
      }
    });

    // 统计汇总
    const found = results.filter(r => r.queryStatus === 'found');
    const withEU = results.filter(r => r.euRecords > 0);
    const avgConfidence = found.length > 0 
      ? (found.reduce((sum, r) => sum + (r.confidence || 0), 0) / found.length * 100).toFixed(1)
      : 0;

    const summaryData = [
      { '项目': '测试时间', '值': new Date().toLocaleString('zh-CN') },
      { '项目': '总商标数', '值': results.length },
      { '项目': '找到记录', '值': found.length },
      { '项目': '未找到', '值': results.length - found.length },
      { '项目': '包含EU记录', '值': withEU.length },
      { '项目': '平均置信度', '值': `${avgConfidence}%` },
      { '项目': '提取方式', '值': 'Kimi K2.5 Vision' },
      { '项目': '', '值': '' },
      { '项目': '包含EU记录的商标', '值': withEU.map(r => r.trademark).join(', ') || '无' }
    ];

    // 创建工作簿
    const wb = xlsx.utils.book_new();

    // 详细结果表
    const detailWs = xlsx.utils.json_to_sheet(detailData);
    detailWs['!cols'] = [
      { wch: 6 }, { wch: 15 }, { wch: 30 }, { wch: 12 },
      { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 8 },
      { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 20 },
      { wch: 10 }, { wch: 10 }
    ];
    xlsx.utils.book_append_sheet(wb, detailWs, '查询结果');

    // 统计汇总表
    const summaryWs = xlsx.utils.json_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 20 }, { wch: 80 }];
    xlsx.utils.book_append_sheet(wb, summaryWs, '统计汇总');

    // 保存
    xlsx.writeFile(wb, outputPath);

    return {
      totalRecords: detailData.length,
      foundCount: found.length,
      withEUCount: withEU.length,
      avgConfidence
    };
  }
}

module.exports = ExcelGenerator;
```

---

## 🧪 测试计划

### 测试商标

| 商标 | 预期记录数 | 预期EU国家 | 验证重点 |
|------|-----------|-----------|---------|
| WIIM | 1-2 | 可能有 | 基础字段提取 |
| 9TRANSPORT | 2 | ES (西班牙) | 与现有结果对比 |
| ADIDAS | 10+ | 多个 | 国际注册展开、多记录处理 |

### 测试流程

#### 1. 环境准备

```bash
# 配置 Kimi API Key
cd ~/.openclaw/workspace/projects/wipo-trademark-batch/api
echo "KIMI_API_KEY=your_key_here" >> .env

# 安装依赖（如果有新增）
npm install

# 启动 Redis
redis-server --daemonize yes

# 启动服务
pm2 start ecosystem.config.js
pm2 logs  # 查看日志
```

#### 2. 提交测试任务

```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: logotestkey" \
  -d '{
    "trademarks": ["WIIM", "9TRANSPORT", "ADIDAS"]
  }'
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "taskId": "uuid-here",
    "status": "pending",
    "trademarks": ["WIIM", "9TRANSPORT", "ADIDAS"]
  }
}
```

#### 3. 监控进度

```bash
# 查询任务状态
curl http://localhost:3000/api/v1/tasks/{taskId} \
  -H "X-API-Key: logotestkey"

# 预计耗时：2-3 分钟
```

#### 4. 生成报告

```bash
cd ~/.openclaw/workspace/projects/wipo-trademark-batch
node create-test-report.js {taskId}
```

### 验证指标

| 指标 | 目标 | 测量方法 |
|------|------|---------|
| 字段完整度 | 100% | 检查所有记录是否有 12 个字段 |
| 提取准确率 | > 95% | 与 WIPO 官网手动查询对比 |
| Kimi API 调用时间 | < 5s/商标 | 查看日志中的 duration |
| 置信度 | > 0.8 | 检查 confidence 字段 |
| 国际注册展开 | 正确 | 验证 designatedCountries 是否展开为多行 |

---

## ⚙️ 配置

### 环境变量

**文件**: `api/.env`

```bash
# Kimi K2.5 配置
KIMI_API_KEY=your_kimi_api_key_here
KIMI_ENDPOINT=https://api.moonshot.cn/v1/chat/completions
KIMI_MODEL=moonshot-v1-8k-vision

# 提取策略
EXTRACTION_METHOD=kimi-vision
VISION_CONFIDENCE_THRESHOLD=0.8

# 降级策略
FALLBACK_TO_REGEX=true

# 缓存
CACHE_TTL=86400

# 日志级别
LOG_LEVEL=debug
```

### PM2 配置更新

**文件**: `api/ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'wipo-api',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        EXTRACTION_METHOD: 'kimi-vision'
      }
    },
    {
      name: 'wipo-worker',
      script: 'worker/queryWorker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        EXTRACTION_METHOD: 'kimi-vision'
      }
    }
  ]
};
```

---

## 📊 性能与成本分析

### 性能预期

| 操作 | 原耗时 | 新耗时 | 变化 |
|------|-------|-------|------|
| agent-browser 操作 | 15s | 15s | 不变 |
| 截图保存 | 2s | 2s | 不变 |
| 数据提取（regex） | 1s | - | 移除 |
| 数据提取（Kimi） | - | 3-5s | 新增 |
| **总计** | **18s** | **20-22s** | +2-4s |

### 成本分析

**Kimi K2.5 API 费用**：
- 输入：约 ¥0.015/千tokens
- 输出：约 ¥0.06/千tokens
- 单次查询：约 ¥0.02-0.05/商标

**月度成本（假设 1000 个商标/月）**：
- Kimi API：¥20-50
- 服务器：不变
- **总成本**：约 ¥50/月

---

## 🚀 部署步骤

### 1. 代码开发

```bash
# 创建新分支
cd ~/.openclaw/workspace/projects/wipo-trademark-batch
git checkout -b feature/kimi-vision-integration

# 创建新文件
touch api/src/services/visionExtractor.js
touch api/src/utils/excelGenerator.js

# 修改现有文件
# - api/worker/queryWorker.js
# - api/.env
# - api/ecosystem.config.js
```

### 2. 测试验证

```bash
# 单元测试
npm test

# 集成测试（3 个商标）
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: logotestkey" \
  -d '{"trademarks": ["WIIM", "9TRANSPORT", "ADIDAS"]}'
```

### 3. 生产部署

```bash
# 合并代码
git checkout main
git merge feature/kimi-vision-integration

# 重启服务
pm2 restart ecosystem.config.js

# 验证
pm2 logs
```

---

## 🔄 降级策略

### 自动降级

如果 Kimi API 调用失败，自动降级到原有 regex 解析：

```javascript
try {
  visionResult = await visionExtractor.extractFromScreenshot(screenshotPath, trademark);
} catch (error) {
  logger.error('Vision extraction failed, falling back to regex');
  const records = parseSnapshot(snapshot, trademark);
  visionResult = { records, extractionMethod: 'regex-fallback' };
}
```

### 手动降级

通过环境变量切换：

```bash
# 在 .env 中修改
EXTRACTION_METHOD=regex

# 重启 worker
pm2 restart wipo-worker
```

---

## 📝 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Kimi API 不稳定 | 数据提取失败 | 自动降级到 regex |
| Kimi API 费用过高 | 成本超支 | 设置每日查询上限、使用缓存 |
| 视觉识别不准确 | 数据错误 | 置信度阈值、人工审核 |
| agent-browser 超时 | 查询失败 | 熔断器保护、重试机制 |
| 页面结构变化 | 提取失败 | 定期监控、快速迭代 |

---

## 🎯 成功标准

### 功能标准

- ✅ 成功集成 Kimi K2.5 视觉提取
- ✅ 输出字段从 7 个增加到 12+ 个
- ✅ 3 个测试商标全部通过
- ✅ 国际注册正确展开

### 质量标准

- ✅ 提取准确率 > 95%
- ✅ 字段完整度 = 100%
- ✅ Kimi API 调用时间 < 5s
- ✅ 置信度 > 0.8

### 运维标准

- ✅ 降级机制正常工作
- ✅ 日志完整、可追溯
- ✅ 成本可控（< ¥50/月）

---

## 📅 时间线

| 阶段 | 时间 | 任务 |
|------|------|------|
| 开发 | Day 1 | 编写 visionExtractor.js、修改 worker |
| 测试 | Day 1-2 | 3 个商标测试、验证准确性 |
| 部署 | Day 2 | 生产环境部署、监控 |
| 优化 | Day 3+ | 根据反馈优化 prompt、性能调优 |

**预计总时间**：2-3 天

---

## 📚 参考资料

- [Kimi Vision API 文档](https://platform.moonshot.cn/docs/api-reference)
- [agent-browser GitHub](https://github.com/vercel-labs/agent-browser)
- [WIPO Brand Database](https://branddb.wipo.int/)
- [项目原 README](../README.md)
- [踩坑记录](../lessons-learned.md)

---

**设计者**: OpenCode (GLM-5)  
**审核者**: 待定  
**批准日期**: 待定
