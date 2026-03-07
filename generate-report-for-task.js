const axios = require('axios');
const ExcelGenerator = require('./api/src/utils/excelGenerator');
const fs = require('fs');
const path = require('path');

const API_KEY = 'logotestkey';
const API_BASE = 'http://localhost:3000/api/v1';
const TASK_ID = process.argv[2] || 'a45d0842-7b7c-4293-bd21-1bfdf9961d79';

async function generateReport() {
  console.log('📊 Generating report for task:', TASK_ID);
  
  try {
    const response = await axios.get(`${API_BASE}/tasks/${TASK_ID}`, {
      headers: { 'X-API-Key': API_KEY }
    });

    const task = response.data.data;
    
    if (task.status !== 'completed') {
      console.log(`⏳ Task not completed yet. Status: ${task.status}`);
      process.exit(1);
    }
    
    const results = task.results;

    console.log('\n📋 Trademarks tested:');
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
    console.log(`   With EU records: ${results.filter(r => r.euRecords > 0).length}`);
    console.log(`   With Europe records: ${results.filter(r => r.records.some(rec => rec.isEurope)).length}\n`);

    const found = results.filter(r => r.queryStatus === 'found');
    if (found.length > 0) {
      console.log('✅ Found trademarks with Status and Date:');
      found.forEach(r => {
        console.log(`\n   ${r.trademark}:`);
        r.records.forEach(rec => {
          console.log(`     - Status: "${rec.status || 'N/A'}" | Date: "${rec.statusDate || 'N/A'}" | EU: ${rec.isEU} | Europe: ${rec.isEurope} | Country: ${rec.country}`);
        });
      });
    }

    console.log('\n🎉 Report generation completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateReport();
