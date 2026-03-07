const parseSnapshot = (snapshot, trademark) => {
  const records = [];
  
  if (!snapshot || typeof snapshot !== 'string') {
    console.log('Empty or invalid snapshot', { trademark });
    return records;
  }

  const lines = snapshot.split('\n');
  const resultMatch = snapshot.match(/Displaying\s*\d+-\d+\s*of\s*(\d+)/i);
  const totalResults = resultMatch ? parseInt(resultMatch[1]) : 0;

  if (totalResults === 0) {
    return records;
  }

  console.log(`Parsing ${totalResults} total results`, { trademark });

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    const brandMatch = line.match(/text:\s*([^,]+?)\s*Owner/i);
    if (brandMatch) {
      const brandName = brandMatch[1].trim();
      
      if (brandName.toUpperCase() === trademark.toUpperCase()) {
        console.log(`Found match for ${trademark} at line ${i}`);
        const record = extractRecord(lines, i, trademark);
        console.log('Extracted record:', JSON.stringify(record, null, 2));
        if (record) {
          records.push(record);
        }
      }
    }
    i++;
  }

  return records;
};

const extractRecord = (lines, startIndex, trademark) => {
  const record = {
    brandName: trademark,
    owner: '',
    status: '',
    statusDate: '',
    country: '',
    countryCode: '',
    regNumber: '',
    regDate: '',
    niceClasses: [],
    isEU: false,
    isEurope: false,
    isInternational: false,
    designatedCountries: []
  };

  for (let j = startIndex; j < Math.min(startIndex + 50, lines.length); j++) {
    const line = lines[j];
    
    if (j > startIndex + 5 && line.match(/text:\s*[^,]+?\s*Owner/i)) {
      break;
    }

    const statusWithDateMatch = line.match(/(Registered|Expired|Pending|Refused|Withdrawn)\s*\(([^)]+)\)/i);
    if (statusWithDateMatch && !record.status) {
      console.log(`Status match at line ${j}:`, statusWithDateMatch[0]);
      record.status = statusWithDateMatch[1].trim();
      record.statusDate = statusWithDateMatch[2].trim();
      if (record.status.toLowerCase().includes('international')) {
        record.isInternational = true;
      }
    }

    const regMatch = line.match(/(?:Registration\s+)?Number[\s:]+([A-Z0-9\-\/]+)/i);
    if (regMatch && !record.regNumber) {
      record.regNumber = regMatch[1].trim();
    }
  }

  return record;
};

const fs = require('fs');
const snapshot = fs.readFileSync('/tmp/ADIDAS-snapshot.txt', 'utf-8');
console.log('Snapshot length:', snapshot.length);
console.log('\nTesting parseSnapshot...\n');

const records = parseSnapshot(snapshot, 'ADIDAS');
console.log('\n\nFinal records:', JSON.stringify(records, null, 2));
