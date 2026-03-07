const { taskDB } = require('../models/database');
const { parseReportFilename, getOutputDir } = require('../utils/filename');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { Logger } = require('../utils/logger');
const logger = new Logger('export');

/**
 * 导出控制器
 * 支持 CSV、Excel、PDF 格式导出
 */

// CSV 导出
const exportCSV = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { filter } = req.query; // 'eu' | 'non-eu' | undefined
    const task = await taskDB.getById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: 'TASK_NOT_FOUND', message: 'Task not found' }
      });
    }

    if (task.status !== 'completed' || !task.results) {
      return res.status(400).json({
        success: false,
        error: { code: 'TASK_NOT_COMPLETED', message: 'Task not completed yet' }
      });
    }

    // 验证 filter 参数
    if (filter && !['eu', 'non-eu'].includes(filter)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILTER', message: 'Filter must be one of: eu, non-eu' }
      });
    }

    // 生成文件名（添加筛选标记）
    const filterSuffix = filter ? `-${filter}` : '';
    const csvFilename = `wipo-trademark-report-${Date.now()}-${task.trademarks.length}-items${filterSuffix}-export.csv`;

    // 转换结果为 CSV 格式
    const csvRows = [];
    csvRows.push(['商标', '品牌名称', '持有人', '状态', '国家/地区', '国家代码', '注册号', '注册日期', '尼斯分类', '是否欧盟', '是否国际注册', '查询时间'].join(','));

    let filteredCount = 0;
    for (const result of task.results) {
      for (const record of result.records || []) {
        // 应用筛选条件
        if (filter === 'eu' && !record.isEU) continue;
        if (filter === 'non-eu' && record.isEU) continue;
        
        filteredCount++;
        csvRows.push([
          result.trademark,
          record.brandName || '',
          record.owner || '',
          record.status || '',
          record.country || '',
          record.countryCode || '',
          record.regNumber || '',
          record.regDate || '',
          (record.niceClasses || []).join(';'),
          record.isEU ? '是' : '否',
          record.isInternational ? '是' : '否',
          result.queryTime
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
      }
    }

    const csvContent = csvRows.join('\n');

    // 设置响应头
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${csvFilename}"`);
    
    // 发送 CSV
    res.send('\uFEFF' + csvContent); // BOM for Excel

    logger.info('CSV exported', { taskId, filter, records: filteredCount });

  } catch (error) {
    logger.error('CSV export failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: error.message }
    });
  }
};

