const { cacheDB } = require('../models/database');

const CACHE_TTL_HOURS = 24;

const cacheService = {
  // 获取缓存
  get: async (trademark) => {
    const entry = await cacheDB.get(trademark);
    if (!entry) {
      return { cached: false, data: null };
    }

    const age = Date.now() - new Date(entry.updated_at).getTime();
    const ageMinutes = Math.floor(age / 60000);

    return {
      cached: true,
      cacheInfo: {
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
        expiresAt: entry.expires_at,
        age: ageMinutes < 60 ? `${ageMinutes}m` : `${Math.floor(ageMinutes / 60)}h${ageMinutes % 60}m`,
        hitCount: entry.hit_count + 1
      },
      data: entry.data
    };
  },

  // 设置缓存
  set: async (trademark, data) => {
    await cacheDB.set(trademark, data, CACHE_TTL_HOURS);
    return { success: true, trademark, ttl: `${CACHE_TTL_HOURS}h` };
  },

  // 删除缓存
  delete: async (trademark) => {
    return await cacheDB.delete(trademark);
  },

  // 清空过期缓存
  clearExpired: async () => {
    return await cacheDB.clearExpired();
  }
};

module.exports = cacheService;
