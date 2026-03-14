require('dotenv').config();
const { queryQueue, gracefulShutdown } = require('../src/services/queueService');
const { taskDB, cacheDB } = require('../src/models/database');
const cacheService = require('../src/services/cacheService');
const { Logger } = require('../src/utils/logger');
const { metrics } = require('../src/utils/metrics');
const { registry: circuitBreakers, CircuitBreakerError } = require('../src/utils/circuitBreaker');
const { QueryExecutionError, ErrorTypes } = require('../src/utils/errors');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { ProxyManager } = require('../../src/utils/proxy-manager');

const logger = new Logger('worker');

// ==================== 代理管理器初始化 ====================
const proxyConfig = {
  enabled: process.env.PROXY_ENABLED !== 'false', // 默认启用
  proxyHost: process.env.PROXY_HOST || '23.148.244.2',
  portStart: parseInt(process.env.PROXY_PORT_START) || 10000,
  portEnd: parseInt(process.env.PROXY_PORT_END) || 10252,
  protocol: process.env.PROXY_PROTOCOL || 'socks5',
  strategy: process.env.PROXY_STRATEGY || 'round-robin',
  cooldownMs: parseInt(process.env.PROXY_COOLDOWN_MS) || 30000,
  stateFile: path.join(__dirname, '../../output/proxy-state.json')
};

const proxyManager = new ProxyManager(proxyConfig);

logger.info('Proxy manager initialized', {
  enabled: proxyConfig.enabled,
  totalProxies: proxyManager.totalProxies,
  strategy: proxyConfig.strategy
});

// 工具函数
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 随机抖动，避免雪崩
const jitter = (baseMs, jitterPercent = 0.1) => {
  const jitterAmount = baseMs * jitterPercent;
  return baseMs + (Math.random() * jitterAmount * 2 - jitterAmount);
};

/**
 * 指数退避计算
 * baseDelay * (2 ^ attempt) + jitter
 */
const calculateBackoff = (attempt, baseDelay = 5000, maxDelay = 60000) => {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const delayWithJitter = jitter(exponentialDelay);
  return Math.min(delayWithJitter, maxDelay);
};

/**
 * 容错执行 agent-browser 命令（带熔断器保护和代理支持）
 * @param {string} cmd - agent-browser命令
 * @param {number} timeout - 超时时间（毫秒）
 * @param {object} proxyInfo - 代理信息（可选）
 */
const execAgent = (cmd, timeout = 30000, proxyInfo = null) => {
  const breaker = circuitBreakers.get('agent-browser', {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000
  });

  return breaker.executeSync(() => {
    try {
      // 构建环境变量
      const env = { ...process.env };
      
      // 如果提供了代理信息，设置代理环境变量
      if (proxyInfo && proxyConfig.enabled) {
        env.AGENT_BROWSER_PROXY = proxyInfo.url;
        logger.debug('Using proxy for request', { 
          proxy: proxyInfo.url, 
          ip: proxyInfo.ip 
        });
      }
      
      return execSync(`agent-browser ${cmd}`, { 
        encoding: 'utf-8', 
        timeout,
        env 
      });
    } catch (e) {
      // 区分可重试和不可重试错误
      const isRetryable = !e.message?.includes('ENOENT') && 
                         !e.message?.includes('command not found');
      
      if (!isRetryable) {
        // 不可重试错误直接抛出，不计入熔断器失败
        throw new QueryExecutionError(
          'agent-browser',
          `Command failed: ${e.message}`,
          false
        );
      }
      
      // 返回输出或空字符串（容错）
      return e.stdout || e.message || '';
    }
  });
};

/**
 * 获取下一个代理（如果启用）
 * @returns {object|null} 代理信息
 */
const getNextProxy = () => {
  if (!proxyConfig.enabled) {
    return null;
  }
  
  const env = proxyManager.getProxyEnv();
  return env.proxyInfo;
};

/**
 * 标记代理请求成功
 * @param {object} proxyInfo - 代理信息
 */
