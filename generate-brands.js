#!/usr/bin/env node
/**
 * 生成50个随机品牌名用于WIPO测试
 * 包含不同类型的商标：英文单词、组合词、数字+字母、纯字母等
 */

const crypto = require('crypto');

// 常见前缀/后缀词根
const PREFIXES = [
  'Nova', 'Tech', 'Bio', 'Eco', 'Smart', 'Pro', 'Ultra', 'Mega', 'Super', 'Hyper',
  'Cyber', 'Data', 'Cloud', 'Nano', 'Meta', 'Auto', 'Flex', 'Sync', 'Stream', 'Link',
  'Net', 'Web', 'Digi', 'Info', 'Code', 'Dev', 'App', 'Soft', 'Hard', 'Net'
];

const SUFFIXES = [
  'Pro', 'Max', 'Plus', 'Lab', 'Hub', 'Box', 'Net', 'Web', 'App', 'Sys',
  'Tech', 'Soft', 'Ware', 'Data', 'Base', 'Port', 'Link', 'Zone', 'Star', 'Bit',
  'Verse', 'Flow', 'Mind', 'Core', 'Wave', 'Pulse', 'Spark', 'Edge', 'Peak', 'Rise'
];

// 完整单词
const WORDS = [
  'Phoenix', 'Orion', 'Titan', 'Nexus', 'Vortex', 'Helix', 'Matrix', 'Vertex', 'Axis', 'Prism',
  'Quantum', 'Cosmos', 'Stellar', 'Lunar', 'Solar', 'Aurora', 'Neon', 'Flux', 'Zenith', 'Apex',
  'Cipher', 'Vector', 'Nebula', 'Pulse', 'Spark', 'Drift', 'Surge', 'Echo', 'Vivid', 'Brisk',
  'Swift', 'Bold', 'Crisp', 'Witty', 'Zesty', 'Frost', 'Blaze', 'Storm', 'Thunder', 'Lightning'
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateBrandName() {
  const type = randomInt(1, 6);
  
  switch(type) {
    case 1: // 前缀+后缀组合
      return randomElement(PREFIXES) + randomElement(SUFFIXES);
    
    case 2: // 完整单词
      return randomElement(WORDS);
    
    case 3: // 前缀+单词
      return randomElement(PREFIXES) + randomElement(WORDS);
    
    case 4: // 单词+数字
      return randomElement(WORDS) + randomInt(1, 999);
    
    case 5: // 字母+数字组合 (4-8位)
      const length = randomInt(4, 8);
      let result = '';
      for (let i = 0; i < length; i++) {
        if (Math.random() > 0.5) {
          result += String.fromCharCode(65 + randomInt(0, 25)); // A-Z
        } else {
          result += randomInt(0, 9);
        }
      }
      return result;
    
    case 6: // 两个单词组合
      const w1 = randomElement(WORDS);
      const w2 = randomElement(WORDS);
      return w1 === w2 ? w1 + randomElement(SUFFIXES) : w1 + w2;
  }
}

// 生成50个唯一的品牌名
const brands = new Set();
while (brands.size < 50) {
  brands.add(generateBrandName());
}

// 输出JSON格式
const output = {
  count: brands.size,
  brands: Array.from(brands),
  generated: new Date().toISOString()
};

console.log(JSON.stringify(output, null, 2));
