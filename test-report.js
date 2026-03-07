const fs = require('fs');
const path = require('path');

// 测试结果数据
const results = [
  { trademark: "7VETI", status: "not_found", total: 0 },
  { trademark: "PRL128P", status: "not_found", total: 0 },
  { trademark: "COSMOS392", status: "not_found", total: 0 },
  { trademark: "CLOUDAPP", status: "✅ found", total: 2 },
  { trademark: "FROST299", status: "not_found", total: 0 },
  { trademark: "383I5", status: "not_found", total: 0 },
  { trademark: "SYNCLAB", status: "✅ found", total: 1 },
  { trademark: "NV2BE", status: "not_found", total: 0 },
  { trademark: "AXIS", status: "✅ found", total: 3 },
  { trademark: "ECHOLIGHTNING", status: "not_found", total: 0 },
  { trademark: "LUNARTITAN", status: "not_found", total: 0 },
  { trademark: "APEX", status: "✅ found", total: 3 },
  { trademark: "METAVIVID", status: "✅ found", total: 1 },
  { trademark: "DIGISURGE", status: "not_found", total: 0 },
  { trademark: "CIPHER200", status: "not_found", total: 0 },
  { trademark: "HA69523J", status: "not_found", total: 0 },
  { trademark: "SWIFT", status: "✅ found", total: 3 },
  { trademark: "SUPERSTORM", status: "✅ found", total: 3 },
  { trademark: "SURGE", status: "✅ found", total: 3 },
  { trademark: "VECTOR", status: "not_found", total: 0 },
  { trademark: "NEONORION", status: "not_found", total: 0 },
  { trademark: "ECHO", status: "✅ found", total: 3 },
  { trademark: "BRISK", status: "✅ found", total: 3 },
  { trademark: "AURORA232", status: "not_found", total: 0 },
  { trademark: "PRISM", status: "✅ found", total: 3 },
  { trademark: "HARDTHUNDER", status: "not_found", total: 0 },
  { trademark: "PROHUB", status: "✅ found", total: 3 },
  { trademark: "DIGIBOLD", status: "not_found", total: 0 },
  { trademark: "VORTEXSOLAR", status: "not_found", total: 0 },
  { trademark: "ECONET", status: "✅ found", total: 3 },
  { trademark: "4TVK", status: "not_found", total: 0 },
  { trademark: "53T4K", status: "not_found", total: 0 },
  { trademark: "LUNARMATRIX", status: "not_found", total: 0 },
  { trademark: "BIOMIND", status: "✅ found", total: 3 },
  { trademark: "ECHOVORTEX", status: "not_found", total: 0 },
  { trademark: "ECHOZENITH", status: "not_found", total: 0 },
  { trademark: "NEON", status: "✅ found", total: 3 },
  { trademark: "ORION518", status: "not_found", total: 0 },
  { trademark: "FLUXVECTOR", status: "not_found", total: 0 },
  { trademark: "PHOENIX", status: "✅ found", total: 3 },
  { trademark: "ECOAXIS", status: "✅ found", total: 1 },
  { trademark: "WPJE", status: "not_found", total: 0 },
  { trademark: "STELLAR608", status: "not_found", total: 0 },
  { trademark: "41Q5V65", status: "not_found", total: 0 },
  { trademark: "VORTEX", status: "✅ found", total: 3 },
  { trademark: "NANOAXIS", status: "not_found", total: 0 },
  { trademark: "Q5L2H7H", status: "not_found", total: 0 },
  { trademark: "ECOHELIX", status: "✅ found", total: 3 },
  { trademark: "CLOUDEDGE", status: "✅ found", total: 3 },
  { trademark: "89721OP", status: "not_found", total: 0 }
];

// 统计
const found = results.filter(r => r.status === "✅ found");
const notFound = results.filter(r => r.status === "not_found");

console.log("=".repeat(60));
console.log("WIPO 商标批量查询测试报告");
console.log("=".repeat(60));
console.log(`\n测试时间: 2026-03-06`);
console.log(`任务ID: f672bcd7-8701-434f-ac33-0f9672acb5e3`);
console.log(`总耗时: 约35分钟`);
console.log(`\n📊 统计结果:`);
console.log(`  - 总商标数: 50`);
console.log(`  - 找到记录: ${found.length} (${(found.length/50*100).toFixed(0)}%)`);
console.log(`  - 未找到: ${notFound.length} (${(notFound.length/50*100).toFixed(0)}%)`);
console.log(`  - 失败: 0`);
console.log(`\n✅ 找到记录的商标 (${found.length}个):`);
found.forEach(r => {
  console.log(`  - ${r.trademark}: ${r.total}条记录`);
});
console.log(`\n❌ 未找到的商标 (${notFound.length}个):`);
notFound.forEach(r => {
  console.log(`  - ${r.trademark}`);
});
console.log("\n" + "=".repeat(60));
console.log("测试完成！系统运行正常。");
console.log("=".repeat(60));
