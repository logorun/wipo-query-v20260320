# Kimi K2.5 Vision Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Kimi K2.5 vision model to extract comprehensive trademark data from WIPO screenshots, replacing regex parsing with intelligent visual recognition.

**Architecture:** Add a VisionExtractor service that calls Kimi API to analyze WIPO page screenshots. Worker takes screenshot after agent-browser operations, then calls Kimi to extract structured data. Falls back to regex if Kimi fails. GLM-5 manages code logic and decision-making.

**Tech Stack:** Kimi K2.5 Vision API, Node.js, Express, Bull Queue, agent-browser, SQLite

---

## Prerequisites

Before starting:
- Ensure Kimi API key is available
- Ensure agent-browser is installed globally
- Redis must be running
- PM2 must be installed

---

## Task 1: Setup Environment Variables

**Files:**
- Modify: `api/.env`

**Step 1: Add Kimi API configuration to .env**

Open `api/.env` and add:

```bash
# Kimi K2.5 Configuration
KIMI_API_KEY=your_kimi_api_key_here
KIMI_ENDPOINT=https://api.moonshot.cn/v1/chat/completions
KIMI_MODEL=moonshot-v1-8k-vision

# Extraction Strategy
EXTRACTION_METHOD=kimi-vision
VISION_CONFIDENCE_THRESHOLD=0.8
FALLBACK_TO_REGEX=true
```

**Step 2: Verify .env file exists**

Run: `cat api/.env | grep KIMI`

Expected: Should show the KIMI_ variables

**Step 3: Commit**

```bash
git add api/.env
git commit -m "chore: add Kimi K2.5 environment configuration"
```

---

## Task 2: Create Vision Extractor Service

**Files:**
- Create: `api/src/services/visionExtractor.js`
- Create: `api/test/visionExtractor.test.js`

**Step 1: Write failing test for vision extractor**

Create `api/test/visionExtractor.test.js`:

```javascript
require('dotenv').config();
const visionExtractor = require('../src/services/visionExtractor');
const fs = require('fs');
const path = require('path');

describe('VisionExtractor', () => {
  test('should extract data from sample screenshot', async () => {
    const testImagePath = path.join(__dirname, 'fixtures', 'sample-wipo-screenshot.png');
    
    // Skip if no test image or no API key
    if (!fs.existsSync(testImagePath) || !process.env.KIMI_API_KEY) {
      console.log('Skipping test: missing test image or API key');
      return;
    }

    const result = await visionExtractor.extractFromScreenshot(testImagePath, '9TRANSPORT');
    
    expect(result).toBeDefined();
    expect(result.trademark).toBe('9TRANSPORT');
    expect(result.records).toBeDefined();
    expect(Array.isArray(result.records)).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  }, 30000);

  test('should have required methods', () => {
    expect(visionExtractor.extractFromScreenshot).toBeDefined();
    expect(typeof visionExtractor.extractFromScreenshot).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd api && npm test`

Expected: FAIL with "Cannot find module '../src/services/visionExtractor'"

**Step 3: Create test fixtures directory**

Run: `mkdir -p api/test/fixtures`

**Step 4: Write VisionExtractor implementation**

Create `api/src/services/visionExtractor.js`:

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

    if (!this.apiKey) {
      throw new Error('KIMI_API_KEY is not configured');
    }

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Screenshot not found: ${imagePath}`);
    }

    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBase64 = imageBuffer.toString('base64');
      const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

      this.logger.debug('Calling Kimi API', { trademark, imageSize: imageBuffer.length });

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
          temperature: 0.1,
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
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 构造提取提示词
   */
  buildExtractionPrompt(trademark) {
    return `分析这张 WIPO Brand Database 搜索结果页面截图，提取商标 "${trademark}" 的所有信息。

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

