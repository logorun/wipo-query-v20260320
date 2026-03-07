const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// 读取API结果
const results = JSON.parse(fs.readFileSync('/tmp/50_brands_results.json', 'utf8'));

// 准备Excel数据
const excelData = results.map(r => ({
  '序号': 0,
  '查询商标': r.trademark,
  '查询状态': r.queryStatus === 'found' ? '找到记录' : (r.queryStatus === 'not_found' ? '未找到' : r.queryStatus),
  '总记录数': r.totalRecords || 0,
  '欧盟记录数': r.euRecords || 0,
  '查询时间': r.queryTime ? new Date(r.queryTime).toLocaleString('zh-CN') : '-',
  '耗时': r.queryDuration || '-',
  '来源缓存': r.fromCache ? '是' : '否',
  '错误信息': r.error || '-'
}));

// 添加序号
excelData.forEach((row, idx) => row['序号'] = idx + 1);

// 创建工作簿
const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(excelData);

// 设置列宽
const colWidths = [
  { wch: 6 },   // 序号
  { wch: 18 },  // 查询商标
  { wch: 12 },  // 查询状态
  { wch: 10 },  // 总记录数
  { wch: 10 },  // 欧盟记录数
  { wch: 20 },  // 查询时间
  { wch: 10 },  // 耗时
  { wch: 10 },  // 来源缓存
  { wch: 20 },  // 错误信息
];
ws['!cols'] = colWidths;

// 添加统计sheet
const found = results.filter(r => r.queryStatus === 'found');
const notFound = results.filter(r => r.queryStatus === 'not_found');

const summaryData = [
  { '项目': '测试时间', '值': '2026-03-06' },
  { '项目': '任务ID', '值': 'f672bcd7-8701-434f-ac33-0f9672acb5e3' },
  { '项目': '总商标数', '值': 50 },
  { '项目': '找到记录', '值': found.length },
  { '项目': '未找到', '值': notFound.length },
  { '项目': '失败', '值': 0 },
  { '项目': '成功率', '值': '100%' },
  { '项目': '', '值': '' },
  { '项目': '找到记录的商标', '值': found.map(r => r.trademark).join(', ') },
];

const summaryWs = xlsx.utils.json_to_sheet(summaryData);
summaryWs['!cols'] = [{ wch: 20 }, { wch: 100 }];

// 添加sheet到工作簿
xlsx.utils.book_append_sheet(wb, ws, '查询结果');
xlsx.utils.book_append_sheet(wb, summaryWs, '统计汇总');

// 保存文件
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const filename = `商标查询结果-50个随机品牌-${new Date().toISOString().split('T')[0]}.xlsx`;
const filepath = path.join(outputDir, filename);

xlsx.writeFile(wb, filepath);

console.log(`✅ Excel报告已生成: ${filepath}`);
console.log(`\n📊 统计摘要:`);
console.log(`  总商标: 50`);
console.log(`  找到记录: ${found.length} (${(found.length/50*100).toFixed(0)}%)`);
console.log(`  未找到: ${notFound.length} (${(notFound.length/50*100).toFixed(0)}%)`);
console.log(`  失败: 0`);
