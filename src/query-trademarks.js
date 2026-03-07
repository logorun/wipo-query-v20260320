const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// ==================== 配置区域 ====================
const CONFIG = {
  // 搜索配置
  maxResultsPerTrademark: 20,  // 每个商标最多获取结果数
  retryAttempts: 3,            // 失败重试次数
  retryDelay: 5000,            // 重试间隔(ms)
  queryDelay: 3000,            // 商标间查询间隔(ms)
  
  // 国家筛选 - 仅限欧盟
  euCountries: ['EM', 'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
                'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 
                'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
  
  // 缓存配置
  cacheFile: path.join(__dirname, '..', 'output', 'query-cache.json'),
  enableCache: true,
  
  // 断点续传
  progressFile: path.join(__dirname, '..', 'output', 'progress.json'),
  enableResume: true
};

// 商标列表
const trademarks = [
  'OEMG', 'AB3001EUS', 'CNRSRS', 'HOOXSPEED', '9TRANSPORT', 'COULEUR', 'TEGOLE',
  'OUTRAS MARCAS', 'IMPORTACION', 'ABEJAR', 'SILVER', 'LAST LEVELP25', 'MOOSEP25',
  'CLAPPIO', 'MODELLO SCONOSCIUTO', 'GENERIQUE', 'TOILINUX', 'OPTOMA', 'LE-CREUSET',
  'LIFE EXTENSION', 'WIIM', 'APC', 'SAMSONITE', 'BIOTECHUSA', 'HORIZON FITNESS',
  'KÜCHENPROFI', 'PHILIPS HUE', 'NIKON', 'FISSLER', 'MIYABI', 'STEBA', 'PROFORM',
  'HUZARO', 'FUJITSU', 'RAVANSON', 'NEFF', 'SPIDERMAN', 'HPE', 'BODYTONE', 'MARABU'
];

const outputDir = path.join(__dirname, '..', 'output');

// ==================== 工具函数 ====================
function execAgent(cmd, timeout = 30000) {
  try {
    return execSync(`agent-browser ${cmd}`, { encoding: 'utf-8', timeout });
  } catch (e) {
    return e.stdout || e.message || '';
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 加载缓存
function loadCache() {
  if (!CONFIG.enableCache) return {};
  try {
    if (fs.existsSync(CONFIG.cacheFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.cacheFile, 'utf-8'));
    }
  } catch (e) {
    console.log('⚠️ 加载缓存失败，使用空缓存');
  }
  return {};
}

// 保存缓存
function saveCache(cache) {
  if (!CONFIG.enableCache) return;
  try {
    fs.writeFileSync(CONFIG.cacheFile, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.log('⚠️ 保存缓存失败');
  }
}

// 加载进度
function loadProgress() {
  if (!CONFIG.enableResume) return { lastIndex: -1, results: [] };
  try {
    if (fs.existsSync(CONFIG.progressFile)) {
      return JSON.parse(fs.readFileSync(CONFIG.progressFile, 'utf-8'));
    }
  } catch (e) {
    console.log('⚠️ 加载进度失败，从头开始');
  }
  return { lastIndex: -1, results: [] };
}

// 保存进度
function saveProgress(progress) {
  if (!CONFIG.enableResume) return;
  try {
    fs.writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2));
  } catch (e) {
    console.log('⚠️ 保存进度失败');
  }
}

// 检查是否为欧盟国家
function isEUCountry(countryCode) {
  if (!countryCode) return false;
  const upperCode = countryCode.toUpperCase().trim();
  const isEU = CONFIG.euCountries.includes(upperCode);
  if (process.env.DEBUG) {
    console.log(`   [DEBUG] 国家代码: ${upperCode}, 是否欧盟: ${isEU}`);
  }
  return isEU;
}

// 精确匹配检查 - 宽松模式
function isExactMatch(resultName, searchTerm) {
  if (!resultName || !searchTerm) return false;
  
  const normalizedResult = resultName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalizedSearch = searchTerm.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  // 完全匹配
  if (normalizedResult === normalizedSearch) return true;
  
  // 宽松匹配：结果以搜索词开头或结尾，且长度相近
  if (normalizedResult.startsWith(normalizedSearch) || 
      normalizedResult.endsWith(normalizedSearch)) {
    const lengthDiff = Math.abs(normalizedResult.length - normalizedSearch.length);
    if (lengthDiff <= 3) return true; // 允许最多3个字符的差异
  }
  
  return false;
}

// ==================== 核心查询函数 ====================
async function queryBrandDB(trademark, cache) {
  const cacheKey = `branddb_${trademark}`;
  
  // 检查缓存
  if (cache[cacheKey]) {
    console.log(`   💾 [缓存] 使用缓存数据`);
    return cache[cacheKey].map(r => ({ ...r, source: '缓存' }));
  }
  
  let lastError = null;
  
  // 重试机制
  for (let attempt = 1; attempt <= CONFIG.retryAttempts; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`   🔄 第 ${attempt}/${CONFIG.retryAttempts} 次尝试...`);
        await sleep(CONFIG.retryDelay);
      }
      
      // 1. 打开 Brand Database Advanced Search
      execAgent('open "https://branddb.wipo.int/en/advancedsearch" --json', 30000);
      await sleep(8000);
      
      // 2. 获取页面并填写表单
      let snapshot = execAgent('snapshot', 15000);
      
      // 查找 Brand name 输入框 (通常是第一个 textbox)
      const textboxMatch = snapshot.match(/textbox\s*\[ref=([e\d]+)\]/);
      if (!textboxMatch) {
        throw new Error('找不到 Brand name 输入框');
      }
      
      // 3. 输入品牌名称 (使用不带 @ 的 ref 格式)
      console.log(`     输入 Brand name: ${trademark}`);
      const textboxRef = textboxMatch[1].replace('@', '');
      execAgent(`fill "${textboxRef}" "${trademark}"`, 10000);
      await sleep(1000);
      
      // 4. 选择搜索策略为 "Match exact expression"
      // 使用 select 命令，ref 为 e39，值为 "is matching exact expression"
      console.log(`     选择搜索策略: Match exact expression`);
      execAgent(`select "e39" "is matching exact expression"`, 10000);
      await sleep(3000);
      
      // 验证选择
      snapshot = execAgent('snapshot', 10000);
      if (snapshot.includes('is matching exact expression')) {
        console.log(`     ✅ 策略已切换为 exact expression`);
      } else {
        console.log(`     ⚠️ 策略切换可能未生效`);
      }
      
      // 5. 点击 Search 按钮 (使用 e10)
      console.log(`     点击 Search 按钮`);
      execAgent(`click "e10"`, 10000);
      
      await sleep(15000); // 等待结果加载
      
      // 5. 获取结果
      snapshot = execAgent('snapshot', 15000);
      
      // 验证搜索策略是否正确
      if (snapshot.includes('contains the word')) {
        console.log('   ⚠️ 警告：搜索策略仍是 "contains" 而不是 "exact expression"');
      } else if (snapshot.includes('is matching exact expression')) {
        console.log('   ✅ 搜索策略正确：exact expression');
      }
      
      // 滚动查看更多结果
      console.log('   滚动查看更多结果...');
      for (let scroll = 0; scroll < 3; scroll++) {
        execAgent('scroll down 800', 5000);
        await sleep(3000);
      }
      snapshot = execAgent('snapshot', 15000);
      
      // 6. 解析结果
      const results = parseResults(snapshot, trademark);
      
      // 7. 保存到缓存
      if (CONFIG.enableCache && results.length > 0) {
        cache[cacheKey] = results.map(r => ({ ...r, source: undefined })); // 不保存 source 字段到缓存
        saveCache(cache);
      }
      
      return results.map(r => ({ ...r, source: '实时' }));
      
    } catch (error) {
      lastError = error;
      console.log(`   ❌ 尝试 ${attempt} 失败: ${error.message.substring(0, 60)}`);
    }
  }
  
  throw new Error(`查询失败 (${CONFIG.retryAttempts} 次尝试): ${lastError.message}`);
}

