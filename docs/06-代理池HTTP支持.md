# 代理池HTTP支持

## 概述

代理池现在同时支持 **SOCKS5** 和 **HTTP** 两种协议。

## 代理信息

| 协议 | 端口范围 | 数量 |
|------|----------|------|
| SOCKS5 | 10000-10252 | 253个 |
| HTTP | 20000-20252 | 253个 |

## 端口映射规则

### SOCKS5代理
```
端口 = 10000 + (IP末位 - 2)
```

### HTTP代理
```
端口 = 20000 + (IP末位 - 2)
```

### 示例

| 出口IP | SOCKS5端口 | HTTP端口 |
|--------|------------|----------|
| 23.148.244.2 | 10000 | 20000 |
| 23.148.244.3 | 10001 | 20001 |
| 23.148.244.100 | 10098 | 20098 |
| 23.148.244.254 | 10252 | 20252 |

## 使用方式

### HTTP代理

```bash
# 命令行
curl --proxy http://23.148.244.2:20000 https://api.ipify.org/

# Node.js
const response = await fetch('https://example.com', {
  agent: new HttpsProxyAgent('http://23.148.244.2:20000')
});
```

### SOCKS5代理

```bash
# 命令行
curl --socks5 23.148.244.2:10000 https://api.ipify.org/

# Node.js
const response = await fetch('https://example.com', {
  agent: new SocksProxyAgent('socks5://23.148.244.2:10000')
});
```

## 选择建议

| 场景 | 推荐协议 |
|------|----------|
| agent-browser | SOCKS5 |
| 普通HTTP请求 | HTTP |
| 需要UDP支持 | SOCKS5 |
| 简单集成 | HTTP |

## 注意事项

- 两种协议使用相同的出口IP
- IP白名单：216.116.160.78, 216.116.160.79
- 代理服务器：23.148.244.2

## 相关文档

- [05-代理池使用指南](./05-代理池使用指南.md) - 详细使用说明
