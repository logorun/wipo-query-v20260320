#!/usr/bin/env node
/**
 * 生成50个随机品牌名（确保与之前不同）
 */

const crypto = require('crypto');

const PREFIXES = ['Nova', 'Tech', 'Bio', 'Eco', 'Smart', 'Pro', 'Ultra', 'Mega', 'Hyper', 'Cyber', 'Data', 'Cloud', 'Nano', 'Meta', 'Auto', 'Flex', 'Sync', 'Stream', 'Link', 'Net', 'Web', 'Digi', 'Info', 'Code', 'Dev', 'App', 'Soft', 'Hard'];
const SUFFIXES = ['Pro', 'Max', 'Plus', 'Lab', 'Hub', 'Box', 'Net', 'Web', 'App', 'Sys', 'Tech', 'Soft', 'Ware', 'Base', 'Port', 'Zone', 'Star', 'Bit', 'Verse', 'Flow', 'Mind', 'Core', 'Wave', 'Pulse', 'Spark', 'Edge', 'Peak', 'Rise'];
const WORDS = ['Phoenix', 'Orion', 'Titan', 'Nexus', 'Vortex', 'Helix', 'Matrix', 'Vertex', 'Prism', 'Quantum', 'Cosmos', 'Stellar', 'Lunar', 'Solar', 'Aurora', 'Nebula', 'Zenith', 'Apex', 'Cipher', 'Vector', 'Flux', 'Drift', 'Surge', 'Echo', 'Vivid', 'Brisk', 'Swift', 'Bold', 'Crisp', 'Frost', 'Blaze', 'Storm', 'Thunder'];

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

// 旧的50个商标（避免重复）
const oldBrands = new Set([
  "7VETI", "PRL128P", "Cosmos392", "CloudApp", "Frost299", "383I5", "SyncLab", "NV2BE", "Axis", "EchoLightning",
  "LunarTitan", "Apex", "MetaVivid", "DigiSurge", "Cipher200", "HA69523J", "Swift", "SuperStorm", "Surge", "Vector",
  "NeonOrion", "Echo", "Brisk", "Aurora232", "Prism", "HardThunder", "ProHub", "DigiBold", "VortexSolar", "EcoNet",
  "4TVK", "53T4K", "LunarMatrix", "BioMind", "EchoVortex", "EchoZenith", "Neon", "Orion518", "FluxVector", "Phoenix",
  "EcoAxis", "WPJE", "Stellar608", "41Q5V65", "Vortex", "NanoAxis", "Q5L2H7H", "EcoHelix", "CloudEdge", "89721OP"
]);

// 生成50个新的唯一品牌名
const brands = new Set();
while (brands.size < 50) {
  const brand = generateBrandName();
  if (!oldBrands.has(brand)) {
    brands.add(brand);
  }
}

const output = {
  count: brands.size,
  brands: Array.from(brands),
  generated: new Date().toISOString()
};

console.log(JSON.stringify(output, null, 2));
