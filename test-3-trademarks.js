const axios = require('axios');
const ExcelGenerator = require('./api/src/utils/excelGenerator');
const fs = require('fs');
const path = require('path');

const API_KEY = 'logotestkey';
const API_BASE = 'http://localhost:3000/api/v1';

const TEST_TRADEMARKS = ['WIIM', '9TRANSPORT', 'ADIDAS'];

async function testTrademarks() {
  console.log('🧪 Testing trademark query with enhanced fields\n');
  console.log(`📋 Test trademarks: ${TEST_TRADEMARKS.join(', ')}\n`);

  try {
    console.log('📤 Submitting test task...');
    const submitResponse = await axios.post(
      `${API_BASE}/tasks`,
      { trademarks: TEST_TRADEMARKS },
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
      const status = task.status;
      const progress = task.progress || {};

      console.log(`  [${attempts + 1}/${maxAttempts}] Status: ${status}, ` +
                  `Progress: ${progress.processed || 0}/${progress.total || TEST_TRADEMARKS.length}`);

      if (status === 'completed') {
        console.log('\n✅ Task completed!\n');
        return task;
      } else if (status === 'failed') {
        console.log('\n❌ Task failed!\n');
        console.log('Error:', task.error);
        process.exit(1);
      }

      attempts++;
    }

    console.log('\n⏱️  Timeout: Task did not complete in time\n');
    process.exit(1);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

function analyzeResults(results) {
  console.log('📊 Results Analysis:\n');

  results.forEach((result, idx) => {
    console.log(`${idx + 1}. ${result.trademark}`);
    console.log(`   Status: ${result.queryStatus}`);
    console.log(`   Total records: ${result.totalRecords}`);
    console.log(`   EU records: ${result.euRecords}`);
    console.log(`   Extraction method: ${result.extractionMethod || 'regex'}`);
    console.log(`   Duration: ${result.queryDuration}`);

    if (result.records && result.records.length > 0) {
      console.log(`   Sample record:`);
      const sample = result.records[0];
      console.log(`     - Brand: ${sample.brandName}`);
      console.log(`     - Owner: ${sample.owner || 'N/A'}`);
      console.log(`     - Country: ${sample.country || sample.countryOfFiling || 'N/A'}`);
      console.log(`     - Country Code: ${sample.countryCode || 'N/A'}`);
      console.log(`     - Status: ${sample.status}`);
      console.log(`     - Reg Number: ${sample.registrationNumber || sample.regNumber || 'N/A'}`);
      console.log(`     - Reg Date: ${sample.registrationDate || sample.regDate || 'N/A'}`);
      console.log(`     - Nice Classes: ${(sample.niceClasses || []).join(', ') || 'N/A'}`);
      console.log(`     - Is EU: ${sample.isEU}`);
      console.log(`     - Is International: ${sample.isInternational || false}`);
    }
    console.log();
  });

  const found = results.filter(r => r.queryStatus === 'found');
  const withEU = results.filter(r => r.euRecords > 0);

  console.log('📈 Summary:');
  console.log(`  Total tested: ${results.length}`);
  console.log(`  Found: ${found.length}`);
  console.log(`  Not found: ${results.length - found.length}`);
  console.log(`  With EU records: ${withEU.length}`);

  if (withEU.length > 0) {
    console.log(`\n🌍 Trademarks with EU records:`);
    withEU.forEach(r => {
      const euCountries = r.records
        .filter(rec => rec.isEU)
        .map(rec => rec.countryCode || rec.country)
        .join(', ');
      console.log(`  - ${r.trademark}: ${r.euRecords} records (${euCountries})`);
    });
  }
}

function generateReport(results) {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];

  const excelPath = path.join(outputDir, `test-results-${timestamp}.xlsx`);
  const stats = ExcelGenerator.generateEnhancedReport(results, excelPath);
  console.log(`\n✅ Excel report: ${excelPath}`);
  console.log(`   Rows: ${stats.totalRecords}, Found: ${stats.foundCount}, With EU: ${stats.withEUCount}`);

  const jsonPath = path.join(outputDir, `test-results-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`✅ JSON results: ${jsonPath}\n`);
}

async function main() {
  const task = await testTrademarks();
  const results = task.results;

  analyzeResults(results);
  generateReport(results);

  console.log('✅ Test completed successfully!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
