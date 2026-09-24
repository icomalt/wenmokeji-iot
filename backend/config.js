/**
 * 后端全局配置
 * 生产环境通过环境变量注入，禁止在代码中写死密钥。
 */
module.exports = {
  port: process.env.PORT || 3000,
  // JWT 密钥：生产必须通过 JWT_SECRET 环境变量覆盖
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me-' + Math.random().toString(36).slice(2),
  tokenExpiresIn: 7200,
  refreshTokenExpiresIn: 7 * 24 * 3600,
  // 管理员操作密码：生产必须通过 ADMIN_PASSWORD 环境变量覆盖
  adminPassword: process.env.ADMIN_PASSWORD || 'wenmo123-dev-only',
  defaultPageSize: 20,
  // CORS 白名单：逗号分隔，例如 https://your.domain.com
  corsOrigin: (process.env.CORS_ORIGIN || '').split(',').filter(Boolean),
  // 登录限流：窗口(ms) 与 最大次数
  loginRateWindow: 15 * 60 * 1000,
  loginRateMax: 10
}
