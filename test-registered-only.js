const axios = require('axios');
const ExcelGenerator = require('./api/src/utils/excelGenerator');
const fs = require('fs');
const path = require('path');

const API_KEY = 'logotestkey';
const API_BASE = 'http://localhost:3000/api/v1';

const trademarks = ['ADIDAS'];

async function test() {
  console.log('Testing: Only Registered status records\n');

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
    console.log(`Task submitted: ${taskId}\n`);

    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await axios.get(`${API_BASE}/tasks/${taskId}`, {
        headers: { 'X-API-Key': API_KEY }
      });

      const task = statusResponse.data.data;

      if (task.status === 'completed') {
        console.log('\n✅ Task completed!\n');
        
        const result = task.results[0];
        console.log(`📊 ${result.trademark}:`);
        console.log(`   Total records: ${result.totalRecords}`);
        console.log(`   Records with Registered status:\n`);
        
        result.records.forEach((rec, idx) => {
          console.log(`   ${idx + 1}. Status: "${rec.status}"`);
          console.log(`      Date: "${rec.statusDate}"`);
          console.log(`      Country: ${rec.country}`);
          console.log(`      RegNumber: ${rec.regNumber}\n`);
        });
        
        return;
      }

      attempts++;
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

test();
