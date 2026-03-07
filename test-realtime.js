const axios = require('axios');

const API_KEY = 'logotestkey';
const API_BASE = 'http://localhost:3000/api/v1';

const trademarks = ['ADIDAS', 'NIKE', 'APPLE', 'MICROSOFT', 'GOOGLE'];

async function testRealtimeResults() {
  console.log('Testing real-time results query\n');

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

    let previousCompleted = 0;
    
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const statusResponse = await axios.get(`${API_BASE}/tasks/${taskId}`, {
        headers: { 'X-API-Key': API_KEY }
      });

      const task = statusResponse.data.data;
      
      if (task.processingStatus && task.processingStatus.completed > previousCompleted) {
        previousCompleted = task.processingStatus.completed;
        console.log(`\n[${new Date().toLocaleTimeString()}] Progress update:`);
        console.log(`  Status: ${task.status}`);
        console.log(`  Completed: ${task.processingStatus.completed}/${trademarks.length}`);
        console.log(`  Completed trademarks: ${task.processingStatus.completedTrademarks.join(', ')}`);
        console.log(`  Pending trademarks: ${task.processingStatus.pendingTrademarks.join(', ')}`);
        console.log(`  Results available: ${task.results.length} trademarks`);
        
        if (task.results.length > 0) {
          const lastResult = task.results[task.results.length - 1];
          console.log(`  Last result: ${lastResult.trademark} - ${lastResult.queryStatus} (${lastResult.totalRecords} records)`);
        }
      }

      if (task.status === 'completed') {
        console.log('\n✅ Task completed!');
        console.log(`Total results: ${task.results.length} trademarks`);
        break;
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testRealtimeResults();
