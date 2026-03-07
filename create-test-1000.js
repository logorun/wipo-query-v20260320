const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const trademarks = [];
const prefixes = ['Tech', 'Smart', 'Global', 'Ultra', 'Pro', 'Max', 'Super', 'Mega', 'Hyper', 'Meta'];
const suffixes = ['Corp', 'Inc', 'Ltd', 'Group', 'Solutions', 'Systems', 'Labs', 'Digital', 'Tech', 'Cloud'];
const words = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Sigma', 'Omega', 'Neo', 'Zen', 'Core', 'Prime', 'Nova', 'Apex', 'Flux', 'Sync', 'Pulse'];

for (let i = 1; i <= 1000; i++) {
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const word = words[Math.floor(Math.random() * words.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  const num = Math.floor(Math.random() * 9999);
  
  const trademark = `${prefix}${word}${suffix}${num}`;
  trademarks.push(trademark);
}

const data = trademarks.map((tm, index) => ({
  '序号': index + 1,
  '商标名称': tm
}));

const ws = xlsx.utils.json_to_sheet(data);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Trademarks');

const outputPath = path.join(__dirname, 'test-1000-trademarks.xlsx');
xlsx.writeFile(wb, outputPath);

console.log(`Created test file: ${outputPath}`);
console.log(`Total trademarks: ${trademarks.length}`);
console.log('First 5:', trademarks.slice(0, 5).join(', '));
console.log('Last 5:', trademarks.slice(-5).join(', '));
