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

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(function (req, res, next) {
  console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + req.url)
  next()
})

app.get('/health', function (req, res) {
  res.json({ status: 'ok', timestamp: Date.now() })
})

app.get('/api/debug/db', function (req, res) {
  const store = require('./store')
  const refreshTokenCount = Object.keys(store.refreshTokens).length
  const blacklistCount = store.tokenBlacklist.size
  const usersHtml = store.users.map(u =>
    `<tr><td>${u.id}</td><td>${u.username}</td><td>${u.customerId}</td><td><span class="tag ${u.role === 'admin' ? 'tag-admin' : 'tag-user'}">${u.role}</span></td></tr>`
  ).join('')
  const customersHtml = store.customers.map(c => {
    const deviceCount = (store.deviceBindings[c.id] || []).length
    return `<tr><td>${c.id}</td><td>${c.name}</td><td>${deviceCount} 台</td></tr>`
  }).join('')
  const devicesHtml = store.devices.map(d => {
    const onlineTag = d.onlineStatus === 1
      ? '<span class="tag tag-online">● 在线</span>'
      : '<span class="tag tag-offline">○ 离线</span>'
    const faultTag = d.faultStatus === 1
      ? '<span class="tag tag-fault">⚠ 故障</span>'
      : '<span class="tag tag-normal">正常</span>'
    return `<tr>
      <td>${d.deviceId}</td>
      <td>${d.deviceName}</td>
      <td>${d.deviceType}</td>
      <td>${onlineTag}</td>
      <td>${faultTag}</td>
      <td>${d.printContent}</td>
      <td>${d.printTime}</td>
    </tr>`
  }).join('')
  const bindingsHtml = Object.keys(store.deviceBindings).map(cid => {
    const ids = store.deviceBindings[cid]
    return `<div class="binding-item"><strong>${cid}</strong><div class="binding-devices">${ids.length ? ids.map(id => `<span class="device-chip">${id}</span>`).join('') : '<span class="empty">无设备</span>'}</div></div>`
  }).join('')
  const historyHtml = store.printHistory.length
    ? store.printHistory.map(h =>
        `<tr><td>${h.recordId}</td><td>${h.deviceId}</td><td>${h.printContent}</td><td>${h.printTime}</td><td>${h.operator}</td><td>${h.count}</td></tr>`
      ).join('')
    : '<tr><td colspan="6" class="empty-row">暂无打印记录</td></tr>'

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>喷码机 IoT 云平台 - 数据库管理</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: #f0f2f5; color: #333; }
  .header { background: linear-gradient(135deg, #1a237e, #c62828); color: white; padding: 24px 32px; }
  .header h1 { font-size: 22px; font-weight: 600; }
  .header p { font-size: 13px; opacity: 0.9; margin-top: 6px; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .stat-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .stat-card .label { font-size: 13px; color: #888; margin-bottom: 8px; }
  .stat-card .value { font-size: 28px; font-weight: 700; color: #1a237e; }
  .stat-card.red .value { color: #c62828; }
  .stat-card.green .value { color: #2e7d32; }
  .stat-card.orange .value { color: #e65100; }
  .card { background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px; overflow: hidden; }
  .card-header { padding: 16px 24px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
  .card-header h2 { font-size: 16px; font-weight: 600; color: #1a237e; }
  .card-header .count { background: #e8eaf6; color: #1a237e; font-size: 12px; padding: 2px 10px; border-radius: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f5f5f5; padding: 10px 14px; text-align: left; font-size: 13px; color: #666; font-weight: 600; border-bottom: 2px solid #e0e0e0; }
  td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
  tr:hover td { background: #fafafa; }
  .tag { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
  .tag-admin { background: #ffebee; color: #c62828; }
  .tag-user { background: #e3f2fd; color: #1565c0; }
  .tag-online { background: #e8f5e9; color: #2e7d32; }
  .tag-offline { background: #fafafa; color: #757575; }
  .tag-fault { background: #fff3e0; color: #e65100; }
  .tag-normal { background: #e8f5e9; color: #2e7d32; }
  .binding-item { padding: 12px 24px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 16px; }
  .binding-item:last-child { border-bottom: none; }
  .binding-item strong { color: #1a237e; min-width: 60px; }
  .binding-devices { display: flex; gap: 8px; flex-wrap: wrap; }
  .device-chip { background: #e8eaf6; color: #1a237e; padding: 4px 10px; border-radius: 4px; font-size: 12px; }
  .empty { color: #999; font-style: italic; font-size: 12px; }
  .empty-row { text-align: center; padding: 30px; color: #999; }
  .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
</style>
</head>
<body>
<div class="header">
  <h1>🖨️ 喷码机物联网云平台 - 数据管理中心</h1>
  <p>实时数据监控面板 · 端口 3000</p>
</div>
<div class="container">
  <div class="stats">
    <div class="stat-card"><div class="label">用户总数</div><div class="value">${store.users.length}</div></div>
    <div class="stat-card green"><div class="label">设备总数</div><div class="value">${store.devices.length}</div></div>
    <div class="stat-card orange"><div class="label">打印记录</div><div class="value">${store.printHistory.length}</div></div>
    <div class="stat-card red"><div class="label">活跃Token</div><div class="value">${refreshTokenCount}</div></div>
  </div>
  <div class="card">
    <div class="card-header"><h2>👥 用户列表</h2><span class="count">${store.users.length} 人</span></div>
    <table><thead><tr><th>ID</th><th>账号</th><th>客户ID</th><th>角色</th></tr></thead><tbody>${usersHtml}</tbody></table>
  </div>
  <div class="card">
    <div class="card-header"><h2>🏢 客户列表</h2><span class="count">${store.customers.length} 家</span></div>
    <table><thead><tr><th>ID</th><th>名称</th><th>设备数</th></tr></thead><tbody>${customersHtml}</tbody></table>
  </div>
  <div class="card">
    <div class="card-header"><h2>🔗 客户-设备绑定关系</h2></div>
    ${bindingsHtml}
  </div>
  <div class="card">
    <div class="card-header"><h2>🖨️ 设备列表</h2><span class="count">${store.devices.length} 台</span></div>
    <table><thead><tr><th>设备ID</th><th>名称</th><th>类型</th><th>状态</th><th>故障</th><th>最近打印</th><th>打印时间</th></tr></thead><tbody>${devicesHtml}</tbody></table>
  </div>
  <div class="card">
    <div class="card-header"><h2>📋 打印历史记录</h2><span class="count">${store.printHistory.length} 条</span></div>
    <table><thead><tr><th>记录ID</th><th>设备ID</th><th>打印内容</th><th>打印时间</th><th>操作员</th><th>次数</th></tr></thead><tbody>${historyHtml}</tbody></table>
  </div>
</div>
<div class="footer">© 2024 喷码机物联网云平台 · 刷新页面查看最新数据</div>
</body>
</html>`
  res.send(html)
})

app.use('/api', authMiddleware)
app.use('/api/auth', authRoutes)
app.use('/api/device', deviceRoutes)

app.use(function (req, res) {
  res.status(404).json({ code: 404, message: '接口不存在', data: null })
})

app.use(function (err, req, res, next) {
  console.error('[ERROR]', err)
  res.status(500).json({ code: 500, message: '服务器内部错误', data: null })
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
  console.log('  管理员密码: ' + config.adminPassword)
  console.log('')
})
