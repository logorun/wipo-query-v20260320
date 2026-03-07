// 测试欧盟国家识别逻辑
const EU_COUNTRIES_MAP = {
  'Austria': { code: 'AT', isEU: true },
  'Belgium': { code: 'BE', isEU: true },
  'Bulgaria': { code: 'BG', isEU: true },
  'Croatia': { code: 'HR', isEU: true },
  'Cyprus': { code: 'CY', isEU: true },
  'Czech Republic': { code: 'CZ', isEU: true },
  'Czechia': { code: 'CZ', isEU: true },
  'Denmark': { code: 'DK', isEU: true },
  'Estonia': { code: 'EE', isEU: true },
  'Finland': { code: 'FI', isEU: true },
  'France': { code: 'FR', isEU: true },
  'Germany': { code: 'DE', isEU: true },
  'Greece': { code: 'GR', isEU: true },
  'Hungary': { code: 'HU', isEU: true },
  'Ireland': { code: 'IE', isEU: true },
  'Italy': { code: 'IT', isEU: true },
  'Latvia': { code: 'LV', isEU: true },
  'Lithuania': { code: 'LT', isEU: true },
  'Luxembourg': { code: 'LU', isEU: true },
  'Malta': { code: 'MT', isEU: true },
  'Netherlands': { code: 'NL', isEU: true },
  'Poland': { code: 'PL', isEU: true },
  'Portugal': { code: 'PT', isEU: true },
  'Romania': { code: 'RO', isEU: true },
  'Slovakia': { code: 'SK', isEU: true },
  'Slovenia': { code: 'SI', isEU: true },
  'Spain': { code: 'ES', isEU: true },
  'Sweden': { code: 'SE', isEU: true },
  'United Kingdom': { code: 'GB', isEU: false },
  'European Union': { code: 'EM', isEU: true },
  'EM': { code: 'EM', isEU: true }
};

const EU_COUNTRY_CODES = Object.values(EU_COUNTRIES_MAP)
  .filter(c => c.isEU)
  .map(c => c.code);

// 模拟解析国家的函数
function parseCountry(countryFull) {
  const record = { country: '', countryCode: '', isEU: false };
  
  const codeMatch = countryFull.match(/\(([A-Z]{2})\)/);
  if (codeMatch) {
    record.countryCode = codeMatch[1];
    record.isEU = EU_COUNTRY_CODES.includes(codeMatch[1]);
  } else {
    // 没有国家代码时，通过国家名判断
    const countryName = countryFull.split(',')[0].trim();
    const euCountryEntry = Object.entries(EU_COUNTRIES_MAP).find(
      ([name, info]) => name.toLowerCase() === countryName.toLowerCase()
    );
    if (euCountryEntry) {
      record.countryCode = euCountryEntry[1].code;
      record.isEU = euCountryEntry[1].isEU;
    }
  }
  
  record.country = countryFull;
  return record;
}

// 测试用例
const testCases = [
  'France',  // 应该识别为 EU
  'France (FR)',  // 应该识别为 EU
  'Spain (ES)',  // 应该识别为 EU
  'Germany',  // 应该识别为 EU
  'United Kingdom (GB)',  // 应该不是 EU
  'United States (US)',  // 不在映射中
];

console.log('测试欧盟国家识别逻辑:\n');
testCases.forEach(tc => {
  const result = parseCountry(tc);
  console.log(`${tc} => Code: ${result.countryCode}, isEU: ${result.isEU}`);
});
