require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const trademark = process.argv[2] || 'ADIDAS';

async function debugQuery() {
  console.log(`🔍 Debugging trademark: ${trademark}\n`);
  
  try {
    console.log('Step 1: Opening page...');
    execSync('agent-browser open "https://branddb.wipo.int/en/advancedsearch" --json', { 
      encoding: 'utf-8', 
      timeout: 60000 
    });
    await sleep(10000);
    
    console.log('Step 2: Getting snapshot...');
    let snapshot = execSync('agent-browser snapshot', { 
      encoding: 'utf-8', 
      timeout: 15000 
    });
    
    console.log('Step 3: Setting search strategy...');
    execSync('agent-browser select "e39" "is matching exact expression"', { 
      encoding: 'utf-8', 
      timeout: 30000 
    });
    await sleep(2000);
    
    console.log('Step 4: Entering trademark...');
    execSync(`agent-browser fill "e45" "${trademark}"`, { 
      encoding: 'utf-8', 
      timeout: 30000 
    });
    await sleep(1000);
    
    console.log('Step 5: Clicking search...');
    execSync('agent-browser click "e10"', { 
      encoding: 'utf-8', 
      timeout: 30000 
    });
    await sleep(15000);
    
    console.log('Step 6: Getting results snapshot...');
    snapshot = execSync('agent-browser snapshot', { 
      encoding: 'utf-8', 
      timeout: 30000 
    });
    
    console.log('\n=== SNAPSHOT CONTENT (first 3000 chars) ===');
    console.log(snapshot.substring(0, 3000));
    console.log('\n=== END OF SNAPSHOT PREVIEW ===\n');
    
    fs.writeFileSync(`/tmp/${trademark}-snapshot.txt`, snapshot);
    console.log(`✅ Full snapshot saved to: /tmp/${trademark}-snapshot.txt`);
    
    const statusMatch = snapshot.match(/Status\s+([A-Za-z\s]+)(?:\s*\(([^)]+)\))?/i);
    console.log('\n=== STATUS EXTRACTION ===');
    console.log('Status match:', statusMatch);
    if (statusMatch) {
      console.log('Status:', statusMatch[1]);
      console.log('Date:', statusMatch[2]);
    }
    
    const countryMatch = snapshot.match(/Country of filing\s+([A-Za-z\s,()]+?)(?:\s+Status|$)/i);
    console.log('\n=== COUNTRY EXTRACTION ===');
    console.log('Country match:', countryMatch);
    if (countryMatch) {
      console.log('Country:', countryMatch[1]);
    }
    
    execSync('agent-browser close', { encoding: 'utf-8', timeout: 10000 });
    
  } catch (error) {
    console.error('Error:', error.message);
    try {
      execSync('agent-browser close', { encoding: 'utf-8', timeout: 10000 });
    } catch (e) {}
  }
}

debugQuery();