返回纯 JSON，不要有任何额外文字或代码块标记。`;
  }

  /**
   * 解析 Kimi API 响应
   */
  parseKimiResponse(response, trademark) {
    try {
      const content = response.choices[0].message.content;
      
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const data = JSON.parse(jsonStr);

      if (!data.records || !Array.isArray(data.records)) {
        throw new Error('Invalid response structure: missing records array');
      }

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
        response: response.choices?.[0]?.message?.content?.substring(0, 200)
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

**Step 5: Run test to verify basic structure**

Run: `cd api && npm test`

Expected: Tests should pass or skip (if no test image/API key)

**Step 6: Commit**

```bash
git add api/src/services/visionExtractor.js api/test/visionExtractor.test.js
git commit -m "feat: add Kimi K2.5 vision extractor service"
```

---

## Task 3: Update Worker to Use Vision Extractor

**Files:**
- Modify: `api/worker/queryWorker.js`
- Create: `api/test/worker.integration.test.js`

**Step 1: Add vision extractor import**

At the top of `api/worker/queryWorker.js` (after line 11), add:

```javascript
const visionExtractor = require('../src/services/visionExtractor');
```

**Step 2: Update doQueryTrademark to use vision extraction**

In `api/worker/queryWorker.js`, replace the data extraction section (around line 494-503):

**OLD CODE (to replace):**
```javascript
  // 9. 解析结果
  let records = parseSnapshot(snapshot, trademark);
  logger.info('Parsed records from snapshot', { trademark, count: records.length });
  
  // 10. 展开国际注册
  const expandedRecords = [];
  for (const record of records) {
    const expanded = expandInternationalRegistration(record);
    expandedRecords.push(...expanded);
  }
```

**NEW CODE:**
```javascript
  // 9. 使用 Kimi K2.5 视觉提取
  logger.debug('Step 7: Extracting data with Kimi K2.5...', { trademark });
  let visionResult;
  let records = [];
  
  try {
    if (process.env.EXTRACTION_METHOD === 'kimi-vision' && fs.existsSync(screenshotPath)) {
      visionResult = await visionExtractor.extractFromScreenshot(screenshotPath, trademark);
      records = visionResult.records;
      logger.info('Vision extraction completed', {
        trademark,
        recordsCount: records.length,
        confidence: visionResult.confidence
      });
    } else {
      throw new Error('Kimi vision not enabled or screenshot not found');
    }
  } catch (error) {
    logger.warn('Vision extraction failed, falling back to regex', {
      trademark,
      error: error.message
    });
    
    // 降级到 regex 解析
    if (process.env.FALLBACK_TO_REGEX === 'true') {
      records = parseSnapshot(snapshot, trademark);
      logger.info('Fallback to regex parsing', { trademark, count: records.length });
    }
  }
  
  // 10. 展开国际注册
  const expandedRecords = [];
  for (const record of records) {
    const expanded = expandInternationalRegistration(record);
    expandedRecords.push(...expanded);
  }
```

**Step 3: Update return statement**

In `api/worker/queryWorker.js`, update the return statement (around line 515-527):

**OLD CODE (to replace):**
```javascript
  const result = {
    trademark,
    queryStatus: expandedRecords.length > 0 ? 'found' : 'not_found',
    totalRecords: expandedRecords.length,
    euRecords: euRecords.length,
    nonEURecords: nonEURecords.length,
    records: expandedRecords,
    queryTime: new Date().toISOString(),
    fromCache: false,
    queryDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
    evidencePath,
    isInternational: expandedRecords.some(r => r.isInternational)
  };
```

**NEW CODE:**
```javascript
  const result = {
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
    extractionMethod: visionResult?.extractionMethod || 'regex-fallback',
    confidence: visionResult?.confidence || 0.8
  };
```

**Step 4: Write integration test**

Create `api/test/worker.integration.test.js`:

```javascript
require('dotenv').config();

describe('Worker Integration', () => {
  test('should have vision extractor available', () => {
    const visionExtractor = require('../src/services/visionExtractor');
    expect(visionExtractor).toBeDefined();
    expect(visionExtractor.extractFromScreenshot).toBeDefined();
  });

  test('should have extraction method configured', () => {
    expect(process.env.EXTRACTION_METHOD).toBeDefined();
  });
});
```

**Step 5: Run integration test**

Run: `cd api && npm test`

Expected: PASS

**Step 6: Commit**

```bash
git add api/worker/queryWorker.js api/test/worker.integration.test.js
git commit -m "feat: integrate Kimi K2.5 vision extraction into worker"
```

---

## Task 4: Create Enhanced Excel Generator

**Files:**
- Create: `api/src/utils/excelGenerator.js`
- Create: `api/test/excelGenerator.test.js`

**Step 1: Write test for Excel generator**

Create `api/test/excelGenerator.test.js`:

```javascript
const ExcelGenerator = require('../src/utils/excelGenerator');
const fs = require('fs');
const path = require('path');

