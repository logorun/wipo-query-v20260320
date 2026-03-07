// 40商标批量测试
// 混合类型：常见品牌、欧盟注册、可能不存在、国际注册

const TEST_TRADEMARKS = [
  // 10个常见国际品牌
  'APPLE',
  'GOOGLE', 
  'MICROSOFT',
  'AMAZON',
  'TESLA',
  'NIKE',
  'ADIDAS',
  'SAMSUNG',
  'SONY',
  'TOYOTA',
  
  // 10个欧盟已注册品牌（基于之前测试）
  'WIIM',
  '9TRANSPORT',
  'LIFE EXTENSION',
  'FORTE PHARMA',
  'AIRBUS',
  'BASF',
  'BAYER',
  'SIEMENS',
  'BOSCH',
  'LIDL',
  
  // 10个可能不存在的随机组合
  'XYZ123ABC',
  'TESTBRAND999',
  'FAKETM888',
  'NONEXIST777',
  'RANDOM666',
  'DUMMY555',
  'PLACEHOLDER444',
  'NOTREAL333',
  'FICTITIOUS222',
  'IMAGINARY111',
  
  // 10个不同领域品牌
  'COCACOLA',
  'PEPSI',
  'MCDONALDS',
  'STARBUCKS',
  'CHANEL',
  'GUCCI',
  'PRADA',
  'LOUIS VUITTON',
  'ROLEX',
  'OMEGA'
];

module.exports = { TEST_TRADEMARKS };
