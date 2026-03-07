const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const API_KEY = 'logotestkey';
const TASK_ID = 'd68f1429-ebc2-4cbe-aebe-1aaaa802303f';

async function generateReport() {
  const response = await axios.get(`http://localhost:3000/api/v1/tasks/${TASK_ID}`, {
    headers: { 'X-API-Key': API_KEY }
  });
  
  const results = response.data.data.results;
  
  const detailData = [];
  results.forEach((r, idx) => {
    const euRecords = r.records?.filter(rec => rec.isEU) || [];
    const euCountries = euRecords.map(rec => `${rec.country}(${rec.countryCode})`).join(', ') || '-';
    
    detailData.push({
      '序号': idx + 1,
      '商标名称': r.trademark,
      '查询状态': r.queryStatus === 'found' ? '找到记录' : '未找到',
      '总记录数': r.totalRecords || 0,
      'EU记录数': r.euRecords || 0,
      'EU国家': euCountries,
      '查询时间': r.queryTime ? new Date(r.queryTime).toLocaleString('zh-CN') : '-',
      '耗时': r.queryDuration || '-'
    });
  });

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
    { '项目': '', '值': '' },
    { '项目': '找到记录的商标', '值': found.map(r => r.trademark).join(', ') },
    { '项目': '', '值': '' },
    { '项目': '包含EU记录的商标', '值': withEU.map(r => `${r.trademark}(${r.euRecords})`).join(', ') },
  ];

  const wb = xlsx.utils.book_new();
  
  const detailWs = xlsx.utils.json_to_sheet(detailData);
  detailWs['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, 
    { wch: 10 }, { wch: 40 }, { wch: 20 }, { wch: 10 }
  ];
  xlsx.utils.book_append_sheet(wb, detailWs, '查询结果');
  
  const summaryWs = xlsx.utils.json_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 20 }, { wch: 80 }];
  xlsx.utils.book_append_sheet(wb, summaryWs, '统计汇总');

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  const filename = `商标查询结果-50个新品牌-最终版-${new Date().toISOString().split('T')[0]}.xlsx`;
  const filepath = path.join(outputDir, filename);
  xlsx.writeFile(wb, filepath);

  console.log(`✅ Excel报告已生成: ${filepath}`);
  console.log(`\n📊 统计摘要:`);
  console.log(`  总商标: 50`);
  console.log(`  找到记录: ${found.length} (${(found.length/50*100).toFixed(0)}%)`);
  console.log(`  未找到: ${notFound.length} (${(notFound.length/50*100).toFixed(0)}%)`);
  console.log(`  包含EU记录: ${withEU.length}`);
  
  console.log(`\n🌍 包含EU记录的商标:`);
  withEU.forEach(r => {
    const countries = r.records?.filter(rec => rec.isEU).map(rec => `${rec.country}(${rec.countryCode})`).join(', ');
    console.log(`  - ${r.trademark}: ${r.euRecords}条 (${countries})`);
  });
}

generateReport().catch(console.error);
