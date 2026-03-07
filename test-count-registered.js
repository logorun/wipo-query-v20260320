const axios = require('axios');

const API_KEY = 'logotestkey';
const API_BASE = 'http://localhost:3000/api/v1';

async function test() {
  console.log('Testing: Check how many Registered records on first page\n');

  try {
    const submitResponse = await axios.post(
      `${API_BASE}/tasks`,
      { trademarks: ['ADIDAS'] },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        }
      }
    );

    const taskId = submitResponse.data.data.taskId;
    console.log(`Task: ${taskId}\n`);

    while (true) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await axios.get(`${API_BASE}/tasks/${taskId}`, {
        headers: { 'X-API-Key': API_KEY }
      });

      const task = statusResponse.data.data;

      if (task.status === 'completed' || task.status === 'processing') {
        if (task.results && task.results.length > 0) {
          const result = task.results[0];
          console.log(`\nStatus: ${task.status}`);
          console.log(`Total Registered records: ${result.totalRecords}`);
          console.log(`\nRecords found:`);
          result.records.forEach((rec, idx) => {
            console.log(`  ${idx + 1}. ${rec.brandName} - ${rec.status} - ${rec.country} - ${rec.regNumber}`);
          });
          
          if (task.status === 'completed') break;
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
