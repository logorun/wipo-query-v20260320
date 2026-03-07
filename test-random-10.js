const axios = require('axios');
const ExcelGenerator = require('./api/src/utils/excelGenerator');
const fs = require('fs');
const path = require('path');

const API_KEY = 'logotestkey';
const API_BASE = 'http://localhost:3000/api/v1';

const PREFIXES = ['Nova', 'Tech', 'Bio', 'Eco', 'Smart', 'Pro', 'Ultra', 'Mega', 'Hyper', 'Cyber', 'Data', 'Cloud', 'Nano', 'Meta', 'Auto', 'Flex', 'Sync', 'Stream', 'Link', 'Net'];
const SUFFIXES = ['Pro', 'Max', 'Plus', 'Lab', 'Hub', 'Box', 'Net', 'Web', 'App', 'Sys', 'Tech', 'Soft', 'Ware', 'Base', 'Port', 'Zone', 'Star', 'Bit', 'Verse', 'Flow'];
const WORDS = ['Phoenix', 'Orion', 'Titan', 'Nexus', 'Vortex', 'Helix', 'Matrix', 'Vertex', 'Prism', 'Quantum', 'Cosmos', 'Stellar', 'Lunar', 'Solar', 'Aurora', 'Nebula', 'Zenith', 'Apex', 'Cipher', 'Vector'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateBrandName() {
  const type = randomInt(1, 6);
  
  switch(type) {
    case 1: return randomElement(PREFIXES) + randomElement(SUFFIXES);
    case 2: return randomElement(WORDS);
    case 3: return randomElement(PREFIXES) + randomElement(WORDS);
    case 4: return randomElement(WORDS) + randomInt(1, 999);
    case 5: 
      let result = '';
      for (let i = 0; i < randomInt(4, 8); i++) {
        result += Math.random() > 0.5 ? String.fromCharCode(65 + randomInt(0, 25)) : randomInt(0, 9);
      }
      return result;
    case 6: 
      const w1 = randomElement(WORDS);
      const w2 = randomElement(WORDS);
      return w1 === w2 ? w1 + randomElement(SUFFIXES) : w1 + w2;
  }
}

function generateBrands(count) {
  const brands = new Set();
  while (brands.size < count) {
    brands.add(generateBrandName());
  }
  return Array.from(brands);
}

async function testWorker() {
  const trademarks = generateBrands(10);
  
  console.log('🧪 Testing worker with 10 random trademarks\n');
  console.log(`📋 Trademarks: ${trademarks.join(', ')}\n`);

  try {
    console.log('📤 Submitting test task...');
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
    const maxAttempts = 120;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await axios.get(`${API_BASE}/tasks/${taskId}`, {
        headers: { 'X-API-Key': API_KEY }
      });

      const task = statusResponse.data.data;
      const status = task.status;
      const progress = task.progress || {};

      console.log(`  [${attempts + 1}/${maxAttempts}] Status: ${status}, ` +
                  `Progress: ${progress.processed || 0}/${progress.total || 10}`);

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

  const found = results.filter(r => r.queryStatus === 'found');
  const notFound = results.filter(r => r.queryStatus === 'not_found');
  const errors = results.filter(r => r.queryStatus === 'error');
  const withEU = results.filter(r => r.euRecords > 0);

  console.log('📈 Summary:');
  console.log(`  Total tested: ${results.length}`);
  console.log(`  Found: ${found.length}`);
  console.log(`  Not found: ${notFound.length}`);
  console.log(`  Errors: ${errors.length}`);
  console.log(`  With EU records: ${withEU.length}\n`);

  if (found.length > 0) {
    console.log('✅ Found trademarks:');
    found.forEach(r => {
      const countries = r.records
        .filter(rec => rec.isEU)
        .map(rec => rec.countryCode || rec.country)
        .join(', ');
      console.log(`  - ${r.trademark}: ${r.totalRecords} records ${countries ? `(${countries})` : ''}`);
    });
    console.log();
  }

  if (withEU.length > 0) {
    console.log('🌍 Trademarks with EU records:');
    withEU.forEach(r => {
      const euCountries = r.records
        .filter(rec => rec.isEU)
        .map(rec => rec.countryCode || rec.country)
        .join(', ');
      console.log(`  - ${r.trademark}: ${r.euRecords} EU records (${euCountries})`);
    });
    console.log();
  }

  if (notFound.length > 0) {
    console.log('❓ Not found trademarks:');
    console.log(`  ${notFound.map(r => r.trademark).join(', ')}\n`);
  }

  if (errors.length > 0) {
    console.log('⚠️  Errors:');
    errors.forEach(r => {
      console.log(`  - ${r.trademark}: ${r.error || 'Unknown error'}`);
    });
    console.log();
  }
}

function generateReport(results) {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];

  const excelPath = path.join(outputDir, `random-10-test-${timestamp}.xlsx`);
  const stats = ExcelGenerator.generateEnhancedReport(results, excelPath);
  console.log(`✅ Excel report: ${excelPath}`);
  console.log(`   Rows: ${stats.totalRecords}, Found: ${stats.foundCount}, With EU: ${stats.withEUCount}`);

  const jsonPath = path.join(outputDir, `random-10-test-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`✅ JSON results: ${jsonPath}\n`);
}

async function main() {
  const task = await testWorker();
  const results = task.results;

  analyzeResults(results);
  generateReport(results);

  console.log('✅ Test completed successfully!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
