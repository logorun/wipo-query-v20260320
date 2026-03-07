const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// ==================== 修正后的查询结果数据 ====================
// 只包含 Status 为 "Registered" 或 "International Registration in Force" 的记录

const results = [
  // WIIM - 欧盟结果 (1条 Registered)
  {
    '查询商标': 'WIIM',
    '商标名称': 'WiiM',
    '完整名称': 'WiiM Owner Linkplay Technology Inc. (USA)',
    '状态': 'Registered',
    '国家/地区': 'European Union (EM)',
    '注册号': '018867198',
    '注册日期': '2023-10-05',
    '类别': 'Nice class 9',
    '来源': 'WIPO Brand Database'
  },
  // 9TRANSPORT - 西班牙结果 (2条 Registered)
  {
    '查询商标': '9TRANSPORT',
    '商标名称': '9TRANSPORT',
    '完整名称': '9TRANSPORT Owner JOAN MANUEL TEIXIDO BLASCO (Spain)',
    '状态': 'Registered',
    '国家/地区': 'Spain (ES)',
    '注册号': 'M2919818',
    '注册日期': '2010-08-10',
    '类别': 'Nice class 35',
    '来源': 'WIPO Brand Database'
  },
  {
    '查询商标': '9TRANSPORT',
    '商标名称': '9TRANSPORT',
    '完整名称': '9TRANSPORT Owner JUAN MANUEL TEIXIDO BLASCO (Spain)',
    '状态': 'Registered',
    '国家/地区': 'Spain (ES)',
    '注册号': 'M4123051',
    '注册日期': '2022-03-28',
    '类别': 'Nice class 35',
    '来源': 'WIPO Brand Database'
  },
  // IMPORTACION - 无结果
  {
    '查询商标': 'IMPORTACION',
    '商标名称': '-',
    '完整名称': '无结果',
    '状态': 'Not Found',
    '国家/地区': '-',
    '注册号': '-',
    '注册日期': '-',
    '类别': '-',
    '来源': 'WIPO Brand Database'
  },
  // LE-CREUSET - 无结果
  {
    '查询商标': 'LE-CREUSET',
    '商标名称': '-',
    '完整名称': '无结果',
    '状态': 'Not Found',
    '国家/地区': '-',
    '注册号': '-',
    '注册日期': '-',
    '类别': '-',
    '来源': 'WIPO Brand Database'
  },
  // LIFE EXTENSION - 71条结果中，无单独欧盟国家 Registered 记录
  // 只有1条国际注册包含欧盟，但不是单独的欧盟国家注册
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': '-',
    '完整名称': '71条结果中无欧盟国家 Registered 记录',
    '状态': 'No EU Registered',
    '国家/地区': '-',
    '注册号': '-',
    '注册日期': '-',
    '类别': '-',
    '来源': 'WIPO Brand Database'
  }
];

// 创建汇总统计 - 只统计 Registered 状态
const summary = [
  { '商标': 'WIIM', '总结果数': 28, 'Registered(欧盟)': 1, '说明': '欧盟注册有效' },
  { '商标': '9TRANSPORT', '总结果数': 2, 'Registered(欧盟)': 2, '说明': '西班牙注册有效' },
  { '商标': 'IMPORTACION', '总结果数': 0, 'Registered(欧盟)': 0, '说明': '无结果' },
  { '商标': 'LE-CREUSET', '总结果数': 0, 'Registered(欧盟)': 0, '说明': '无结果' },
  { '商标': 'LIFE EXTENSION', '总结果数': 71, 'Registered(欧盟)': 0, '说明': '无单独欧盟国家Registered记录' }
];

// 创建工作簿
const wb = xlsx.utils.book_new();

// 详细结果表 - 只包含 Registered 记录
const wsDetails = xlsx.utils.json_to_sheet(results);
wsDetails['!cols'] = [
  {wch: 20}, {wch: 20}, {wch: 60}, {wch: 18}, 
  {wch: 25}, {wch: 15}, {wch: 15}, {wch: 25}, {wch: 20}
];
xlsx.utils.book_append_sheet(wb, wsDetails, 'Registered结果');

// 汇总统计表
const wsSummary = xlsx.utils.json_to_sheet(summary);
wsSummary['!cols'] = [{wch: 20}, {wch: 12}, {wch: 18}, {wch: 35}];
xlsx.utils.book_append_sheet(wb, wsSummary, '汇总统计');

// 保存文件
const outputDir = '/root/.openclaw/workspace/projects/wipo-trademark-batch/output';
const excelPath = path.join(outputDir, '商标查询结果-5个商标-Registered.xlsx');
xlsx.writeFile(wb, excelPath);

console.log('✅ Excel文件已更新:', excelPath);
console.log('');
console.log('📊 查询结果摘要 (只包含 Registered 状态):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('WIIM:           1条欧盟 Registered ✅');
console.log('9TRANSPORT:     2条西班牙 Registered ✅');
console.log('IMPORTACION:    无结果');
console.log('LE-CREUSET:     无结果');
console.log('LIFE EXTENSION: 71条结果中无欧盟国家 Registered 记录');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('📁 截图保存在:', path.join(outputDir, 'screenshots'));
