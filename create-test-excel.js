const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const trademarks = [
  'Apple',
  'Microsoft', 
  'Google',
  'Amazon',
  'Tesla',
  'Nike',
  'Adidas',
  'Coca-Cola',
  'Pepsi',
  'Samsung',
  '华为',
  '腾讯',
  '阿里巴巴',
  '字节跳动',
  '小米'
];

const data = trademarks.map((tm, index) => ({
  '序号': index + 1,
  '商标名称': tm,
  '类别': '电子产品',
  '备注': ''
}));

const ws = xlsx.utils.json_to_sheet(data);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Trademarks');

const outputPath = path.join(__dirname, 'test-trademarks.xlsx');
xlsx.writeFile(wb, outputPath);

console.log(`Created test file: ${outputPath}`);
console.log(`Total trademarks: ${trademarks.length}`);
