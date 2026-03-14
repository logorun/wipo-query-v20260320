/**
 * Proxy Manager for WIPO Crawler
 * 
 * Manages SOCKS5 proxy rotation for the 254-IP proxy pool
 * Proxy VM: 23.148.244.2
 * Port range: 10000-10252 (253 proxies)
 * Protocol: SOCKS5
 * 
 * IP mapping: 23.148.244.N → Port 10000 + (N - 2)
 * Example: 23.148.244.2 → port 10000
 *          23.148.244.100 → port 10098
 *          23.148.244.254 → port 10252
 */

const fs = require('fs');
const path = require('path');

class ProxyManager {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.proxyHost = options.proxyHost || '23.148.244.2';
    this.portStart = options.portStart || 10000;
    this.portEnd = options.portEnd || 10252;
    this.totalProxies = this.portEnd - this.portStart + 1;
    this.protocol = options.protocol || 'socks5';
    
    // Rotation settings
    this.currentIndex = 0;
    this.strategy = options.strategy || 'round-robin'; // 'round-robin', 'random', 'least-used'
    this.usageCount = new Map(); // Track usage per proxy
    
    // Cooldown settings (prevent same IP being used too frequently)
    this.cooldownMs = options.cooldownMs || 30000; // 30 seconds
    this.lastUsedTime = new Map();
    
