/**
 * WebSocket 服务
 */
const jwt = require('jsonwebtoken')
const config = require('./config')

const clientMap = new Map()
const wsMap = new Map()
const HEARTBEAT_TIMEOUT = 60000

function init(server) {
  const WebSocket = require('ws')
  const wss = new WebSocket.Server({ server, path: '/ws' })

  wss.on('connection', function (ws) {
    let authenticated = false
    let customerId = null
    let heartbeatTimer = null

    ws.on('message', function (message) {
      let data
      try { data = JSON.parse(message) } catch (e) { return }

      if (data.type === 'auth') {
        try {
          const decoded = jwt.verify(data.token, config.jwtSecret)
          authenticated = true
          customerId = decoded.customerId
          wsMap.set(ws, customerId)
          if (!clientMap.has(customerId)) clientMap.set(customerId, new Set())
          clientMap.get(customerId).add(ws)
          resetHeartbeat()
          ws.send(JSON.stringify({ type: 'auth_ok' }))
          console.log('[WS] 客户 %s 鉴权成功', customerId)
        } catch (err) {
          ws.send(JSON.stringify({ code: 4001, message: 'token 过期或无效' }))
          ws.close()
        }
        return
      }

      if (!authenticated) return

      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }))
        resetHeartbeat()
        return
      }

      if (data.type === 'device_bind') {
        console.log('[WS] 设备绑定通知:', data.data)
      }
    })

    ws.on('close', cleanup)
    ws.on('error', cleanup)

    function resetHeartbeat() {
      if (heartbeatTimer) clearTimeout(heartbeatTimer)
      if (authenticated) {
        heartbeatTimer = setTimeout(function () {
          console.warn('[WS] 心跳超时，断开')
          ws.close()
        }, HEARTBEAT_TIMEOUT)
      }
    }

    function cleanup() {
      if (heartbeatTimer) clearTimeout(heartbeatTimer)
      if (customerId && clientMap.has(customerId)) {
        clientMap.get(customerId).delete(ws)
        if (clientMap.get(customerId).size === 0) clientMap.delete(customerId)
      }
      wsMap.delete(ws)
    }

    setTimeout(function () { if (!authenticated) ws.close() }, 10000)
  })

  console.log('[WS] WebSocket 服务已启动，路径: /ws')
}

function broadcastToCustomer(customerId, message) {
  const clients = clientMap.get(customerId)
  if (!clients) return
  const msgStr = JSON.stringify(message)
  clients.forEach(function (ws) {
    if (ws.readyState === 1) ws.send(msgStr)
  })
}

module.exports = { init, broadcastToCustomer }
