const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { generateReportFilename, getOutputDir } = require('./src/utils/filename');

// ==================== 完整查询结果数据（含所有Status） ====================

const results = [
  // ========== WIIM - 28条结果中的欧盟记录 ==========
  {
    '查询商标': 'WIIM',
    '商标名称': 'WiiM',
    '完整名称': 'WiiM Owner Linkplay Technology Inc. (USA)',
    '状态': 'Registered',
    '国家/地区': 'European Union (EM)',
    '注册号': '018867198',
    '注册日期': '2023-10-05',
    '类别': 'Nice class 9',
    '备注': '欧盟注册有效',
    '来源': 'WIPO Brand Database'
  },
  
  // ========== 9TRANSPORT - 2条西班牙记录 ==========
  {
    '查询商标': '9TRANSPORT',
    '商标名称': '9TRANSPORT',
    '完整名称': '9TRANSPORT Owner JOAN MANUEL TEIXIDO BLASCO (Spain)',
    '状态': 'Registered',
    '国家/地区': 'Spain (ES)',
    '注册号': 'M2919818',
    '注册日期': '2010-08-10',
    '类别': 'Nice class 35',
    '备注': '西班牙注册有效',
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
    '备注': '西班牙注册有效',
    '来源': 'WIPO Brand Database'
  },
  
  // ========== IMPORTACION - 无结果 ==========
  {
    '查询商标': 'IMPORTACION',
    '商标名称': '-',
    '完整名称': '无结果',
    '状态': 'Not Found',
    '国家/地区': '-',
    '注册号': '-',
    '注册日期': '-',
    '类别': '-',
    '备注': 'WIPO Brand Database无记录',
    '来源': 'WIPO Brand Database'
  },
  
  // ========== LE-CREUSET - 无结果 ==========
  {
    '查询商标': 'LE-CREUSET',
    '商标名称': '-',
    '完整名称': '无结果',
    '状态': 'Not Found',
    '国家/地区': '-',
    '注册号': '-',
    '注册日期': '-',
    '类别': '-',
    '备注': 'WIPO Brand Database无记录',
    '来源': 'WIPO Brand Database'
  },
  
  // ========== LIFE EXTENSION - 71条结果中的代表性记录 ==========
  // 第1页结果
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'Life Extension',
    '完整名称': 'Life Extension Owner Laboratoires FORTE PHARMA S.A.M. (Monaco)',
    '状态': 'Ended',
    '国家/地区': 'France (FR)',
    '注册号': '99798072',
    '注册日期': '1999-07-23',
    '类别': 'Nice class 3, 5, 29, 30',
    '备注': '法国-已结束',
    '来源': 'WIPO Brand Database'
  },
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'LIFE EXTENSION',
    '完整名称': 'LIFE EXTENSION Owner FLORES, MANUEL (USA)',
    '状态': 'Ended',
    '国家/地区': 'USA (US)',
    '注册号': '74698406',
    '注册日期': '1999-04-01',
    '类别': 'Nice class 5',
    '备注': '美国-已结束',
    '来源': 'WIPO Brand Database'
  },
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'LIFE EXTENSION',
    '完整名称': 'LIFE EXTENSION Owner Biomedical Research and Longevity Society, Inc. (USA)',
    '状态': 'Registered',
    '国家/地区': 'UK (GB)',
    '注册号': 'UK00800907678',
    '注册日期': '2007-11-12',
    '类别': 'Nice class 5, 16, 35, 36, 44',
    '备注': '英国-已注册（非欧盟）',
    '来源': 'WIPO Brand Database'
  },
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'life extension',
    '完整名称': 'life extension Owner Biomedical Research and Longevity Society, Inc. (USA)',
    '状态': 'Registered',
    '国家/地区': 'Singapore (SG)',
    '注册号': 'T0629027G',
    '注册日期': '2010-04-13',
    '类别': 'Nice class 16',
    '备注': '新加坡-已注册',
    '来源': 'WIPO Brand Database'
  },
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'LIFE EXTENSION',
    '完整名称': 'LIFE EXTENSION Owner Biomedical Research and Longevity Society, Inc. (USA)',
    '状态': 'Registered',
    '国家/地区': 'Canada (CA)',
    '注册号': 'TMA858572',
    '注册日期': '2013-08-26',
    '类别': 'Nice class 5, 16, 35, 36, 44',
    '备注': '加拿大-已注册',
    '来源': 'WIPO Brand Database'
  },
  // 第2页结果
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'LIFE EXTENSION',
    '完整名称': 'LIFE EXTENSION Owner LIFE EXTENSION FOUNDATION, INC. (USA)',
    '状态': 'Registered',
    '国家/地区': 'Brazil (BR)',
    '注册号': '830560319',
    '注册日期': '-',
    '类别': 'Nice class 5',
    '备注': '巴西-已注册',
    '来源': 'WIPO Brand Database'
  },
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'LIFE EXTENSION',
    '完整名称': 'LIFE EXTENSION Owner LIFE EXTENSION FOUNDATION, INC. (USA)',
    '状态': 'Registered',
    '国家/地区': 'Mexico (MX)',
    '注册号': '975441',
    '注册日期': '2007-03-05',
    '类别': 'Nice class 35',
    '备注': '墨西哥-已注册',
    '来源': 'WIPO Brand Database'
  },
  // 第3页结果 - 国际注册（包含欧盟）
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'LIFE EXTENSION',
    '完整名称': 'LIFE EXTENSION Owner Biomedical Research, and Longevity Society, Inc. (USA)',
    '状态': 'International Registration in Force',
    '国家/地区': 'Germany, Belgium, Finland, Portugal, Bulgaria, Denmark, Lithuania, Luxembourg, Croatia, Latvia, France, Hungary, Sweden, Slovenia, Slovakia, UK, Ireland, Estonia, Malta, European Union, Greece, Italy, Spain, Austria, Cyprus, Czech Republic, Poland, Romania, Netherlands (+其他非欧盟国家)',
    '注册号': '907678',
    '注册日期': '2006-11-21',
    '类别': 'Nice class 5, 16, 35, 36, 44',
    '备注': '国际注册有效-包含欧盟国家',
    '来源': 'WIPO Brand Database'
  },
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'LIFE EXTENSION',
    '完整名称': 'LIFE EXTENSION Owner Biomedical Research and Longevity Society, Inc. (USA)',
    '状态': 'Registered',
    '国家/地区': 'Lao PDR (LA)',
    '注册号': '41340',
    '注册日期': '2018-06-27',
    '类别': 'Nice class 5, 16, 35, 36, 44',
    '备注': '老挝-已注册',
    '来源': 'WIPO Brand Database'
  },
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'LIFE EXTENSION',
    '完整名称': 'LIFE EXTENSION Owner BIOMEDICAL RESEARCH AND LONGEVITY SOCIETY INC. (USA)',
    '状态': 'Registered',
    '国家/地区': 'Philippines (PH)',
    '注册号': 'PH4201500505443',
    '注册日期': '2016-02-18',
    '类别': 'Nice class 44, 35, 5, 16',
    '备注': '菲律宾-已注册',
    '来源': 'WIPO Brand Database'
  }
];

