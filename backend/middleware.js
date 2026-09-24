/**
 * JWT 鉴权中间件
 */
const jwt = require('jsonwebtoken')
const config = require('./config')
const store = require('./store')

// 路由挂载在 /api/auth 下，子路径为 /login、/refresh
const PUBLIC_PATHS = ['/login', '/refresh']

function authMiddleware(req, res, next) {
  if (PUBLIC_PATHS.some(p => req.path.endsWith(p))) {
    return next()
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未提供 token', data: null })
  }

  const token = authHeader.substring(7)

  if (store.tokenBlacklist.has(token)) {
    return res.status(401).json({ code: 401, message: 'token 已失效', data: null })
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret)
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      customerId: decoded.customerId,
      role: decoded.role
    }
    next()
  } catch (err) {
    return res.status(401).json({ code: 401, message: 'token 过期或无效', data: null })
  }
}

module.exports = authMiddleware
