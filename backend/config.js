/**
 * 后端全局配置
 */
module.exports = {
  port: 3000,
  jwtSecret: 'wenmo-iot-secret-key-2024',
  tokenExpiresIn: 7200,
  refreshTokenExpiresIn: 7 * 24 * 3600,
  adminPassword: 'wenmo123',
  defaultPageSize: 20
}