// 创建汇总统计
const summary = [
  { '商标': 'WIIM', '总结果数': 28, '欧盟记录': '1 (EM)', 'Registered': 1, '说明': '欧盟注册有效' },
  { '商标': '9TRANSPORT', '总结果数': 2, '欧盟记录': '2 (ES)', 'Registered': 2, '说明': '西班牙注册有效' },
  { '商标': 'IMPORTACION', '总结果数': 0, '欧盟记录': '0', 'Registered': 0, '说明': '无结果' },
  { '商标': 'LE-CREUSET', '总结果数': 0, '欧盟记录': '0', 'Registered': 0, '说明': '无结果' },
  { '商标': 'LIFE EXTENSION', '总结果数': 71, '欧盟记录': '1 (国际注册)', 'Registered': '国际注册有效', '说明': '无单独欧盟国家Registered，但有国际注册包含欧盟' }
];

// 创建工作簿
const wb = xlsx.utils.book_new();

// 详细结果表
const wsDetails = xlsx.utils.json_to_sheet(results);
wsDetails['!cols'] = [
  {wch: 18}, {wch: 18}, {wch: 55}, {wch: 25}, 
  {wch: 60}, {wch: 15}, {wch: 15}, {wch: 30}, {wch: 30}, {wch: 20}
];
xlsx.utils.book_append_sheet(wb, wsDetails, '详细结果');

// 汇总统计表
const wsSummary = xlsx.utils.json_to_sheet(summary);
wsSummary['!cols'] = [{wch: 18}, {wch: 12}, {wch: 18}, {wch: 20}, {wch: 40}];
xlsx.utils.book_append_sheet(wb, wsSummary, '汇总统计');

// 使用新的命名规则生成文件名
const filename = generateReportFilename({
  count: results.length,
  type: 'full'
});

// 获取输出目录（按日期组织）
const outputDir = getOutputDir();
const excelPath = path.join(outputDir, filename);

// 保存文件
xlsx.writeFile(wb, excelPath);

console.log('✅ Excel文件已创建:', excelPath);
console.log('');
console.log('📊 查询结果摘要:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('商标              总结果    欧盟记录              关键Status');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('WIIM              28        1 (EM)                Registered ✅');
console.log('9TRANSPORT        2         2 (ES)                Registered ✅');
console.log('IMPORTACION       0         0                     Not Found');
console.log('LE-CREUSET        0         0                     Not Found');
console.log('LIFE EXTENSION    71        1 (国际注册)           International Registration in Force');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('📁 截图保存在:', path.join('/root/.openclaw/workspace/projects/wipo-trademark-batch/output', 'screenshots'));
console.log('📋 命名规范: docs/FILENAME_CONVENTION.md');
