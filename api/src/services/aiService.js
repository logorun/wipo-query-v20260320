const axios = require('axios');
const { Logger } = require('../utils/logger');

const logger = new Logger('aiService');

class AIService {
  constructor() {
    this.apiKey = process.env.XAIO_API_KEY || process.env.OPENAI_API_KEY || '';
    this.baseUrl = process.env.XAIO_BASE_URL || 'https://api.x-aio.com/v1';
    this.model = process.env.XAIO_MODEL || 'kimi-k2.5';
  }

  async extractTrademarks(excelData) {
    try {
      if (!this.apiKey) {
        logger.warn('No AI API key configured, using fallback extraction');
        return this.fallbackExtraction(excelData);
      }

      const dataSample = this.formatDataForAI(excelData);
      
      const prompt = `请从以下 Excel 数据中提取所有商标名称。

数据内容：
${dataSample}

请只返回商标名称列表，每行一个，不要包含任何其他解释文字。
如果是中文商标，保留原样；如果是英文商标，保留原样。
去除重复项。

输出格式：
商标名称1
商标名称2
商标名称3`;

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: '你是一个专业的商标信息提取助手。你的任务是从各种格式的数据中提取商标名称，只返回纯净的商标列表。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 16000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000
        }
      );

      const content = response.data.choices[0]?.message?.content || '';
      const trademarks = this.parseAIResponse(content);
      
      logger.info('AI extraction completed', { 
        inputRows: excelData.length,
        extractedCount: trademarks.length 
      });

      return trademarks;
    } catch (error) {
      logger.error('AI extraction failed', { 
        error: error.message,
        response: error.response?.data 
      });
      return this.fallbackExtraction(excelData);
    }
  }

  formatDataForAI(excelData) {
    return excelData.map(row => {
      if (typeof row === 'object') {
        return Object.values(row).join(', ');
      }
      return String(row);
    }).join('\n');
  }

  parseAIResponse(content) {
    if (!content) return [];
    
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.startsWith('#'))
      .filter(line => !line.match(/^\d+\./))
      .filter(line => !line.match(/^[-*]\s/))
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(line => line.length > 0 && line.length <= 100);

    return [...new Set(lines)];
  }

  fallbackExtraction(excelData) {
    logger.info('Using fallback extraction method');
    
    const trademarks = [];
    const headerKeywords = ['序号', '编号', 'id', 'no', '名称', 'name', '商标', 'trademark', '品牌', 'brand'];
    let isFirstRow = true;
    
    for (const row of excelData) {
      if (typeof row === 'object' && row !== null) {
        const values = Object.values(row).filter(v => v && String(v).trim());
        if (values.length === 0) continue;
        
        const firstValue = String(values[0]).trim();
        
        if (isFirstRow) {
          isFirstRow = false;
          const lowerValue = firstValue.toLowerCase();
          if (headerKeywords.some(kw => lowerValue.includes(kw.toLowerCase()))) {
            continue;
          }
        }
        
        if (this.isValidTrademark(firstValue)) {
          trademarks.push(firstValue);
        } else if (values.length > 1) {
          for (let i = 1; i < values.length; i++) {
            const val = String(values[i]).trim();
            if (this.isValidTrademark(val)) {
              trademarks.push(val);
              break;
            }
          }
        }
      } else if (row) {
        const val = String(row).trim();
        if (isFirstRow) {
          isFirstRow = false;
          const lowerVal = val.toLowerCase();
          if (headerKeywords.some(kw => lowerVal.includes(kw.toLowerCase()))) {
            continue;
          }
        }
        if (this.isValidTrademark(val)) {
          trademarks.push(val);
        }
      }
    }

    const unique = [...new Set(trademarks)];
    logger.info('Fallback extraction completed', { 
      inputRows: excelData.length,
      extractedCount: unique.length 
    });
    
    return unique;
  }

  isValidTrademark(value) {
    if (!value || value.length === 0 || value.length > 100) return false;
    
    const trimmed = value.trim();
    
    if (/^\d+$/.test(trimmed)) return false;
    
    const headerKeywords = ['序号', '编号', 'id', 'no', '名称', 'name', '商标', 'trademark', '品牌', 'brand', '类别', 'class', '备注', 'note'];
    const lowerValue = trimmed.toLowerCase();
    if (headerKeywords.some(kw => lowerValue === kw.toLowerCase())) return false;
    
    return true;
  }
}

module.exports = new AIService();
