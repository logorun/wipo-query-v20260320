const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * 文件名处理工具
 */

// 获取输出目录（按日期组织）
const getOutputDir = () => {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const outputDir = path.join(__dirname, '../../output', today);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  return outputDir;
};

// 解析报告文件名
const parseReportFilename = (taskId) => {
  // 这里可以添加从任务ID解析文件名的逻辑
  // 目前返回基本结构
  return {
    type: 'export',
    taskId
  };
};

// 生成报告文件名
const generateReportFilename = (options = {}) => {
  const { count = 0, type = 'report' } = options;
  const timestamp = Date.now();
  const uuid = uuidv4().slice(0, 8);
  
  return `wipo-trademark-${type}-${timestamp}-${count}-items.xlsx`;
};

module.exports = {
  getOutputDir,
  parseReportFilename,
  generateReportFilename
};
