const axios = require('axios');
const ExcelGenerator = require('./api/src/utils/excelGenerator');
const fs = require('fs');
const path = require('path');

const API_KEY = 'logotestkey';
const API_BASE = 'http://localhost:3000/api/v1';

const trademarks = ['ADIDAS', 'NEXUS'];

async function test() {
  console.log('🧪 Testing enhanced data extraction\n');
  console.log(`📋 Testing: ${trademarks.join(', ')}\n`);

  try {
    const submitResponse = await axios.post(
      `${API_BASE}/tasks`,
      { trademarks },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        }
      }
    );

    const taskId = submitResponse.data.data.taskId;
    console.log(`✅ Task submitted: ${taskId}\n`);
    console.log('⏳ Waiting for task to complete...');

    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await axios.get(`${API_BASE}/tasks/${taskId}`, {
        headers: { 'X-API-Key': API_KEY }
      });

      const task = statusResponse.data.data;
      const progress = task.progress || {};

      console.log(`  [${attempts + 1}/${maxAttempts}] Progress: ${progress.processed || 0}/${progress.total || trademarks.length}`);

      if (task.status === 'completed') {
        console.log('\n✅ Task completed!\n');
        
        const outputDir = path.join(__dirname, 'output');
        const timestamp = new Date().toISOString().split('T')[0];
        const excelPath = path.join(outputDir, `enhanced-test-${timestamp}.xlsx`);
        
        ExcelGenerator.generateEnhancedReport(task.results, excelPath);
        console.log(`✅ Excel report saved: ${excelPath}\n`);
        
        task.results.forEach(result => {
          console.log(`📊 ${result.trademark}:`);
          console.log(`   Status: ${result.queryStatus}`);
          console.log(`   Records: ${result.totalRecords}`);
          result.records.forEach(rec => {
            console.log(`   - ${rec.brandName}: Status="${rec.status}" | Date="${rec.statusDate}" | EU=${rec.isEU} | Europe=${rec.isEurope} | Country=${rec.country}`);
          });
          console.log();
        });
        
        return;
      } else if (task.status === 'failed') {
        console.log('\n❌ Task failed!\n');
        process.exit(1);
      }

      attempts++;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();
