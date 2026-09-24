/**
 * WebSocket 长连接管理器 —— 生产级
 * ============================================================
 * 功能：
 *  1. 多页面订阅模型（subscribe/unsubscribe），避免重复连接与回调互相覆盖
 *  2. 连接地址携带 token 鉴权（?token=xxx，亦可按后端约定改用 header）
 *  3. 连接超时检测（config.wsConnectTimeout 内未连接则提示）
 *  4. 断线自动重连（次数递增退避，达到上限提示）
 *  5. 心跳保活（定时发送 ping，超时未收到 pong 主动断开）
 *  6. 鉴权失败（后端返回 code=4001）时停止重连并跳转登录页
 *  7. 无订阅者时主动关闭，页面销毁 unsubscribe 即可释放
 *  8. Mock 模式：config.mock=true 时，不建立真实连接，仅模拟定时推送
 *
 * 【权限过滤说明】
 * WebSocket 连接建立时携带 token，后端根据 token 中的 customerId
 * 仅向客户端推送属于该客户的设备状态/参数/报警消息
 */
const config = require('./config')
const auth = require('./auth')

let socketTask = null          // 当前 socketTask
let isManualClose = false      // 是否主动关闭（关闭后不再自动重连）
let retryCount = 0             // 当前重连次数
let heartbeatTimer = null      // 心跳定时器
let connectTimeoutTimer = null // 连接超时定时器
let pongTimer = null           // pong 等待超时定时器
const subscribers = new Set()  // 订阅者回调集合

// Mock 模式：定时推送器
let mockPushTimer = null
let mockPushIndex = 0

// ============ 鉴权失败处理 ============
let authFailedHandled = false  // 鉴权失败是否已经处理（避免重复弹窗）

function handleAuthFailed() {
  if (authFailedHandled) return
  authFailedHandled = true
  // 清理登录态
  auth.clear()
  // 关闭所有连接
  closeAll()
  wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
  setTimeout(function () {
    wx.reLaunch({ url: '/pages/login/login' })
    authFailedHandled = false
  }, 1500)
}

// ============ 连接超时检测 ============

function clearConnectTimeout() {
  if (connectTimeoutTimer) {
    clearTimeout(connectTimeoutTimer)
    connectTimeoutTimer = null
  }
}

function startConnectTimeout() {
  clearConnectTimeout()
  const timeout = config.wsConnectTimeout || 10000
  connectTimeoutTimer = setTimeout(function () {
    // 超时仍未连上，主动触发错误处理
    if (!socketTask || socketTask.readyState !== 1) {
      console.warn('[WS] 连接超时（' + timeout + 'ms），触发重连')
      if (socketTask) {
        socketTask.close({})
      } else {
        reconnect()
      }
    }
  }, timeout)
}

// ============ Pong 超时检测 ============

function resetPongTimer() {
  if (pongTimer) {
    clearTimeout(pongTimer)
  }
  const pongTimeout = config.wsHeartbeatInterval + 10000 // 心跳间隔 + 10s 缓冲
  pongTimer = setTimeout(function () {
    console.warn('[WS] 未收到 pong 响应，主动断开连接')
    if (socketTask) {
      isManualClose = false
      socketTask.close({})
    }
  }, pongTimeout)
}

function clearPongTimer() {
  if (pongTimer) {
    clearTimeout(pongTimer)
    pongTimer = null
  }
}

// ============ 对外接口 ============

/**
 * 注册消息回调
 * @param {Function} fn 收到消息时回调，参数为解析后的对象（或原始字符串）
 * @returns {Function} 取消订阅函数
 */
function subscribe(fn) {
  if (typeof fn === 'function') {
    subscribers.add(fn)
  }
  // 首次订阅或被手动关闭后重新订阅时，发起连接
  if (config.mock) {
    // Mock 模式：启动定时推送模拟
    startMockPush()
  } else if (!socketTask) {
    isManualClose = false
    connect()
  }
  return function () {
    unsubscribe(fn)
  }
}

/**
 * Mock 模式：启动定时推送
 * 模拟后端推送设备状态变更、参数变更
 */
function startMockPush() {
  if (mockPushTimer) return
  // 首次立即推送一次"连接成功"
  setTimeout(function () {
    subscribers.forEach(function (fn) {
      try {
        fn({ type: 'connected', data: { message: 'mock 连接成功' } })
      } catch (e) {
        console.error('[WS-Mock] 推送异常', e)
      }
    })
  }, 500)

  // 每 15 秒推送一次模拟数据
  mockPushTimer = setInterval(function () {
    if (subscribers.size === 0) return
    mockPushIndex++
    const mockMessages = [
      { type: 'device_status', data: { deviceId: 'DEV001', onlineStatus: 1, faultStatus: 0, printTime: '2024-05-20 12:0' + mockPushIndex + ':00' } },
      { type: 'device_status', data: { deviceId: 'DEV002', onlineStatus: 1, faultStatus: 0, printTime: '2024-05-20 12:0' + mockPushIndex + ':00' } }
    ]
    const msg = mockMessages[mockPushIndex % mockMessages.length]
    subscribers.forEach(function (fn) {
      try {
        fn(msg)
      } catch (e) {
        console.error('[WS-Mock] 推送异常', e)
      }
    })
  }, 15000)
}