const markProxySuccess = (proxyInfo) => {
  if (proxyInfo && proxyConfig.enabled) {
    proxyManager.markSuccess(proxyInfo.index);
  }
};

/**
 * 标记代理请求失败
 * @param {object} proxyInfo - 代理信息
 */
const markProxyFailed = (proxyInfo) => {
  if (proxyInfo && proxyConfig.enabled) {
    proxyManager.markFailed(proxyInfo.index);
  }
};

/**
 * 带重试的执行包装器
 */
const executeWithRetry = async (fn, options = {}) => {
  const { 
    maxRetries = 3, 
    baseDelay = 5000,
    onRetry,
    context = {}
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // 检查是否可重试
      if (!ErrorTypes.isRetryable(error) || attempt === maxRetries) {
        throw error;
      }

      const delay = calculateBackoff(attempt, baseDelay);
      
      logger.warn(`Retrying after error`, {
        attempt: attempt + 1,
        maxRetries,
        delay: Math.round(delay),
        error: error.message,
        ...context
      });

      if (onRetry) {
        onRetry(attempt + 1, delay, error);
      }

      await sleep(delay);
    }
  }

  throw lastError;
};

// 欧盟国家代码映射（用于国际注册展开）
const EU_COUNTRIES_MAP = {
  'Austria': { code: 'AT', isEU: true, isEurope: true },
  'Belgium': { code: 'BE', isEU: true, isEurope: true },
  'Bulgaria': { code: 'BG', isEU: true, isEurope: true },
  'Croatia': { code: 'HR', isEU: true, isEurope: true },
  'Cyprus': { code: 'CY', isEU: true, isEurope: true },
  'Czech Republic': { code: 'CZ', isEU: true, isEurope: true },
  'Czechia': { code: 'CZ', isEU: true, isEurope: true },
  'Denmark': { code: 'DK', isEU: true, isEurope: true },
  'Estonia': { code: 'EE', isEU: true, isEurope: true },
  'Finland': { code: 'FI', isEU: true, isEurope: true },
  'France': { code: 'FR', isEU: true, isEurope: true },
  'Germany': { code: 'DE', isEU: true, isEurope: true },
  'Greece': { code: 'GR', isEU: true, isEurope: true },
  'Hungary': { code: 'HU', isEU: true, isEurope: true },
  'Ireland': { code: 'IE', isEU: true, isEurope: true },
  'Italy': { code: 'IT', isEU: true, isEurope: true },
  'Latvia': { code: 'LV', isEU: true, isEurope: true },
  'Lithuania': { code: 'LT', isEU: true, isEurope: true },
  'Luxembourg': { code: 'LU', isEU: true, isEurope: true },
  'Malta': { code: 'MT', isEU: true, isEurope: true },
  'Netherlands': { code: 'NL', isEU: true, isEurope: true },
  'Poland': { code: 'PL', isEU: true, isEurope: true },
  'Portugal': { code: 'PT', isEU: true, isEurope: true },
  'Romania': { code: 'RO', isEU: true, isEurope: true },
  'Slovakia': { code: 'SK', isEU: true, isEurope: true },
  'Slovenia': { code: 'SI', isEU: true, isEurope: true },
  'Spain': { code: 'ES', isEU: true, isEurope: true },
  'Sweden': { code: 'SE', isEU: true, isEurope: true },
  'United Kingdom': { code: 'GB', isEU: false, isEurope: true },
  'UK': { code: 'GB', isEU: false, isEurope: true },
  'Great Britain': { code: 'GB', isEU: false, isEurope: true },
  'Switzerland': { code: 'CH', isEU: false, isEurope: true },
  'Norway': { code: 'NO', isEU: false, isEurope: true },
  'Iceland': { code: 'IS', isEU: false, isEurope: true },
  'Liechtenstein': { code: 'LI', isEU: false, isEurope: true },
  'Monaco': { code: 'MC', isEU: false, isEurope: true },
  'San Marino': { code: 'SM', isEU: false, isEurope: true },
  'Andorra': { code: 'AD', isEU: false, isEurope: true },
  'Vatican': { code: 'VA', isEU: false, isEurope: true },
  'Faroe Islands': { code: 'FO', isEU: false, isEurope: true },
  'European Union': { code: 'EM', isEU: true, isEurope: true },
  'EM': { code: 'EM', isEU: true, isEurope: true }
};