// 解析搜索结果
function parseResults(snapshot, trademark) {
  const results = [];
  const lines = snapshot.split('\n');
  
  // 查找结果数量
  const resultMatch = snapshot.match(/Displaying\s*\d+-\d+\s*of\s*(\d+)/i) ||
                     snapshot.match(/of\s*(\d+)\s*results/i) ||
                     snapshot.match(/(\d+)\s*results?/i);
  const totalResults = resultMatch ? parseInt(resultMatch[1]) : 0;
  
  console.log(`   解析: 找到 ${totalResults} 条原始记录`);
  
  if (totalResults === 0) {
    return results;
  }
  
  // 解析每行数据
  let currentResult = null;
  
  for (let i = 0; i < lines.length && results.length < CONFIG.maxResultsPerTrademark; i++) {
    const line = lines[i];
    
    // 查找商标名称行
    const brandMatch = line.match(/link\s*"([^"]+)".*\[ref=([e\d]+)\]/);
    if (brandMatch) {
      const brandName = brandMatch[1].trim();
      
      // 检查是否精确匹配
      if (isExactMatch(brandName, trademark)) {
        currentResult = {
          trademark: trademark,
          fullName: brandName,
          status: '',
          country: '',
          regNo: '',
          regDate: ''
        };
        
        // 查找后续信息 (扩大搜索范围到 40 行)
        for (let j = i + 1; j < Math.min(i + 40, lines.length); j++) {
          const detail = lines[j];
          
          // 提取国家 - 多种匹配模式
          const countryPatterns = [
            /Country of [Oo]rigin[:\s]+([A-Z]{2})/,
            /Country[:\s]+([A-Z]{2})/,
            /Country of [Oo]rigin.*?([A-Z]{2})/,
            /Owner.*?([A-Z]{2})/,
            /gridcell.*?([A-Z]{2})/
          ];
          
          for (const pattern of countryPatterns) {
            const match = detail.match(pattern);
            if (match && !currentResult.country) {
              currentResult.country = match[1];
              break;
            }
          }
          
          // 提取状态 - 多种状态
          const statusMatch = detail.match(/Status[:\s]+(Registered|Pending|Expired|Refused|Published|Withdrawn)/i);
          if (statusMatch && !currentResult.status) {
            currentResult.status = statusMatch[1];
          }
          
          // 提取注册号
          const regMatch = detail.match(/Number[:\s]+([A-Z0-9-]+)/) || 
                          detail.match(/Number[:\s]+([M]\d+)/);
          if (regMatch && !currentResult.regNo) {
            currentResult.regNo = regMatch[1];
          }
          
          // 提取日期
          const dateMatch = detail.match(/(\d{4}[/-]\d{2}[/-]\d{2})/);
          if (dateMatch && !currentResult.regDate) {
            currentResult.regDate = dateMatch[1];
          }
          
          // 如果已经收集到国家信息，可以提前结束
          if (currentResult.country && currentResult.status) {
            break;
          }
        }
        
        // 只保留欧盟国家
        if (isEUCountry(currentResult.country)) {
          console.log(`   ✅ 找到欧盟记录: ${currentResult.fullName} | ${currentResult.country} | ${currentResult.status}`);
          results.push(currentResult);
        } else if (currentResult.country) {
          console.log(`   ℹ️  非欧盟国家: ${currentResult.fullName} | ${currentResult.country}`);
        }
      }
    }
  }
  
  console.log(`   解析完成: ${results.length} 条欧盟记录`);
  return results;
}

