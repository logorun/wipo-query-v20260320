const { execSync } = require('child_process');

const tm = process.argv[2] || 'DISNEY';
console.log(`🧪 测试查询: ${tm}\n`);

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

(async () => {
  try {
    // 打开页面
    console.log('1. 打开 WIPO Madrid Monitor...');
    execAgent('open "https://www3.wipo.int/madrid/monitor/en/" --json', 25000);
    await sleep(6000);
    
    // 获取 refs
    console.log('2. 获取页面元素...');
    let snapshot = execAgent('snapshot', 15000);
    const textboxMatch = snapshot.match(/textbox\s*\[ref=([e\d]+)\]/);
    const searchMatch = snapshot.match(/link\s*"🔎"\s*\[ref=([e\d]+)\]/);
    
    if (!textboxMatch || !searchMatch) {
      console.log('❌ 找不到搜索框');
      execAgent('close', 5000);
      return;
    }
    
    const textboxRef = textboxMatch[1];
    const searchRef = searchMatch[1];
    console.log(`   搜索框: @${textboxRef}, 按钮: @${searchRef}`);
    
    // 执行搜索
    console.log(`3. 搜索 "${tm}"...`);
    execAgent(`fill "@${textboxRef}" "${tm}"`, 10000);
    await sleep(1000);
    execAgent(`click "@${searchRef}"`, 10000);
    await sleep(10000);
    
    // 获取结果
    console.log('4. 获取结果...');
    snapshot = execAgent('snapshot', 15000);
    
    // 解析
    const lines = snapshot.split('\n');
    let found = 0;
    
    for (const line of lines) {
      if (line.includes('row') && line.toUpperCase().includes(tm.toUpperCase())) {
        console.log(`\n📝 找到记录 ${++found}:`);
        console.log('   ' + line.substring(0, 200));
      }
    }
    
    if (found === 0) {
      console.log('⚠️ 未找到记录');
    } else {
      console.log(`\n✅ 共找到 ${found} 条记录`);
    }
    
    execAgent('close', 5000);
  } catch (e) {
    console.error('❌ 错误:', e.message);
    try { execAgent('close', 5000); } catch(e2) {}
  }
})();