const EU_COUNTRY_CODES = Object.values(EU_COUNTRIES_MAP)
  .filter(c => c.isEU)
  .map(c => c.code);

const EUROPE_COUNTRY_CODES = Object.values(EU_COUNTRIES_MAP)
  .filter(c => c.isEurope)
  .map(c => c.code);

/**
 * 解析快照提取商标记录
 */
/**
 * 精确匹配检查 - 宽松模式
 * 允许一定程度的差异（空格、特殊字符、小差异）
 */
const isExactMatch = (resultName, searchTerm) => {
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

  // 搜索词包含在结果中
  if (normalizedResult.includes(normalizedSearch)) return true;

  return false;
};

const parseSnapshot = (snapshot, trademark) => {
  const records = [];

  if (!snapshot || typeof snapshot !== 'string') {
    logger.warn('Empty or invalid snapshot', { trademark });
    return records;
  }

  const lines = snapshot.split('\n');

  // 查找结果数量
  const resultMatch = snapshot.match(/Displaying\s*\d+-\d+\s*of\s*(\d+)/i);
  const totalResults = resultMatch ? parseInt(resultMatch[1]) : 0;

  if (totalResults === 0) {
    return records;
  }

  logger.debug(`Parsing ${totalResults} total results`, { trademark });

  // 解析每个结果块
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const brandMatch = line.match(/text:\s*([^,]+?)\s*Owner/i);
    if (brandMatch) {
      const brandName = brandMatch[1].trim();

      // 使用宽松匹配而不是严格匹配
      if (isExactMatch(brandName, trademark)) {
        const record = extractRecord(lines, i, trademark);
        if (record && record.status === 'Registered') {
          records.push(record);
        }
      }
    }
    i++;
  }

  return records;
};

