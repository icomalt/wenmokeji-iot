/**
 * 入口文件
 */
const express = require('express')
const cors = require('cors')
const http = require('http')
const config = require('./config')
const authMiddleware = require('./middleware')
const authRoutes = require('./routes/auth')
const deviceRoutes = require('./routes/device')
const wsService = require('./ws')

const app = express()

// BUG-006 修复：CORS 白名单，生产环境必须通过 CORS_ORIGIN 环境变量指定
const corsOptions = {
  origin: function (origin, cb) {
    const allowed = config.corsOrigin
    if (!allowed.length || !origin) return cb(null, true)
    if (allowed.indexOf(origin) !== -1) return cb(null, true)
    return cb(new Error('CORS blocked: ' + origin))
  },
  credentials: true
}
app.use(cors(corsOptions))

app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: true, limit: '100kb' }))
app.use(function (req, res, next) {
  console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + req.url)
  next()
})

app.get('/health', function (req, res) {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// BUG-001 / BUG-017 修复：删除未鉴权的 /api/debug/db 全量数据泄露页面
// 如需调试，请通过环境变量 DEBUG_DB=1 启用，并必须通过 authMiddleware + admin 角色校验。
if (process.env.DEBUG_DB === '1') {
  app.get('/api/debug/db', authMiddleware, function (req, res) {
    if (req.user.role !== 'admin') return res.status(403).json({ code: 403, message: '需要管理员', data: null })
    const store = require('./store')
    const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) }
    res.type('html').send(
      '<h1>Debug DB (admin only)</h1>' +
      '<p>users: ' + store.users.length + '</p>' +
      '<p>devices: ' + store.devices.length + '</p>' +
      '<p>history: ' + store.printHistory.length + '</p>' +
      '<pre>' + esc(JSON.stringify({ users: store.users, devices: store.devices }, null, 2)) + '</pre>'
    )
  })
}

// 业务路由：各自挂载 authMiddleware（BUG-012 修复：不再全局拦截 /api/*，未知路由可正确 404）
app.use('/api/auth', authMiddleware, authRoutes)
app.use('/api/device', authMiddleware, deviceRoutes)

app.use(function (req, res) {
  res.status(404).json({ code: 404, message: '接口不存在', data: null })
})

// BUG-018 修复：业务错误透传状态码（body 解析错误返回 400 而非 500）
app.use(function (err, req, res, next) {
  console.error('[ERROR]', err)
  const status = err.status || err.statusCode || 500
  res.status(status).json({ code: status, message: status === 400 ? '请求参数格式错误' : '服务器内部错误', data: null })
})

const server = http.createServer(app)
wsService.init(server)

server.listen(config.port, function () {
  console.log('==============================================')
  console.log('  喷码机物联网云平台后端已启动')
  console.log('  HTTP: http://localhost:' + config.port + '/api')
  console.log('  WS:   ws://localhost:' + config.port + '/ws')
  console.log('  健康检查: http://localhost:' + config.port + '/health')
  console.log('==============================================')
  console.log('  测试账号:')
  console.log('    admin   / 123456  (5 台设备)')
  console.log('    user002 / 123456  (2 台设备)')
  console.log('    user003 / 123456  (0 台设备)')
  // BUG-005 修复：不再把 adminPassword 打到控制台
  console.log('')
})
