const path = require('path');
const fs = require('fs');

/**
 * 生成规范的报告文件名
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

/**
 * 获取输出目录（按日期组织）
 * @param {Date} date - 日期
 * @param {string} baseDir - 基础目录
 * @returns {string} 输出目录路径
 */
function getOutputDir(date = new Date(), baseDir = './output/reports') {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const outputDir = path.join(baseDir, String(year), month, day);
  
  // 确保目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  return outputDir;
}

/**
 * 解析文件名获取信息
 * @param {string} filename - 文件名
 * @returns {Object|null} 解析结果
 */
function parseReportFilename(filename) {
  const regex = /wipo-trademark-report-(\d{8})-(\d{6})-(\d+)-items-(full|registered|eu-only|summary)(?:-([a-z0-9]+))?\.(\w+)/;
  const match = filename.match(regex);
  
  if (!match) {
    return null;
  }
  
  return {
    date: `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`,
    time: `${match[2].slice(0, 2)}:${match[2].slice(2, 4)}:${match[2].slice(4, 6)}`,
    count: parseInt(match[3]),
    type: match[4],
    taskId: match[5] || null,
    ext: match[6]
  };
}

module.exports = {
  generateReportFilename,
  getOutputDir,
  parseReportFilename
};

// CLI 测试
if (require.main === module) {
  console.log('=== 文件名生成测试 ===\n');
  
  // 测试1: 完整版报告
  const filename1 = generateReportFilename({
    count: 5,
    type: 'full',
    taskId: '398191a0-aff8-4dce-aa5a-16ee14a168a7'
  });
  console.log('1. 完整版报告:');
  console.log(`   ${filename1}`);
  console.log(`   解析:`, parseReportFilename(filename1));
  console.log();
  
  // 测试2: 仅已注册
  const filename2 = generateReportFilename({
    count: 40,
    type: 'registered',
    ext: 'csv'
  });
  console.log('2. 仅已注册 (CSV):');
  console.log(`   ${filename2}`);
  console.log(`   解析:`, parseReportFilename(filename2));
  console.log();
  
  // 测试3: 仅欧盟
  const filename3 = generateReportFilename({
    count: 10,
    type: 'eu-only'
  });
  console.log('3. 仅欧盟:');
  console.log(`   ${filename3}`);
  console.log(`   解析:`, parseReportFilename(filename3));
  console.log();
  
  // 测试4: 输出目录
  const outputDir = getOutputDir();
  console.log('4. 输出目录:');
  console.log(`   ${outputDir}`);
  console.log();
  
  // 测试5: 旧文件名解析失败
  const oldFilename = '商标查询结果-5个商标-完整版.xlsx';
  console.log('5. 旧文件名解析:');
  console.log(`   ${oldFilename}`);
  console.log(`   解析结果:`, parseReportFilename(oldFilename));
}