/**
 * 从快照行中提取单个记录
 */
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

  // 提取持有人
  for (let j = startIndex; j < Math.min(startIndex + 5, lines.length); j++) {
    const ownerMatch = lines[j].match(/Owner\s+([^)]+)\)/i);
    if (ownerMatch && !record.owner) {
      record.owner = ownerMatch[1].trim();
      break;
    }
  }

  // 查找后续信息
  let recordEndIndex = startIndex;
  for (let j = startIndex; j < Math.min(startIndex + 50, lines.length); j++) {
    const line = lines[j];
    
    if (j > startIndex + 5 && line.match(/text:\s*[^,]+?\s*Owner/i)) {
      recordEndIndex = j;
      break;
    }

    const countryMatch = line.match(/Country of filing\s+([A-Za-z\s,()]+?)(?:\s+Status|$)/i);
    if (countryMatch && !record.country) {
      const countryFull = countryMatch[1].trim();
      record.country = countryFull;
      
      const codeMatch = countryFull.match(/\(([A-Z]{2})\)/);
      if (codeMatch) {
        record.countryCode = codeMatch[1];
        record.isEU = EU_COUNTRY_CODES.includes(codeMatch[1]);
        record.isEurope = EUROPE_COUNTRY_CODES.includes(codeMatch[1]);
      } else {
        const countryName = countryFull.split(',')[0].trim();
        const euCountryEntry = Object.entries(EU_COUNTRIES_MAP).find(
          ([name, info]) => name.toLowerCase() === countryName.toLowerCase()
        );
        if (euCountryEntry) {
          record.countryCode = euCountryEntry[1].code;
          record.isEU = euCountryEntry[1].isEU;
          record.isEurope = euCountryEntry[1].isEurope;
          logger.debug('Country identified by name', { countryName, code: record.countryCode, isEU: record.isEU, isEurope: record.isEurope });
        }
      }
      
      if (countryFull.includes(',') || countryFull.toLowerCase().includes('international')) {
        record.isInternational = true;
        const countries = countryFull.split(',').map(c => c.trim());
        for (const country of countries) {
          const codeMatch = country.match(/\(([A-Z]{2})\)/);
          if (codeMatch) {
            const code = codeMatch[1];
            const countryName = country.replace(/\s*\([A-Z]{2}\)/, '').trim();
            const isEU = EU_COUNTRY_CODES.includes(code);
            const isEurope = EUROPE_COUNTRY_CODES.includes(code);
            record.designatedCountries.push({
              name: countryName,
              code: code,
              isEU: isEU,
              isEurope: isEurope
            });
            logger.info('Designated country added', { countryName, code, isEU, isEurope });
          }
        }
        logger.info('International registration parsed', { 
          trademark, 
          designatedCountries: record.designatedCountries.length,
          euCountries: record.designatedCountries.filter(c => c.isEU).length,
          europeCountries: record.designatedCountries.filter(c => c.isEurope).length
        });
      }
    }

    const statusWithDateMatch = line.match(/(Registered|Expired|Pending|Refused|Withdrawn)\s*\(([^)]+)\)/i);
    if (statusWithDateMatch && !record.status) {
      record.status = statusWithDateMatch[1].trim();
      record.statusDate = statusWithDateMatch[2].trim();
      if (record.status.toLowerCase().includes('international')) {
        record.isInternational = true;
      }
    }

    // 提取注册号
    const regMatch = line.match(/(?:Registration\s+)?Number[\s:]+([A-Z0-9\-\/]+)/i);
    if (regMatch && !record.regNumber) {
      record.regNumber = regMatch[1].trim();
    }

    // 提取日期
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch && !record.regDate) {
      record.regDate = dateMatch[1];
    }

    // 提取尼斯分类
    const niceMatch = line.match(/Nice class(?:es)?[\s:]+([\d,\s]+)/i);
    if (niceMatch) {
      const classes = niceMatch[1].split(/[,\s]+/)
        .map(c => c.trim())
        .filter(c => c && /^\d+$/.test(c));
      if (classes.length > 0) {
        record.niceClasses = [...new Set([...record.niceClasses, ...classes])];
      }
    }
  }

  return record;
};

/**
 * 展开国际注册为多个欧盟国家记录
 */
const expandInternationalRegistration = (record) => {
  if (!record.isInternational || record.designatedCountries.length === 0) {
    logger.info('Not an international registration or no designated countries', { 
      isInternational: record.isInternational,
      designatedCountriesCount: record.designatedCountries.length,
      regNumber: record.regNumber
    });
    return [record];
  }

  const expanded = [];
  const euCountries = record.designatedCountries.filter(c => c.isEU);
  
  logger.info('International registration analysis', {
    regNumber: record.regNumber,
    totalDesignated: record.designatedCountries.length,
    euCountries: euCountries.length,
    designatedList: record.designatedCountries.map(c => ({ name: c.name, code: c.code, isEU: c.isEU }))
  });
  
  if (euCountries.length === 0) {
    logger.warn('International registration has no EU countries detected', { 
      regNumber: record.regNumber,
      designatedCountries: record.designatedCountries.map(c => c.code)
    });
    return [record];
  }

  logger.info(`Expanding international registration`, {
    regNumber: record.regNumber,
    euCountries: euCountries.length
  });

  for (const country of euCountries) {
    expanded.push({
      ...record,
      country: country.name,
      countryCode: country.code,
      isEU: true,
      isEurope: true,
      isInternational: true,
      isExpanded: true,
      originalRegNumber: record.regNumber,
      designatedCountries: record.designatedCountries
    });
  }

  return expanded;
};

/**
 * 保存查询证据截图
 */