/** 停止 Mock 推送 */
function stopMockPush() {
  if (mockPushTimer) {
    clearInterval(mockPushTimer)
    mockPushTimer = null
  }
}

/** 发起连接 */
function connect() {
  const token = auth.getToken()
  if (!token) {
    console.warn('[WS] 无 token，跳过连接')
    return
  }
  const url = config.wsUrl
  if (!url) {
    console.warn('[WS] wsUrl 未配置，跳过连接')
    return
  }

  // 启动连接超时检测
  startConnectTimeout()

  socketTask = wx.connectSocket({
    url: url,
    fail: function (err) {
      console.error('[WS] 连接失败', err)
      clearConnectTimeout()
      socketTask = null
      reconnect()
    }
  })

  socketTask.onOpen(function () {
    console.log('[WS] 连接已建立，发送鉴权消息')
    clearConnectTimeout()
    retryCount = 0
    isManualClose = false
    authFailedHandled = false
    // 连接建立后发送第一条消息进行鉴权
    socketTask.send({ data: JSON.stringify({ type: 'auth', token: token }) })
    startHeartbeat()
    resetPongTimer()
  })

  socketTask.onMessage(function (res) {
    let data = res.data
    try {
      data = JSON.parse(res.data)
    } catch (e) {
      // 非 JSON 直接透传
    }

    // 处理 pong 响应
    if (typeof data === 'object' && data.type === 'pong') {
      resetPongTimer()
      return
    }

    // 处理鉴权失败消息
    if (typeof data === 'object' && data.code === 4001) {
      console.warn('[WS] 鉴权失败：', data.message)
      handleAuthFailed()
      return
    }

    subscribers.forEach(function (fn) {
      try {
        fn(data)
      } catch (e) {
        console.error('[WS] 订阅者执行异常', e)
      }
    })
  })

  socketTask.onClose(function () {
    console.log('[WS] 连接关闭')
    clearConnectTimeout()
    clearPongTimer()
    stopHeartbeat()
    socketTask = null
    if (!isManualClose) reconnect()
  })

  socketTask.onError(function (err) {
    console.error('[WS] 错误', err)
    clearConnectTimeout()
    stopHeartbeat()
    socketTask = null
    if (!isManualClose) reconnect()
  })
}

/** 断线重连（递增退避） */
function reconnect() {
  if (retryCount >= config.wsMaxRetry) {
    console.warn('[WS] 达到最大重连次数，停止重连')
    wx.showToast({ title: '实时连接断开，请刷新页面', icon: 'none' })
    return
  }
  if (subscribers.size === 0) return
  retryCount++
  const delay = config.wsRetryInterval * retryCount
  console.log('[WS] 第 ' + retryCount + ' 次重连，' + delay + 'ms 后执行')
  setTimeout(function () {
    if (subscribers.size > 0) connect()
  }, delay)
}

/** 启动心跳 */
function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(function () {
    if (socketTask) {
      socketTask.send({ data: JSON.stringify({ type: 'ping' }) })
    }
  }, config.wsHeartbeatInterval)
}

/** 停止心跳 */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

/** 主动发送消息 */
function send(msg) {
  // Mock 模式：模拟后端收到 device_bind 后推送 device_list_change
  if (config.mock) {
    if (typeof msg === 'string') {
      try { msg = JSON.parse(msg) } catch (e) { return }
    }
    if (msg && msg.type === 'device_bind') {
      setTimeout(function () {
        subscribers.forEach(function (fn) {
          try {
            fn({ type: 'device_list_change', data: { action: msg.data.action, deviceId: msg.data.deviceId } })
          } catch (e) {
            console.error('[WS-Mock] 推送 device_list_change 异常', e)
          }
        })
      }, 200)
    }
    return
  }
  // 真实模式：发送给后端
  if (socketTask) {
    socketTask.send({ data: typeof msg === 'string' ? msg : JSON.stringify(msg) })
  }
}

/** 取消订阅；无订阅者时关闭连接 */
function unsubscribe(fn) {
  subscribers.delete(fn)
  if (subscribers.size === 0) {
    isManualClose = true
    stopHeartbeat()
    clearPongTimer()
    stopMockPush()
    if (socketTask) {
      socketTask.close({})
      socketTask = null
    }
  }
}

/** 强制关闭（如退出登录时调用） */
function closeAll() {
  subscribers.clear()
  isManualClose = true
  clearConnectTimeout()
  clearPongTimer()
  stopHeartbeat()
  stopMockPush()
  if (socketTask) {
    socketTask.close({})
    socketTask = null
  }
}

module.exports = {
  subscribe: subscribe,
  unsubscribe: unsubscribe,
  send: send,
  closeAll: closeAll
}