// Excel 导出
const exportExcel = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { filter } = req.query; // 'eu' | 'non-eu' | undefined
    const task = await taskDB.getById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: 'TASK_NOT_FOUND', message: 'Task not found' }
      });
    }

    if (task.status !== 'completed' || !task.results) {
      return res.status(400).json({
        success: false,
        error: { code: 'TASK_NOT_COMPLETED', message: 'Task not completed yet' }
      });
    }

    // 验证 filter 参数
    if (filter && !['eu', 'non-eu'].includes(filter)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_FILTER', message: 'Filter must be one of: eu, non-eu' }
      });
    }

    // 创建工作簿
    const wb = xlsx.utils.book_new();

    // 详细结果表
    const details = [];
    for (const result of task.results) {
      for (const record of result.records || []) {
        // 应用筛选条件
        if (filter === 'eu' && !record.isEU) continue;
        if (filter === 'non-eu' && record.isEU) continue;
        
        details.push({
          '查询商标': result.trademark,
          '品牌名称': record.brandName || '',
          '持有人': record.owner || '',
          '状态': record.status || '',
          '国家/地区': record.country || '',
          '国家代码': record.countryCode || '',
          '注册号': record.regNumber || '',
          '注册日期': record.regDate || '',
          '尼斯分类': (record.niceClasses || []).join(', '),
          '是否欧盟': record.isEU ? '是' : '否',
          '是否国际注册': record.isInternational ? '是' : '否',
          '是否展开记录': record.isExpanded ? '是' : '否',
          '查询时间': result.queryTime
        });
      }
    }

    const wsDetails = xlsx.utils.json_to_sheet(details);
    wsDetails['!cols'] = [
      {wch: 15}, {wch: 20}, {wch: 40}, {wch: 20}, 
      {wch: 30}, {wch: 10}, {wch: 15}, {wch: 15}, 
      {wch: 20}, {wch: 10}, {wch: 15}, {wch: 15}, {wch: 20}
    ];
    xlsx.utils.book_append_sheet(wb, wsDetails, '详细结果');

    // 汇总表（支持筛选）
    const summary = task.results.map(r => {
      let totalRecords = r.records?.length || 0;
      let euRecords = r.records?.filter(rec => rec.isEU).length || 0;
      let nonEURecords = r.records?.filter(rec => !rec.isEU).length || 0;
      
      // 如果应用了筛选，重新计算
      if (filter === 'eu') {
        totalRecords = euRecords;
        nonEURecords = 0;
      } else if (filter === 'non-eu') {
        totalRecords = nonEURecords;
        euRecords = 0;
      }
      
      return {
        '商标': r.trademark,
        '查询状态': r.queryStatus,
        '总记录数': totalRecords,
        '欧盟记录数': euRecords,
        '非欧盟记录数': nonEURecords,
        '是否国际注册': r.isInternational ? '是' : '否',
        '查询时间': r.queryTime,
        '是否来自缓存': r.fromCache ? '是' : '否'
      };
    });

    const wsSummary = xlsx.utils.json_to_sheet(summary);
    wsSummary['!cols'] = [
      {wch: 20}, {wch: 15}, {wch: 12}, {wch: 12}, 
      {wch: 15}, {wch: 15}, {wch: 20}, {wch: 15}
    ];
    xlsx.utils.book_append_sheet(wb, wsSummary, '汇总');

    // 生成文件名（添加筛选标记）
    const filterSuffix = filter ? `-${filter}` : '';
    const excelFilename = `wipo-trademark-report-${Date.now()}-${task.trademarks.length}-items${filterSuffix}-export.xlsx`;
    const outputDir = getOutputDir();
    const filepath = path.join(outputDir, excelFilename);

    // 保存文件
    xlsx.writeFile(wb, filepath);

    // 发送文件
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFilename}"`);
    
    const fileStream = fs.createReadStream(filepath);
    fileStream.pipe(res);

    logger.info('Excel exported', { taskId, filter, filepath, records: details.length });

  } catch (error) {
    logger.error('Excel export failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: error.message }
    });
  }
};

// PDF 导出（简化版，返回 JSON 提示）
const exportPDF = async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await taskDB.getById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: 'TASK_NOT_FOUND', message: 'Task not found' }
      });
    }

    if (task.status !== 'completed' || !task.results) {
      return res.status(400).json({
        success: false,
        error: { code: 'TASK_NOT_COMPLETED', message: 'Task not completed yet' }
      });
    }

    // PDF 导出需要更多配置，暂时返回提示
    res.json({
      success: true,
      message: 'PDF export requires additional configuration (puppeteer/pdfkit). Please use CSV or Excel format for now.',
      alternativeFormats: ['/api/v1/export/:taskId?format=csv', '/api/v1/export/:taskId?format=excel']
    });

    logger.info('PDF export requested (not implemented)', { taskId });

  } catch (error) {
    logger.error('PDF export failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: { code: 'EXPORT_FAILED', message: error.message }
    });
  }
};

// 主导出路由处理
const exportTask = async (req, res) => {
  const { format = 'excel' } = req.query;
  
  switch (format.toLowerCase()) {
    case 'csv':
      return exportCSV(req, res);
    case 'excel':
    case 'xlsx':
      return exportExcel(req, res);
    case 'pdf':
      return exportPDF(req, res);
    default:
      return res.status(400).json({
        success: false,
        error: { 
          code: 'INVALID_FORMAT', 
          message: 'Format must be one of: csv, excel, pdf' 
        }
      });
  }
};

module.exports = {
  exportTask,
  exportCSV,
  exportExcel,
  exportPDF
};