const saveEvidence = async (trademark, snapshot) => {
  const evidenceDir = path.join(__dirname, '../../output/evidence');
  
  try {
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${trademark}-${timestamp}.png`;
    const filepath = path.join(evidenceDir, filename);

    execAgent(`screenshot "${filepath}"`, 10000);
    logger.debug('Evidence screenshot saved', { trademark, filepath });
    return filepath;
  } catch (error) {
    logger.error('Failed to save evidence', { trademark, error: error.message });
    return null;
  }
};

/**
 * 查询单个商标（增强版，带熔断器和重试）
 */
const queryTrademark = async (trademark, options = {}) => {
  const { saveEvidence: shouldSaveEvidence = false } = options;
  const startTime = Date.now();
  
  logger.info(`Querying trademark`, { trademark });

  try {
    const result = await executeWithRetry(async () => {
      return await doQueryTrademark(trademark, shouldSaveEvidence);
    }, {
      maxRetries: 3,
      baseDelay: 5000,
      context: { trademark },
      onRetry: (attempt, delay) => {
        metrics.increment('trademark_query_retry', { trademark });
      }
    });

    metrics.timing('trademark_query_duration', Date.now() - startTime, { 
      status: result.queryStatus 
    });

    return result;

  } catch (error) {
    logger.error(`Query failed after retries`, { trademark, error: error.message });
    execAgent('close', 5000);

    metrics.increment('trademark_query_failed', { trademark });

    return {
      trademark,
      queryStatus: 'error',
      totalRecords: 0,
      euRecords: 0,
      nonEURecords: 0,
      records: [],
      queryTime: new Date().toISOString(),
      fromCache: false,
      queryDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      error: error.message,
      isInternational: false
    };
  }
};

/**
 * 实际查询执行（带代理支持）
 */
const doQueryTrademark = async (trademark, shouldSaveEvidence) => {
  const startTime = Date.now();
  
  // 获取代理（每次查询使用新代理）
  const proxyInfo = getNextProxy();
  if (proxyInfo) {
    logger.info('Using proxy for query', { 
      trademark, 
      proxy: proxyInfo.url, 
      ip: proxyInfo.ip 
    });
  }

  try {
    // 1. 打开页面
    logger.debug('Step 1: Opening page...', { trademark });
    execAgent('open "https://branddb.wipo.int/en/advancedsearch" --json', 60000, proxyInfo);
    await sleep(10000);

    // 2. 获取页面状态
    logger.debug('Step 2: Getting page state...', { trademark });
    let snapshot = execAgent('snapshot', 15000, proxyInfo);

    // 3. 选择精确匹配策略
    logger.debug('Step 3: Setting search strategy...', { trademark });
    execAgent('select "e39" "is matching exact expression"', 30000, proxyInfo);
    
    snapshot = execAgent('snapshot', 10000, proxyInfo);
    if (snapshot.includes('is matching exact expression')) {
      logger.debug('Strategy set to exact expression', { trademark });
    } else {
      logger.warn('Strategy may not have changed, continuing anyway', { trademark });
    }
    await sleep(2000);

    // 4. 输入商标名称
    logger.debug('Step 4: Entering trademark...', { trademark });
    execAgent(`fill "e45" "${trademark}"`, 30000, proxyInfo);
    await sleep(1000);

    // 5. 点击搜索
    logger.debug('Step 5: Clicking search...', { trademark });
    execAgent('click "e10"', 30000, proxyInfo);
    await sleep(15000);

    // 6. 获取初始快照，检测总结果数
    logger.debug('Step 6: Getting initial snapshot...', { trademark });
    snapshot = execAgent('snapshot', 30000, proxyInfo);
  
    // 7. 滚动加载所有结果
    const resultMatch = snapshot.match(/Displaying\s*\d+-\d+\s*of\s*(\d+)/i);
    const totalResults = resultMatch ? parseInt(resultMatch[1]) : 0;
  
    if (totalResults > 3) {
      logger.info('Scrolling to load all results', { trademark, totalResults });
    
      // 计算需要滚动的次数（假设每页显示约10条）
      const scrollCount = Math.min(Math.ceil(totalResults / 10), 10);
    
      for (let i = 0; i < scrollCount; i++) {
        logger.debug('Scrolling...', { trademark, scroll: i + 1, total: scrollCount });
        execAgent('scroll down', 5000, proxyInfo);
        await sleep(2000);
      }
    
      // 滚动完成后重新获取快照
      logger.debug('Getting final snapshot after scrolling...', { trademark });
      snapshot = execAgent('snapshot', 30000, proxyInfo);
    }

    // 8. 保存证据截图
    let evidencePath = null;
    if (shouldSaveEvidence) {
      evidencePath = await saveEvidence(trademark, snapshot);
    }

    // 9. 关闭浏览器
    execAgent('close', 10000, proxyInfo);

    // 10. 标记代理成功
    markProxySuccess(proxyInfo);

    // 11. 解析结果
    let records = parseSnapshot(snapshot, trademark);
    logger.info('Parsed records from snapshot', { trademark, count: records.length });
  
    // 12. 展开国际注册
    const expandedRecords = [];
    for (const record of records) {
      const expanded = expandInternationalRegistration(record);
      expandedRecords.push(...expanded);
    }
  
    const euRecords = expandedRecords.filter(r => r.isEU);
    const nonEURecords = expandedRecords.filter(r => !r.isEU);
  
    logger.info('Query result summary', {
      trademark,
      totalRecords: expandedRecords.length,
      euRecords: euRecords.length,
      nonEURecords: nonEURecords.length,
      euCountries: euRecords.map(r => r.countryCode || r.country),
      proxyUsed: proxyInfo ? proxyInfo.ip : 'none'
    });

    const result = {
      trademark,
      queryStatus: expandedRecords.length > 0 ? 'found' : 'not_found',
      totalRecords: expandedRecords.length,
      euRecords: euRecords.length,
      nonEURecords: nonEURecords.length,
      records: expandedRecords,
      queryTime: new Date().toISOString(),
      fromCache: false,
      queryDuration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
      evidencePath,
      isInternational: expandedRecords.some(r => r.isInternational),
      proxyIp: proxyInfo ? proxyInfo.ip : null
    };

    logger.info(`Query completed`, { 
      trademark, 
      totalRecords: result.totalRecords,
      euRecords: result.euRecords,
      duration: result.queryDuration,
      proxyIp: result.proxyIp
    });

    return result;
    
  } catch (error) {
    // 标记代理失败
    markProxyFailed(proxyInfo);
    
    // 关闭浏览器
    try {
      execAgent('close', 5000, proxyInfo);
    } catch (e) {
      // 忽略关闭错误
    }
    
    throw error;
  }
};

/**
 * 处理队列任务 - 单线程处理
 */
queryQueue.process(1, async (job) => {
  const { taskId, trademarks } = job.data;
  const jobLogger = logger.child(`job-${job.id}`);
  
  jobLogger.info('[DEBUG] Worker received job', { 
    jobId: job.id,
    taskId, 
    trademarkCount: trademarks?.length,
    data: job.data
  });

  if (!trademarks || !Array.isArray(trademarks) || trademarks.length === 0) {
    jobLogger.error('[DEBUG] Invalid job data - no trademarks', { jobData: job.data });
    throw new Error('Invalid job data: trademarks array is required');
  }

  // 更新任务状态为处理中
  jobLogger.info('[DEBUG] Updating task status to processing', { taskId });
  await taskDB.updateStatus(taskId, 'processing', { 
    startedAt: new Date().toISOString() 
  });
  jobLogger.info('[DEBUG] Task status updated to processing', { taskId });

  const results = [];
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < trademarks.length; i++) {
    const trademark = trademarks[i];
    jobLogger.info(`Processing trademark ${i + 1}/${trademarks.length}`, { trademark });

    try {
      // 1. 检查熔断器状态
      const breaker = circuitBreakers.get('agent-browser');
      if (breaker.state === 'OPEN') {
        jobLogger.warn('Circuit breaker is OPEN, skipping query', { 
          trademark,
          retryAfter: breaker.getRetryAfter()
        });
        
        results.push({
          trademark,
          queryStatus: 'skipped',
          records: [],
          queryTime: new Date().toISOString(),
          fromCache: false,
          error: 'Service temporarily unavailable (circuit breaker open)'
        });
        failed++;
        continue;
      }

      // 2. 检查缓存
      const cached = await cacheService.get(trademark);
      let result;

      if (cached.cached) {
        jobLogger.debug('Using cached data', { trademark });
        result = {
          ...cached.data,
          fromCache: true,
          cacheInfo: cached.cacheInfo
        };
        metrics.increment('trademark_query_cache_hit');
      } else {
        // 3. 执行查询
        result = await queryTrademark(trademark, { saveEvidence: true });
        metrics.increment('trademark_query_cache_miss');

        // 4. 保存到缓存（如果查询成功）
        if (result.queryStatus !== 'error') {
          await cacheService.set(trademark, result);
        }
      }

      results.push(result);
      processed++;

      await taskDB.updateStatus(taskId, 'processing', {
        progress: { processed, failed, total: trademarks.length },
        results: results
      });

      // 商标间延迟（带随机，避免被封）
      if (i < trademarks.length - 1) {
        const delay = 5000 + Math.floor(Math.random() * 5000);
        await sleep(delay);
      }

    } catch (error) {
      jobLogger.error(`Failed to process trademark`, { 
        trademark, 
        error: error.message 
      });
      
      results.push({
        trademark,
        queryStatus: 'error',
        records: [],
        queryTime: new Date().toISOString(),
        fromCache: false,
        error: error.message
      });
      failed++;
    }
  }

  // 完成任务
  jobLogger.info('[DEBUG] Job processing completed', { 
    taskId,
    processed, 
    failed, 
    total: trademarks.length 
  });

  await taskDB.updateStatus(taskId, 'completed', {
    completedAt: new Date().toISOString(),
    results,
    progress: { processed, failed, total: trademarks.length }
  });
  
  jobLogger.info('[DEBUG] Task status updated to completed', { taskId });

  return { taskId, processed, failed, results };
});

// 队列事件监听
queryQueue.on('completed', (job) => {
  logger.info('[DEBUG] Queue event: Job completed', { jobId: job.id, taskId: job.data?.taskId });
  metrics.increment('jobs_completed_total');
});

queryQueue.on('failed', (job, err) => {
  logger.error('[DEBUG] Queue event: Job failed', { jobId: job.id, taskId: job.data?.taskId, error: err.message });
  metrics.increment('jobs_failed_total');
});

queryQueue.on('waiting', (jobId) => {
  logger.info('[DEBUG] Queue event: Job waiting', { jobId });
});

queryQueue.on('active', (job) => {
  logger.info('[DEBUG] Queue event: Job active', { jobId: job.id, taskId: job.data?.taskId });
});

queryQueue.on('stalled', (job) => {
  logger.warn('[DEBUG] Queue event: Job stalled', { jobId: job.id, taskId: job.data?.taskId });
});

logger.info('🚀 Worker started with enhanced robustness', {
  circuitBreaker: true,
  retryLogic: true,
  validation: true,
  proxy: {
    enabled: proxyConfig.enabled,
    totalProxies: proxyManager.totalProxies,
    strategy: proxyConfig.strategy
  }
});

// Startup health check
const performStartupCheck = async () => {
  try {
    const { healthCheck } = require('../src/services/queueService');
    const health = await healthCheck();
    
    if (health.healthy) {
      logger.info('[DEBUG] Worker startup check passed - Redis connected and queue ready');
    } else {
      logger.error('[DEBUG] Worker startup check failed - Redis not connected', { 
        error: health.error,
        state: health.state 
      });
      logger.error('[DEBUG] Tasks will NOT be processed until Redis connection is restored');
    }
  } catch (error) {
    logger.error('[DEBUG] Worker startup health check error', { error: error.message });
  }
};

performStartupCheck();

// 启动时恢复队列（防止上次关闭时队列被暂停）
queryQueue.resume().then(() => {
  logger.info('[DEBUG] Queue resumed successfully');
}).catch(err => {
  logger.warn('[DEBUG] Failed to resume queue', { error: err.message });
});

// 优雅退出
const shutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  // 输出熔断器状态
  const breakerStates = circuitBreakers.getAllStates();
  logger.info('Circuit breaker states at shutdown', breakerStates);
  
  await gracefulShutdown();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