    // Stats
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      proxyStats: new Map()
    };
    
    // State file for persistence
    this.stateFile = options.stateFile || path.join(__dirname, '..', '..', 'output', 'proxy-state.json');
    this.loadState();
    
    console.log(`[ProxyManager] Initialized with ${this.totalProxies} proxies`);
    console.log(`[ProxyManager] Strategy: ${this.strategy}`);
    console.log(`[ProxyManager] Range: ${this.proxyHost}:${this.portStart}-${this.portEnd}`);
  }
  
  /**
   * Get the port number for a given IP suffix
   * @param {number} ipSuffix - Last octet of IP (2-254)
   * @returns {number} Port number
   */
  getPortForIP(ipSuffix) {
    if (ipSuffix < 2 || ipSuffix > 254) {
      throw new Error(`Invalid IP suffix: ${ipSuffix}. Must be between 2 and 254`);
    }
    return this.portStart + (ipSuffix - 2);
  }
  
  /**
   * Get the IP suffix for a given port
   * @param {number} port - Port number
   * @returns {number} IP suffix
   */
  getIPForPort(port) {
    if (port < this.portStart || port > this.portEnd) {
      throw new Error(`Invalid port: ${port}. Must be between ${this.portStart} and ${this.portEnd}`);
    }
    return (port - this.portStart) + 2;
  }
  
  /**
   * Get proxy URL for a specific index
   * @param {number} index - Proxy index (0 to totalProxies-1)
   * @returns {string} Proxy URL
   */
  getProxyByIndex(index) {
    if (index < 0 || index >= this.totalProxies) {
      index = index % this.totalProxies; // Wrap around
    }
    const port = this.portStart + index;
    return `${this.protocol}://${this.proxyHost}:${port}`;
  }
  
  /**
   * Get the next proxy based on rotation strategy
   * @returns {Object} Proxy info { url, index, port, ip }
   */
  getNextProxy() {
    if (!this.enabled) {
      return null;
    }
    
    let index;
    
    switch (this.strategy) {
      case 'random':
        index = Math.floor(Math.random() * this.totalProxies);
        break;
        
      case 'least-used':
        // Find proxy with least usage
        let minUsage = Infinity;
        let minIndex = 0;
        for (let i = 0; i < this.totalProxies; i++) {
          const usage = this.stats.proxyStats.get(i) || 0;
          const lastUsed = this.lastUsedTime.get(i) || 0;
          const cooldownOk = (Date.now() - lastUsed) > this.cooldownMs;
          
          if (usage < minUsage && cooldownOk) {
            minUsage = usage;
            minIndex = i;
          }
        }
        index = minIndex;
        break;
        
      case 'round-robin':
      default:
        // Find next available proxy (respecting cooldown)
        let attempts = 0;
        do {
          index = this.currentIndex;
          this.currentIndex = (this.currentIndex + 1) % this.totalProxies;
          attempts++;
          
          const lastUsed = this.lastUsedTime.get(index) || 0;
          if ((Date.now() - lastUsed) > this.cooldownMs || attempts >= this.totalProxies) {
            break;
          }
        } while (attempts < this.totalProxies);
        break;
    }
    
    const port = this.portStart + index;
    const ipSuffix = this.getIPForPort(port);
    
    // Update usage tracking
    this.lastUsedTime.set(index, Date.now());
    this.usageCount.set(index, (this.usageCount.get(index) || 0) + 1);
    this.stats.totalRequests++;
    this.stats.proxyStats.set(index, (this.stats.proxyStats.get(index) || 0) + 1);
    
    return {
      url: `${this.protocol}://${this.proxyHost}:${port}`,
      index,
      port,
      ip: `${this.proxyHost.replace(/\.\d+$/, '')}.${ipSuffix}`,
      host: this.proxyHost
    };
  }
  
  /**
   * Mark a proxy request as successful
   * @param {number} index - Proxy index
   */
  markSuccess(index) {
    this.stats.successfulRequests++;
    this.saveState();
  }
  
  /**
   * Mark a proxy request as failed
   * @param {number} index - Proxy index
   */
  markFailed(index) {
    this.stats.failedRequests++;
    this.saveState();
  }
  
  /**
   * Get environment variable for agent-browser
   * @param {number} index - Optional specific proxy index
   * @returns {Object} { AGENT_BROWSER_PROXY: url, proxyInfo }
   */
  getProxyEnv(index) {
    const proxy = index !== undefined 
      ? { url: this.getProxyByIndex(index), index, port: this.portStart + index }
      : this.getNextProxy();
    
    if (!proxy) {
      return { AGENT_BROWSER_PROXY: undefined, proxyInfo: null };
    }
    
    return {
      AGENT_BROWSER_PROXY: proxy.url,
      proxyInfo: proxy
    };
  }
  
  /**
   * Get multiple proxies for parallel queries
   * @param {number} count - Number of proxies needed
   * @returns {Array} Array of proxy info objects
   */
  getProxiesForParallel(count) {
    const proxies = [];
    for (let i = 0; i < Math.min(count, this.totalProxies); i++) {
      proxies.push(this.getNextProxy());
    }
    return proxies;
  }
  
  /**
   * Save state to file
   */
  saveState() {
    try {
      const state = {
        currentIndex: this.currentIndex,
        stats: {
          totalRequests: this.stats.totalRequests,
          successfulRequests: this.stats.successfulRequests,
          failedRequests: this.stats.failedRequests,
          proxyStats: Object.fromEntries(this.stats.proxyStats)
        },
        lastUsedTime: Object.fromEntries(this.lastUsedTime),
        savedAt: new Date().toISOString()
      };
      
      const dir = path.dirname(this.stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch (e) {
      // Silent fail for state saving
    }
  }
  
  /**
   * Load state from file
   */
  loadState() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const state = JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
        this.currentIndex = state.currentIndex || 0;
        
        if (state.stats) {
          this.stats.totalRequests = state.stats.totalRequests || 0;
          this.stats.successfulRequests = state.stats.successfulRequests || 0;
          this.stats.failedRequests = state.stats.failedRequests || 0;
          this.stats.proxyStats = new Map(Object.entries(state.stats.proxyStats || {}).map(([k, v]) => [parseInt(k), v]));
        }
        
        if (state.lastUsedTime) {
          this.lastUsedTime = new Map(Object.entries(state.lastUsedTime).map(([k, v]) => [parseInt(k), v]));
        }
      }
    } catch (e) {
      // Silent fail for state loading
    }
  }
  
  /**
   * Reset all stats and state
   */
  reset() {
    this.currentIndex = 0;
    this.usageCount.clear();
    this.lastUsedTime.clear();
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      proxyStats: new Map()
    };
    
    if (fs.existsSync(this.stateFile)) {
      fs.unlinkSync(this.stateFile);
    }
    
    console.log('[ProxyManager] State reset');
  }
  
  /**
   * Get statistics summary
   */
  getStats() {
    return {
      enabled: this.enabled,
      totalProxies: this.totalProxies,
      currentIndex: this.currentIndex,
      strategy: this.strategy,
      requests: {
        total: this.stats.totalRequests,
        successful: this.stats.successfulRequests,
        failed: this.stats.failedRequests,
        successRate: this.stats.totalRequests > 0 
          ? (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) + '%'
          : 'N/A'
      },
      topUsedProxies: Array.from(this.stats.proxyStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([idx, count]) => ({ index: idx, port: this.portStart + idx, count }))
    };
  }
}

module.exports = { ProxyManager };