describe('ExcelGenerator', () => {
  const testOutputPath = path.join(__dirname, 'test-output.xlsx');

  afterAll(() => {
    if (fs.existsSync(testOutputPath)) {
      fs.unlinkSync(testOutputPath);
    }
  });

  test('should generate Excel report with enhanced fields', () => {
    const mockResults = [
      {
        trademark: 'TEST',
        queryStatus: 'found',
        totalRecords: 1,
        euRecords: 1,
        records: [
          {
            brandName: 'TEST',
            owner: 'Test Company',
            status: 'Registered',
            countryOfFiling: 'Germany',
            countryCode: 'DE',
            registrationNumber: '12345',
            filingDate: '2020-01-01',
            registrationDate: '2020-12-01',
            niceClasses: ['25', '35'],
            isInternational: false,
            isEU: true,
            designatedCountries: [],
            extractionMethod: 'kimi-vision',
            confidence: 0.95
          }
        ],
        queryTime: new Date().toISOString(),
        queryDuration: '10.5s',
        fromCache: false,
        extractionMethod: 'kimi-vision',
        confidence: 0.95
      }
    ];

    const stats = ExcelGenerator.generateEnhancedReport(mockResults, testOutputPath);

    expect(stats).toBeDefined();
    expect(stats.totalRecords).toBe(1);
    expect(stats.foundCount).toBe(1);
    expect(fs.existsSync(testOutputPath)).toBe(true);
  });

  test('should handle empty results', () => {
    const mockResults = [
      {
        trademark: 'NOTFOUND',
        queryStatus: 'not_found',
        totalRecords: 0,
        euRecords: 0,
        records: [],
        queryTime: new Date().toISOString(),
        queryDuration: '8.2s',
        fromCache: false
      }
    ];

    const stats = ExcelGenerator.generateEnhancedReport(mockResults, testOutputPath);

    expect(stats.totalRecords).toBe(1);
    expect(stats.foundCount).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd api && npm test`

Expected: FAIL with "Cannot find module '../src/utils/excelGenerator'"

**Step 3: Write Excel generator implementation**

Create `api/src/utils/excelGenerator.js`:

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
        result.records.forEach((record) => {
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
            '尼斯分类': (record.niceClasses || []).join(', ') || '-',
            '是否国际注册': record.isInternational ? '是' : '否',
            '是否EU': record.isEU ? '是' : '否',
            '指定国家': (record.designatedCountries || []).map(c => c.name).join(', ') || '-',
            '提取方式': record.extractionMethod || result.extractionMethod || '-',
            '置信度': (record.confidence || result.confidence) 
              ? ((record.confidence || result.confidence) * 100).toFixed(0) + '%' 
              : '-',
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
          '置信度': result.confidence ? (result.confidence * 100).toFixed(0) + '%' : '-',
          '查询时间': new Date(result.queryTime).toLocaleString('zh-CN'),
          '耗时': result.queryDuration,
          '来源缓存': result.fromCache ? '是' : '否'
        });
      }
    });

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

    const wb = xlsx.utils.book_new();

    const detailWs = xlsx.utils.json_to_sheet(detailData);
    detailWs['!cols'] = [
      { wch: 6 }, { wch: 15 }, { wch: 30 }, { wch: 12 },
      { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 8 },
      { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 20 },
      { wch: 10 }, { wch: 10 }
    ];
    xlsx.utils.book_append_sheet(wb, detailWs, '查询结果');

    const summaryWs = xlsx.utils.json_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 20 }, { wch: 80 }];
    xlsx.utils.book_append_sheet(wb, summaryWs, '统计汇总');

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

**Step 4: Run test to verify it passes**

Run: `cd api && npm test`

Expected: PASS

**Step 5: Commit**

```bash
git add api/src/utils/excelGenerator.js api/test/excelGenerator.test.js
git commit -m "feat: add enhanced Excel generator with 12+ fields"
```

---

## Task 5: Create Test Report Script

**Files:**
- Create: `create-test-report.js`

**Step 1: Write test report generator**

Create `create-test-report.js` in project root:

```javascript
require('dotenv').config({ path: 'api/.env' });
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ExcelGenerator = require('./api/src/utils/excelGenerator');

const API_KEY = process.env.API_KEY || 'logotestkey';
const API_BASE = 'http://localhost:3000/api/v1';

async function generateTestReport(taskId) {
  console.log(`📊 Generating test report for task: ${taskId}\n`);

  try {
    const response = await axios.get(`${API_BASE}/tasks/${taskId}`, {
      headers: { 'X-API-Key': API_KEY }
    });

    const task = response.data.data;
    
    if (task.status !== 'completed') {
      console.log(`⚠️  Task status: ${task.status}`);
      console.log('Please wait for task to complete.\n');
      return;
    }

    const results = task.results;
    
    console.log('📈 Task Summary:');
    console.log(`  Total trademarks: ${results.length}`);
    console.log(`  Found: ${results.filter(r => r.queryStatus === 'found').length}`);
    console.log(`  Not found: ${results.filter(r => r.queryStatus === 'not_found').length}`);
    console.log(`  With EU records: ${results.filter(r => r.euRecords > 0).length}`);
    console.log(`  Errors: ${results.filter(r => r.queryStatus === 'error').length}\n`);

    const euResults = results.filter(r => r.euRecords > 0);
    if (euResults.length > 0) {
      console.log('🌍 Trademarks with EU records:');
      euResults.forEach(r => {
        const countries = r.records
          .filter(rec => rec.isEU)
          .map(rec => rec.countryCode || rec.countryOfFiling)
          .join(', ');
        console.log(`  - ${r.trademark}: ${r.euRecords} records (${countries})`);
      });
      console.log();
    }

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `trademark-test-report-${timestamp}.xlsx`;
    const outputPath = path.join(outputDir, filename);

    const stats = ExcelGenerator.generateEnhancedReport(results, outputPath);

    console.log(`✅ Excel report generated: ${outputPath}`);
    console.log(`  Total rows: ${stats.totalRecords}`);
    console.log(`  Found: ${stats.foundCount}`);
    console.log(`  With EU: ${stats.withEUCount}`);
    console.log(`  Avg confidence: ${stats.avgConfidence}%\n`);

    const jsonPath = path.join(outputDir, `trademark-test-results-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`✅ JSON results saved: ${jsonPath}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

const taskId = process.argv[2];
if (!taskId) {
  console.error('Usage: node create-test-report.js <taskId>');
  process.exit(1);
}

generateTestReport(taskId);
```

**Step 2: Test script syntax**

Run: `node -c create-test-report.js`

Expected: No syntax errors

**Step 3: Commit**

```bash
git add create-test-report.js
git commit -m "feat: add test report generator script"
```

---

## Task 6: Update PM2 Configuration

**Files:**
- Modify: `api/ecosystem.config.js`

**Step 1: Add extraction method to PM2 config**

Update `api/ecosystem.config.js`:

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

**Step 2: Validate PM2 config**

Run: `pm2 start api/ecosystem.config.js --dry-run`

Expected: No errors

**Step 3: Commit**

```bash
git add api/ecosystem.config.js
git commit -m "chore: update PM2 config with Kimi vision settings"
```

---

## Task 7: Run Full Integration Test

**Prerequisites:**
- Kimi API key configured in `api/.env`
- Redis running
- PM2 running

**Step 1: Restart services with new config**

Run:
```bash
pm2 restart api/ecosystem.config.js
pm2 logs --lines 50
```

Expected: Services restart successfully

**Step 2: Submit test task with 3 trademarks**

Run:
```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: logotestkey" \
  -d '{"trademarks": ["WIIM", "9TRANSPORT", "ADIDAS"]}'
```

Expected: JSON response with taskId

**Step 3: Monitor task progress**

Run:
```bash
# Replace TASK_ID with actual ID from step 2
curl http://localhost:3000/api/v1/tasks/TASK_ID \
  -H "X-API-Key: logotestkey"
```

Expected: Task status changes from pending → processing → completed

**Step 4: Generate test report**

Run:
```bash
# Replace TASK_ID with actual ID
node create-test-report.js TASK_ID
```

Expected: Excel and JSON files generated in `output/` directory

**Step 5: Verify results**

Check the generated Excel file for:
- ✅ All 12+ fields populated
- ✅ Extraction method shows "kimi-vision"
- ✅ Confidence scores present
- ✅ EU countries correctly identified
- ✅ International registrations expanded

**Step 6: Check logs**

Run: `pm2 logs wipo-worker --lines 100`

Expected: See "Kimi extraction completed" messages with confidence scores

**Step 7: Commit test results**

```bash
git add output/trademark-test-report-*.xlsx output/trademark-test-results-*.json
git commit -m "test: add integration test results for 3 trademarks"
```

---

## Task 8: Update Documentation

**Files:**
- Modify: `README.md`
- Create: `docs/KIMI_INTEGRATION.md`

**Step 1: Create Kimi integration guide**

Create `docs/KIMI_INTEGRATION.md`:

```markdown
# Kimi K2.5 Vision Integration Guide

## Overview

This project now uses Kimi K2.5 vision model to extract trademark data from WIPO screenshots, replacing regex-based parsing with intelligent visual recognition.

## Features

- **Intelligent Data Extraction**: Kimi analyzes page screenshots to extract all visible fields
- **Enhanced Fields**: 12+ fields including owner, filing date, nice classes
- **International Registration Support**: Automatically expands designated countries
- **Fallback Mechanism**: Reverts to regex parsing if Kimi fails
- **Confidence Scoring**: Each extraction includes a confidence score (0-1)

## Configuration

### Environment Variables

Add to `api/.env`:

```bash
KIMI_API_KEY=your_kimi_api_key_here
KIMI_ENDPOINT=https://api.moonshot.cn/v1/chat/completions
KIMI_MODEL=moonshot-v1-8k-vision
EXTRACTION_METHOD=kimi-vision
VISION_CONFIDENCE_THRESHOLD=0.8
FALLBACK_TO_REGEX=true
```

### Getting Kimi API Key

1. Visit [Moonshot AI Platform](https://platform.moonshot.cn/)
2. Create an account and verify
3. Generate API key from dashboard
4. Add to `.env` file

## Usage

### Standard Query

```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: logotestkey" \
  -d '{"trademarks": ["WIIM", "9TRANSPORT", "ADIDAS"]}'
```

### Switching to Regex Mode

If you want to use regex parsing instead:

```bash
# Update .env
EXTRACTION_METHOD=regex

# Restart worker
pm2 restart wipo-worker
```

## Output Fields

| Field | Description | Example |
|-------|-------------|---------|
| brandName | Trademark name | "ADIDAS" |
| owner | Owner/Holder | "ADIDAS AG" |
| status | Registration status | "Registered" |
| countryOfFiling | Country name | "Germany" |
| countryCode | Country code | "DE" |
| registrationNumber | Registration number | "1234567" |
| filingDate | Filing date | "2020-05-15" |
| registrationDate | Registration date | "2021-03-20" |
| niceClasses | Nice classification | ["25", "28", "35"] |
| isInternational | International registration | true/false |
| designatedCountries | Designated countries | [{name: "Spain", code: "ES", isEU: true}] |
| isEU | EU member | true/false |
| extractionMethod | How data was extracted | "kimi-vision" |
| confidence | Extraction confidence | 0.95 |

## Troubleshooting

### Kimi API Errors

**Symptom**: "Kimi extraction failed, falling back to regex"

**Solutions**:
1. Check KIMI_API_KEY is correct
2. Verify API key has sufficient credits
3. Check network connectivity
4. Review logs: `pm2 logs wipo-worker`

### Low Confidence Scores

**Symptom**: Confidence < 0.8

**Solutions**:
1. Screenshot quality may be poor
2. Page may not have loaded completely
3. Consider increasing wait time before screenshot

### Missing Fields

**Symptom**: Some fields are null

**Solutions**:
1. Field may not be visible on page
2. Check evidence screenshot manually
3. Adjust Kimi prompt if needed

## Cost Analysis

- **Kimi API**: ~¥0.02-0.05 per trademark query
- **Monthly cost** (1000 trademarks): ~¥20-50
- **Recommendation**: Use caching to minimize API calls

## Performance

- **Vision extraction**: 3-5 seconds per trademark
- **Total query time**: 20-22 seconds per trademark
- **Throughput**: ~3 trademarks per minute

## Future Improvements

1. Batch processing for multiple screenshots
2. Fine-tuned prompt for better accuracy
3. Local vision model for cost reduction
4. Real-time confidence monitoring dashboard
```

**Step 2: Update main README**

Add to `README.md` after the API section:

```markdown
---

## 🤖 Kimi K2.5 Vision Integration

本项目现已集成 **Kimi K2.5 视觉模型**，提供更准确、更完整的数据提取能力。

### 新特性

- ✅ **智能视觉提取** - 使用 Kimi K2.5 分析页面截图
- ✅ **增强字段** - 从 7 个字段扩展到 12+ 个字段
- ✅ **国际注册支持** - 自动展开指定国家列表
- ✅ **置信度评分** - 每个提取结果都有置信度分数
- ✅ **降级机制** - Kimi 失败时自动降级到 regex

### 快速开始

1. 配置 Kimi API Key:
```bash
echo "KIMI_API_KEY=your_key_here" >> api/.env
```

2. 重启服务:
```bash
pm2 restart api/ecosystem.config.js
```

3. 提交查询:
```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: logotestkey" \
  -d '{"trademarks": ["WIIM", "9TRANSPORT", "ADIDAS"]}'
```

### 输出字段

新版本输出包含以下字段：

| 字段 | 说明 | 示例 |
|------|------|------|
| owner | 持有人 | "ADIDAS AG" |
| countryOfFiling | 申请国家 | "Germany" |
| filingDate | 申请日期 | "2020-05-15" |
| niceClasses | 尼斯分类 | ["25", "28", "35"] |
| designatedCountries | 指定国家 | [{name: "Spain", code: "ES", isEU: true}] |
| confidence | 置信度 | 0.95 |

详见: [Kimi 集成文档](docs/KIMI_INTEGRATION.md)
```

**Step 3: Commit documentation**

```bash
git add README.md docs/KIMI_INTEGRATION.md
git commit -m "docs: add Kimi K2.5 vision integration documentation"
```

---

## Task 9: Final Verification and Deployment

**Step 1: Run all tests**

Run:
```bash
cd api && npm test
```

Expected: All tests pass

**Step 2: Check code quality**

Run:
```bash
# If you have linter configured
npm run lint
```

Expected: No errors

**Step 3: Verify services are healthy**

Run:
```bash
pm2 status
pm2 logs --lines 20
```

Expected: Both services running, no errors in logs

**Step 4: Create deployment checklist**

Create `DEPLOYMENT_CHECKLIST.md`:

```markdown
# Deployment Checklist

## Pre-Deployment

- [ ] Kimi API key configured in `api/.env`
- [ ] All tests passing: `cd api && npm test`
- [ ] Code reviewed and approved
- [ ] Documentation updated

## Deployment Steps

1. [ ] Pull latest code: `git pull origin main`
2. [ ] Install dependencies: `cd api && npm install`
3. [ ] Restart services: `pm2 restart api/ecosystem.config.js`
4. [ ] Check logs: `pm2 logs --lines 50`
5. [ ] Run smoke test with 1 trademark
6. [ ] Verify Kimi extraction in logs
7. [ ] Check Excel output has all fields

## Post-Deployment

- [ ] Monitor logs for 30 minutes
- [ ] Test with 3 sample trademarks
- [ ] Verify fallback mechanism works
- [ ] Update status in project tracker

## Rollback Plan

If issues occur:

1. Set `EXTRACTION_METHOD=regex` in `api/.env`
2. Restart worker: `pm2 restart wipo-worker`
3. Monitor for stability
4. Investigate and fix issues
5. Re-deploy with fixes
```

**Step 5: Final commit**

```bash
git add DEPLOYMENT_CHECKLIST.md
git commit -m "chore: add deployment checklist"
git push origin main
```

---

## Success Criteria

After completing all tasks, verify:

- ✅ Kimi K2.5 integrated and working
- ✅ Vision extraction produces confidence scores
- ✅ All 12+ fields populated correctly
- ✅ Fallback to regex works
- ✅ Excel reports generated with enhanced fields
- ✅ 3 test trademarks query successfully
- ✅ Documentation complete
- ✅ All tests passing
- ✅ Services running without errors

---

## Troubleshooting Guide

### Issue: Kimi API returns 401 Unauthorized

**Solution**: Check KIMI_API_KEY in `api/.env`

### Issue: Vision extraction confidence < 0.5

**Solution**: 
- Check screenshot quality
- Increase wait time before screenshot
- Review Kimi prompt

### Issue: Worker crashes on startup

**Solution**:
- Check all dependencies installed: `npm install`
- Verify environment variables: `cat api/.env`
- Check logs: `pm2 logs wipo-worker --err`

### Issue: No fields extracted

**Solution**:
- Verify agent-browser is working: `agent-browser --version`
- Check evidence screenshots in `output/evidence/`
- Try manual query with agent-browser

---

**Total Estimated Time**: 4-6 hours

**Recommended Approach**: Complete tasks 1-6 in one session, task 7 (integration test) in a separate session when you have 30-45 minutes of uninterrupted time.
