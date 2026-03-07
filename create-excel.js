const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// 查询结果数据
const results = [
  // WIIM - 欧盟结果
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
  // 9TRANSPORT - 西班牙结果 (2条)
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
  // LIFE EXTENSION - 欧盟结果 (2条示例)
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'Life Extension',
    '完整名称': 'Life Extension Owner Laboratoires FORTE PHARMA S.A.M. (Monaco)',
    '状态': 'Ended',
    '国家/地区': 'France (FR)',
    '注册号': '99798072',
    '注册日期': '1999-07-23',
    '类别': 'Nice class 3, 5, 29, 30',
    '来源': 'WIPO Brand Database'
  },
  {
    '查询商标': 'LIFE EXTENSION',
    '商标名称': 'LIFE EXTENSION',
    '完整名称': 'LIFE EXTENSION Owner Kommanditgesellschaft M.P. Farm Projektierungs und Management GmbH & Co. (Germany)',
    '状态': 'Expired',
    '国家/地区': 'Germany (DE)',
    '注册号': '39734223',
    '注册日期': '2007-07-31',
    '类别': 'Nice class 5',
    '来源': 'WIPO Brand Database'
  }
];

// 创建汇总统计
const summary = [
  { '商标': 'WIIM', '总结果数': 28, '欧盟结果数': 1, '非欧盟国家': 'NO, JP, US...' },
  { '商标': '9TRANSPORT', '总结果数': 2, '欧盟结果数': 2, '非欧盟国家': '无' },
  { '商标': 'IMPORTACION', '总结果数': 0, '欧盟结果数': 0, '非欧盟国家': '-' },
  { '商标': 'LE-CREUSET', '总结果数': 0, '欧盟结果数': 0, '非欧盟国家': '-' },
  { '商标': 'LIFE EXTENSION', '总结果数': 71, '欧盟结果数': '2+', '非欧盟国家': 'USA, TH, UK, SG, MY, CA, AU, BR, UAE...' }
];

// 创建工作簿
const wb = xlsx.utils.book_new();

// 详细结果表
const wsDetails = xlsx.utils.json_to_sheet(results);
wsDetails['!cols'] = [
  {wch: 20}, {wch: 20}, {wch: 60}, {wch: 15}, 
  {wch: 25}, {wch: 15}, {wch: 15}, {wch: 25}, {wch: 20}
];
xlsx.utils.book_append_sheet(wb, wsDetails, '详细结果');

// 汇总统计表
const wsSummary = xlsx.utils.json_to_sheet(summary);
wsSummary['!cols'] = [{wch: 20}, {wch: 12}, {wch: 12}, {wch: 40}];
xlsx.utils.book_append_sheet(wb, wsSummary, '汇总统计');

// 保存文件
const outputDir = '/root/.openclaw/workspace/projects/wipo-trademark-batch/output';
const excelPath = path.join(outputDir, '商标查询结果-5个商标.xlsx');
xlsx.writeFile(wb, excelPath);

console.log('✅ Excel文件已创建:', excelPath);
console.log('📊 共查询 5 个商标');
console.log('📁 截图保存在:', path.join(outputDir, 'screenshots'));