// ==================== 主程序 ====================
async function main() {
  console.log('🚀 WIPO Brand Database 欧盟商标批量查询\n');
  console.log('配置:');
  console.log(`  - 商标数量: ${trademarks.length}`);
  console.log(`  - 每个商标最多: ${CONFIG.maxResultsPerTrademark} 条`);
  console.log(`  - 仅限欧盟国家: ${CONFIG.euCountries.length} 个`);
  console.log(`  - 重试次数: ${CONFIG.retryAttempts}`);
  console.log(`  - 缓存: ${CONFIG.enableCache ? '启用' : '禁用'}`);
  console.log(`  - 断点续传: ${CONFIG.enableResume ? '启用' : '禁用'}`);
  console.log('');
  
  // 加载缓存和进度
  const cache = loadCache();
  const progress = loadProgress();
  
  let allResults = progress.results || [];
  const startIndex = progress.lastIndex + 1;
  
  if (startIndex > 0) {
    console.log(`⏯️  从第 ${startIndex + 1} 个商标继续 (已查询 ${startIndex} 个)\n`);
  }
  
  // 查询每个商标
  for (let i = startIndex; i < trademarks.length; i++) {
    const tm = trademarks[i];
    console.log(`[${i + 1}/${trademarks.length}] 查询: ${tm}`);
    
    try {
      const results = await queryBrandDB(tm, cache);
      
      if (results.length > 0) {
        console.log(`   ✅ 找到 ${results.length} 条欧盟记录`);
        allResults = allResults.concat(results);
      } else {
        console.log(`   ⚠️ 未找到欧盟记录`);
        // 记录空结果
        allResults.push({
          trademark: tm,
          fullName: '',
          status: 'Not Found',
          country: '',
          regNo: '',
          regDate: '',
          source: results[0]?.source || '实时'
        });
      }
      
      // 保存进度
      saveProgress({ lastIndex: i, results: allResults });
      
    } catch (error) {
      console.error(`   ❌ 查询失败: ${error.message.substring(0, 80)}`);
      // 记录失败
      allResults.push({
        trademark: tm,
        fullName: '',
        status: 'Error',
        country: '',
        regNo: '',
        regDate: '',
        source: '实时'
      });
      saveProgress({ lastIndex: i, results: allResults });
    }
    
    // 间隔
    if (i < trademarks.length - 1) {
      await sleep(CONFIG.queryDelay);
    }
  }
  
  console.log('\n📊 查询完成，生成文件...\n');
  
  // 生成 CSV
  const csvHeader = '商标名称,完整名称,状态,来源国,注册号,注册日期,数据来源\n';
  const csvRows = allResults.map(r => [
    `"${r.trademark}"`,
    `"${(r.fullName || '').replace(/"/g, '""')}"`,
    `"${r.status}"`,
    `"${r.country}"`,
    `"${r.regNo}"`,
    `"${r.regDate}"`,
    `"${r.source || '实时'}"`
  ].join(',')).join('\n');
  
  const csvPath = path.join(outputDir, 'trademark-eu-results.csv');
  fs.writeFileSync(csvPath, '\uFEFF' + csvHeader + csvRows, 'utf-8');
  console.log(`✅ CSV: ${csvPath}`);
  
  // 生成 Excel
  const excelPath = path.join(outputDir, 'trademark-eu-results.xlsx');
  const wsData = allResults.map(r => ({
    '商标名称': r.trademark,
    '完整名称': r.fullName,
    '状态': r.status,
    '来源国': r.country,
    '注册号': r.regNo,
    '注册日期': r.regDate,
    '数据来源': r.source || '实时'
  }));
  
  const ws = xlsx.utils.json_to_sheet(wsData);
  ws['!cols'] = [{wch:25},{wch:45},{wch:15},{wch:12},{wch:15},{wch:15},{wch:10}];
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'EU Trademarks');
  xlsx.writeFile(wb, excelPath);
  console.log(`✅ Excel: ${excelPath}`);
  
  // 生成 JSON
  const jsonPath = path.join(outputDir, 'trademark-eu-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2), 'utf-8');
  console.log(`✅ JSON: ${jsonPath}`);
  
  // 清除进度文件（完成）
  if (fs.existsSync(CONFIG.progressFile)) {
    fs.unlinkSync(CONFIG.progressFile);
  }
  
  // 统计
  const foundCount = allResults.filter(r => r.status === 'Registered' || r.status === 'Pending').length;
  const notFoundCount = allResults.filter(r => r.status === 'Not Found').length;
  const errorCount = allResults.filter(r => r.status === 'Error').length;
  const cachedCount = allResults.filter(r => r.source === '缓存').length;
  
  console.log(`\n📈 统计:`);
  console.log(`  - 总商标: ${trademarks.length}`);
  console.log(`  - 找到记录: ${foundCount}`);
  console.log(`  - 未找到: ${notFoundCount}`);
  console.log(`  - 查询错误: ${errorCount}`);
  console.log(`  - 来自缓存: ${cachedCount}`);
  
  return { csvPath, excelPath, jsonPath };
}

// 运行
main().then(() => {
  console.log('\n✨ 完成!');
  process.exit(0);
}).catch(e => {
  console.error('\n❌ 程序错误:', e);
  process.exit(1);
});
