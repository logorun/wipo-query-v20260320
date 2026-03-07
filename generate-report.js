const axios = require('axios');
const ExcelGenerator = require('./api/src/utils/excelGenerator');
const fs = require('fs');
const path = require('path');

const API_KEY = 'logotestkey';
const API_BASE = 'http://localhost:3000/api/v1';
const TASK_ID = 'bfde3cda-36e4-4fc7-ad0b-29a0663a225f';

async function generateReport() {
  console.log('📊 Generating report for completed task...\n');
  
  try {
    const response = await axios.get(`${API_BASE}/tasks/${TASK_ID}`, {
      headers: { 'X-API-Key': API_KEY }
    });

    const task = response.data.data;
    const results = task.results;

    console.log('📋 Trademarks tested:');
    console.log(`   ${task.trademarks.join(', ')}\n`);

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];

    const excelPath = path.join(outputDir, `random-10-test-${timestamp}.xlsx`);
    const stats = ExcelGenerator.generateEnhancedReport(results, excelPath);
    console.log(`✅ Excel report saved: ${excelPath}`);
    console.log(`   Total records: ${stats.totalRecords}`);
    console.log(`   Found: ${stats.foundCount}`);
    console.log(`   With EU records: ${stats.withEUCount}\n`);

    const jsonPath = path.join(outputDir, `random-10-test-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`✅ JSON results saved: ${jsonPath}\n`);

    console.log('📈 Summary:');
    console.log(`   Total tested: ${results.length}`);
    console.log(`   Found: ${results.filter(r => r.queryStatus === 'found').length}`);
    console.log(`   Not found: ${results.filter(r => r.queryStatus === 'not_found').length}`);
    console.log(`   Errors: ${results.filter(r => r.queryStatus === 'error').length}`);
    console.log(`   With EU records: ${results.filter(r => r.euRecords > 0).length}\n`);

    console.log('🎉 Report generation completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateReport();
