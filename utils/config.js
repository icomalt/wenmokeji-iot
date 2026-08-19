/**
 * 全局配置文件 —— 多环境版
 * ============================================================
 * 集中管理 IoT 云平台 HTTPS 接口地址、WSS 长连接地址、
 * 超时/重试/重连等生产级参数。
 *
 * 【环境切换说明】
 *   开发阶段：env = 'dev'，默认开启 mock（本地模拟数据）
 *   联调阶段：env = 'dev'，mock = false
 *   预发布  ：env = 'staging'，mock = false
 *   正式发布：env = 'prod'，mock = false
 *   —— 只改 env 一个字段即可，无需修改其他配置 ——
 *
 * 【上线前检查清单】
 *   1. 将 env 改为 'prod'
 *   2. 确认 mock = false
 *   3. 确认 baseUrl / wsUrl 为真实云平台域名
 *   4. 在微信公众平台后台配置合法域名（见 deploy.md）
 */

// ============ 各环境独立配置 ============
const ENV = {
  /**
   * 开发环境 —— 对接公司物联网平台（阿里云）
   * API 端口 8082，前端端口 3019
   * 鉴权方式：JWT Bearer token
   */
  dev: {
    mock: false,
    baseUrl: 'http://8.134.177.27:8082/api/v1',
    webUrl: 'http://8.134.177.27:3019',
    wsUrl: '',                          // 平台暂无 WebSocket，留空
    requestTimeout: 15000,
    tokenRefreshThreshold: 600,
    retryTimes: 2,
    retryDelay: 1000
  },

  /** 预发布环境 —— 模拟线上环境，用于发布前最后验证 */
  staging: {
    mock: false,
    baseUrl: 'https://iot-staging.your-domain.com/api/v1',
    webUrl: 'https://iot-staging.your-domain.com',
    wsUrl: '',
    requestTimeout: 15000,
    tokenRefreshThreshold: 600,
    retryTimes: 2,
    retryDelay: 1000
  },

  /** 正式生产环境 —— 部署后替换为正式域名 */
  prod: {
    mock: false,
    baseUrl: 'https://iot.your-domain.com/api/v1',
    webUrl: 'https://iot.your-domain.com',
    wsUrl: '',
    requestTimeout: 10000,
    tokenRefreshThreshold: 300,
    retryTimes: 3,
    retryDelay: 800
  }
}

// ============ 选择环境 ============
// ★ 上线时将此处改为 'prod' ★
const CURRENT_ENV = 'dev'

const active = ENV[CURRENT_ENV] || ENV.dev

// ============ 发布前安全校验 ============
if (CURRENT_ENV === 'prod' && active.mock) {
  console.error('[config] 警告：生产环境不应开启 mock！请检查配置。')
}

// ============ 全局导出 ============
module.exports = {
  // 当前环境标识（用于调试日志）
  env: CURRENT_ENV,

  // Mock 开关：true 时使用本地模拟数据，无需后端即可预览 UI
  mock: active.mock,

  // IoT 云平台 HTTPS 接口基础地址（需在微信后台配置为 request 合法域名）
  baseUrl: active.baseUrl,
  // 物联网平台 Web 前端地址（用于拼接验证码图片等）
  webUrl: active.webUrl,
  // WebSocket 长连接地址（需在微信后台配置为 socket 合法域名，必须 wss）
  wsUrl: active.wsUrl,

  // 请求超时时间（ms）
  requestTimeout: active.requestTimeout,
  // Token 自动刷新阈值（s）：token 剩余有效期小于此值时自动刷新
  tokenRefreshThreshold: active.tokenRefreshThreshold,
  // 单次请求失败重试次数
  retryTimes: active.retryTimes,
  // 重试间隔（ms）
  retryDelay: active.retryDelay,

  // 默认分页大小
  pageSize: 20,
  // WebSocket 最大重连次数
  wsMaxRetry: 10,
  // WebSocket 重连基础间隔（毫秒，实际按次数递增）
  wsRetryInterval: 3000,
  // WebSocket 心跳间隔（毫秒）
  wsHeartbeatInterval: 25000,
  // WebSocket 连接超时（ms）
  wsConnectTimeout: 10000,

  // 本地缓存中的 token key
  tokenKey: 'iot_token',
  // 本地缓存中的 refreshToken key
  refreshTokenKey: 'iot_refresh_token',
  // 本地缓存中的用户信息 key
  userInfoKey: 'iot_user_info',
  // token 过期时间戳 key
  tokenExpireKey: 'iot_token_expire'
}
