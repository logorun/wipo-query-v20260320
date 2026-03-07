const xlsx = require('xlsx');

class ExcelGenerator {
  static generateEnhancedReport(results, outputPath) {
    const detailData = [];

    results.forEach((result, idx) => {
      if (result.records && result.records.length > 0) {
        result.records.forEach((record) => {
          detailData.push({
            '序号': idx + 1,
            '商标名称': record.brandName,
            '持有人': record.owner || '-',
            '状态': record.status || '-',
            '状态日期': record.statusDate || '-',
            '申请国家': record.country || record.countryOfFiling || '-',
            '国家代码': record.countryCode || '-',
            '注册号': record.registrationNumber || record.regNumber || '-',
            '注册日期': record.registrationDate || record.regDate || '-',
            '尼斯分类': (record.niceClasses || []).join(', ') || '-',
            '是否欧盟': record.isEU ? '是' : '否',
            '是否欧洲': record.isEurope ? '是' : '否',
            '是否国际注册': record.isInternational ? '是' : '否',
            '指定国家': (record.designatedCountries || []).map(c => c.name).join(', ') || '-',
            '指定国家详情': (record.designatedCountries || []).map(c => `${c.name}(${c.code})[EU:${c.isEU ? '是' : '否'},欧洲:${c.isEurope ? '是' : '否'}]`).join('; ') || '-',
            '查询时间': new Date(result.queryTime).toLocaleString('zh-CN'),
            '耗时': result.queryDuration,
            '来源缓存': result.fromCache ? '是' : '否'
          });
        });
      } else {
        detailData.push({
          '序号': idx + 1,
          '商标名称': result.trademark,
          '持有人': '-',
          '状态': result.queryStatus === 'found' ? '找到记录' : '未找到',
          '状态日期': '-',
          '申请国家': '-',
          '国家代码': '-',
          '注册号': '-',
          '注册日期': '-',
          '尼斯分类': '-',
          '是否欧盟': '-',
          '是否欧洲': '-',
          '是否国际注册': '-',
          '指定国家': '-',
          '指定国家详情': '-',
          '查询时间': new Date(result.queryTime).toLocaleString('zh-CN'),
          '耗时': result.queryDuration,
          '来源缓存': result.fromCache ? '是' : '否'
        });
      }
    });

    const found = results.filter(r => r.queryStatus === 'found');
    const withEU = results.filter(r => r.euRecords > 0);
    const withEurope = results.filter(r => r.records.some(rec => rec.isEurope));
    
    const euCountries = new Set();
    const europeCountries = new Set();
    results.forEach(r => {
      r.records.forEach(rec => {
        if (rec.isEU && rec.countryCode) euCountries.add(rec.countryCode);
        if (rec.isEurope && rec.countryCode) europeCountries.add(rec.countryCode);
      });
    });

    const summaryData = [
      { '项目': '测试时间', '值': new Date().toLocaleString('zh-CN') },
      { '项目': '总商标数', '值': results.length },
      { '项目': '找到记录', '值': found.length },
      { '项目': '未找到', '值': results.length - found.length },
      { '项目': '包含欧盟记录', '值': withEU.length },
      { '项目': '包含欧洲记录', '值': withEurope.length },
      { '项目': '涉及欧盟国家数', '值': euCountries.size },
      { '项目': '涉及欧洲国家数', '值': europeCountries.size },
      { '项目': '', '值': '' },
      { '项目': '包含欧盟记录的商标', '值': withEU.map(r => r.trademark).join(', ') || '无' }
    ];

    const wb = xlsx.utils.book_new();

    const detailWs = xlsx.utils.json_to_sheet(detailData);
    detailWs['!cols'] = [
      { wch: 6 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 15 },
      { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
      { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 40 },
      { wch: 20 }, { wch: 10 }, { wch: 10 }
    ];
    xlsx.utils.book_append_sheet(wb, detailWs, '查询结果');

    const summaryWs = xlsx.utils.json_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 20 }, { wch: 80 }];
    xlsx.utils.book_append_sheet(wb, summaryWs, '统计汇总');

    xlsx.writeFile(wb, outputPath);

    return {
      totalRecords: detailData.length,
      foundCount: found.length,
      withEUCount: withEU.length
    };
  }
}

module.exports = ExcelGenerator;
