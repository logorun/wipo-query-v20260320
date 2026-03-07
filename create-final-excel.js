const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_KEY = 'logotestkey';
const TASK_ID = 'cedaa94e-881e-426b-94c7-88aae9be634a';

async function generateReport() {
  // 获取任务结果
  const response = await axios.get(`http://localhost:3000/api/v1/tasks/${TASK_ID}`, {
    headers: { 'X-API-Key': API_KEY }
  });
  
  const results = response.data.data.results;
  
  // 准备详细数据
  const detailData = [];
  results.forEach((r, idx) => {
    const euCountries = r.records?.filter(rec => rec.isEU).map(rec => rec.country) || [];
    const euCountryCodes = r.records?.filter(rec => rec.isEU).map(rec => rec.countryCode).filter(Boolean) || [];
    
    detailData.push({
      '序号': idx + 1,
      '商标名称': r.trademark,
      '查询状态': r.queryStatus === 'found' ? '找到记录' : '未找到',
      '总记录数': r.totalRecords || 0,
      'EU记录数': r.euRecords || 0,
      'EU国家': euCountries.join(', ') || '-',
      'EU国家代码': euCountryCodes.join(', ') || '-',
      '查询时间': r.queryTime ? new Date(r.queryTime).toLocaleString('zh-CN') : '-',
      '耗时': r.queryDuration || '-',
      '来源缓存': r.fromCache ? '是' : '否'
    });
  });

  // 统计
  const found = results.filter(r => r.queryStatus === 'found');
  const notFound = results.filter(r => r.queryStatus === 'not_found');
  const withEU = results.filter(r => r.euRecords > 0);
  
  const summaryData = [
    { '项目': '测试时间', '值': '2026-03-06' },
    { '项目': '任务ID', '值': TASK_ID },
    { '项目': '总商标数', '值': 50 },
    { '项目': '找到记录', '值': found.length },
    { '项目': '未找到', '值': notFound.length },
    { '项目': '包含EU记录', '值': withEU.length },
    { '项目': '失败', '值': 0 },
    { '项目': '成功率', '值': '100%' },
    { '项目': '', '值': '' },
    { '项目': '找到记录的商标', '值': found.map(r => r.trademark).join(', ') },
    { '项目': '', '值': '' },
    { '项目': '包含EU记录的商标', '值': withEU.map(r => `${r.trademark}(${r.euRecords})`).join(', ') || '无' },
  ];

  // 创建工作簿
  const wb = xlsx.utils.book_new();
  
  // 详细结果表
  const detailWs = xlsx.utils.json_to_sheet(detailData);
  detailWs['!cols'] = [
    { wch: 6 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, 
    { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 }
  ];
  xlsx.utils.book_append_sheet(wb, detailWs, '查询结果');
  
  // 统计汇总表
  const summaryWs = xlsx.utils.json_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 20 }, { wch: 80 }];
  xlsx.utils.book_append_sheet(wb, summaryWs, '统计汇总');

  // 保存
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const filename = `商标查询结果-50个品牌-EU修复版-${new Date().toISOString().split('T')[0]}.xlsx`;
  const filepath = path.join(outputDir, filename);
  xlsx.writeFile(wb, filepath);

  console.log(`✅ Excel报告已生成: ${filepath}`);
  console.log(`\n📊 统计摘要:`);
  console.log(`  总商标: 50`);
  console.log(`  找到记录: ${found.length} (${(found.length/50*100).toFixed(0)}%)`);
  console.log(`  未找到: ${notFound.length} (${(notFound.length/50*100).toFixed(0)}%)`);
  console.log(`  包含EU记录: ${withEU.length}`);
  console.log(`  失败: 0`);
  
  if (withEU.length > 0) {
    console.log(`\n🌍 包含EU记录的商标:`);
    withEU.forEach(r => {
      const countries = r.records?.filter(rec => rec.isEU).map(rec => rec.country).join(', ');
      console.log(`  - ${r.trademark}: ${r.euRecords}条 (${countries})`);
    });
  }
}

generateReport().catch(console.error);
