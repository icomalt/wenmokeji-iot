/**
 * Mock 数据生成器（数据可变持久化版）
 * 
 * 【核心特性】
 * 1. 多租户数据隔离：根据 customerId 返回不同数据
 * 2. 数据可变持久化：打印下发会真正修改内存数据
 *    → 各页面看到的数据实时联动
 * 3. 新增 /device/statistic 接口供首页使用
 * 
 * 【客户数据隔离说明】
 * customer_001：5台设备
 * customer_002：2台设备
 * customer_003：0台设备（测试空数据）
 */
const auth = require('./auth')

// ==================== 可变运行时数据（内存持久化） ====================
// 使用深拷贝初始化，保证每次登录重置为干净状态

const INITIAL_DEVICES = {
  customer_001: [
    { deviceId: 'DEV001', deviceName: '1号喷码机', deviceType: '大字符喷码机', onlineStatus: 1, faultStatus: 0, printContent: 'A12345', printTime: '2024-05-20 10:30:00' },
    { deviceId: 'DEV002', deviceName: '2号喷码机', deviceType: '小字符喷码机', onlineStatus: 1, faultStatus: 0, printContent: 'B67890', printTime: '2024-05-20 11:15:00' },
    { deviceId: 'DEV003', deviceName: '3号喷码机', deviceType: '大字符喷码机', onlineStatus: 0, faultStatus: 0, printContent: '--', printTime: '--' },
    { deviceId: 'DEV004', deviceName: '4号喷码机', deviceType: '小字符喷码机', onlineStatus: 1, faultStatus: 1, printContent: 'C11223', printTime: '2024-05-20 09:45:00' },
    { deviceId: 'DEV005', deviceName: '5号喷码机', deviceType: '大字符喷码机', onlineStatus: 1, faultStatus: 0, printContent: 'D45678', printTime: '2024-05-19 16:20:00' }
  ],
  customer_002: [
    { deviceId: 'DEV006', deviceName: '6号喷码机', deviceType: '小字符喷码机', onlineStatus: 1, faultStatus: 0, printContent: 'E90123', printTime: '2024-05-20 12:00:00' },
    { deviceId: 'DEV007', deviceName: '7号喷码机', deviceType: '大字符喷码机', onlineStatus: 0, faultStatus: 1, printContent: '--', printTime: '--' }
  ],
  customer_003: []
}

// 打印历史记录（按客户存储，运行时可变）
const INITIAL_HISTORY = {
  customer_001: [],
  customer_002: [],
  customer_003: []
}

// 运行时可变数据（深拷贝初始数据）
let runtimeDevices = null
let runtimeHistory = null
let initializedCustomerId = null

// 深拷贝
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

// 初始化运行时数据（登录后调用，按客户隔离）
function initRuntimeData(customerId) {
  if (initializedCustomerId !== customerId) {
    runtimeDevices = deepClone(INITIAL_DEVICES)
    runtimeHistory = deepClone(INITIAL_HISTORY)
    initializedCustomerId = customerId
  }
}

// 获取当前登录客户 ID
function getCurrentCustomerId() {
  const userInfo = auth.getUserInfo() || {}
  return userInfo.customerId || 'customer_001'
}

function getCurrentDevices() {
  initRuntimeData(getCurrentCustomerId())
  return runtimeDevices[getCurrentCustomerId()] || []
}

function getCurrentHistory() {
  initRuntimeData(getCurrentCustomerId())
  return runtimeHistory[getCurrentCustomerId()] || []
}

// 格式化当前时间
function now() {
  const d = new Date()
  const pad = function (n) { return String(n).padStart(2, '0') }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
}

// ==================== Mock 业务函数 ====================

// 设备列表（支持搜索、分页）
function getMockDeviceList(data) {
  const keyword = data.keyword || ''
  const page = data.page || 1
  const pageSize = data.pageSize || 20
  const allDevices = getCurrentDevices()

  let filtered = allDevices.filter(function (d) {
    return !keyword || d.deviceId.indexOf(keyword) !== -1 || d.deviceName.indexOf(keyword) !== -1
  })

  const start = (page - 1) * pageSize
  const list = filtered.slice(start, start + pageSize)

  return { list: list, total: filtered.length }
}

// 设备统计（供首页使用）
function getMockDeviceStatistic() {
  const devices = getCurrentDevices()
  return {
    total: devices.length,
    online: devices.filter(function (d) { return d.onlineStatus === 1 }).length,
    offline: devices.filter(function (d) { return d.onlineStatus !== 1 }).length,
    fault: devices.filter(function (d) { return d.faultStatus === 1 }).length
  }
}

// 设备详情
function getMockDeviceDetail(data) {
  const devices = getCurrentDevices()
  const device = devices.find(function (d) { return d.deviceId === data.deviceId })
  if (!device) return { device: null }

  return {
    device: Object.assign({}, device, {
      deviceParams: {
        inkLevel: '85%',
        temperature: '25°C',
        speed: '300mm/s',
        voltage: '220V',
        nozzleStatus: '正常',
        pressure: '2.5bar'
      }
    })
  }
}

// 添加设备 → 运行时数据新增一台设备
function mockAddDevice(data) {
  const devices = getCurrentDevices()
  const deviceId = data.deviceId || ('DEV' + Date.now())
  // 防止重复添加
  const exist = devices.find(function (d) { return d.deviceId === deviceId })
  if (exist) return { success: false, message: '设备已存在' }
  // 新建设备
  const newDevice = {
    deviceId: deviceId,
    deviceName: deviceId + '号喷码机',
    deviceType: '大字符喷码机',
    onlineStatus: 0,
    faultStatus: 0,
    printContent: '--',
    printTime: '--'
  }
  devices.push(newDevice)
  return { success: true, message: '添加成功', device: newDevice }
}

// 删除设备 → 运行时数据移除设备
function mockDeleteDevice(data) {
  const devices = getCurrentDevices()
  const deviceId = data.deviceId
  const idx = devices.findIndex(function (d) { return d.deviceId === deviceId })
  if (idx === -1) return { success: false, message: '设备不存在' }
  devices.splice(idx, 1)
  return { success: true, message: '删除成功' }
}

// 打印下发 → 更新设备数据 + 新增历史记录
function mockPrintDispatch(data) {
  const devices = getCurrentDevices()
  const device = devices.find(function (d) { return d.deviceId === data.deviceId })
  if (!device) return { success: false, message: '设备不存在' }

  // 更新设备的打印内容和时间
  device.printContent = data.content
  device.printTime = now()

  // 新增一条历史记录（插入到头部）
  const history = getCurrentHistory()
  history.unshift({
    recordId: 'REC' + Date.now(),
    deviceId: data.deviceId,
    printContent: data.content,
    printTime: device.printTime,
    operator: (auth.getUserInfo() || {}).username || 'admin',
    status: 1,
    count: data.count || 1
  })

  return { success: true, message: '下发成功' }
}

// 打印历史（从运行时历史记录读取）
function getMockPrintHistory(data) {
  const devices = getCurrentDevices()
  const device = devices.find(function (d) { return d.deviceId === data.deviceId })
  if (!device) return { list: [], total: 0 }

  // 如果运行时没有历史记录，生成初始模拟数据
  let history = getCurrentHistory()
  if (history.length === 0) {
    for (let i = 0; i < 3; i++) {
      history.push({
        recordId: 'REC_INIT_' + i,
        deviceId: data.deviceId,
        printContent: 'INIT-' + (1000 + i),
        printTime: '2024-05-20 ' + String(10 + i).padStart(2, '0') + ':30:00',
        operator: '系统',
        status: 1,
        count: 1
      })
    }
  }

  return { list: history, total: history.length }
}

// 模拟登录（根据用户名分配 customerId）
function mockLogin(data) {
  let customerId = 'customer_001'
  if (data && data.username) {
    if (data.username.indexOf('002') !== -1) customerId = 'customer_002'
    if (data.username.indexOf('003') !== -1) customerId = 'customer_003'
  }

  // 重置运行时数据（新登录使用干净数据）
  initializedCustomerId = null
  initRuntimeData(customerId)

  return {
    token: 'mock_token_' + Date.now(),
    refreshToken: 'mock_refresh_token_' + Date.now(),
    expiresIn: 7200,
    userInfo: {
      username: (data && data.username) || 'admin',
      name: '系统管理员',
      role: 'admin',
      customerId: customerId
    }
  }
}

// ==================== Mock 路由分发 ====================

function getMockResponse(url, data) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      let result = null

      if (url.indexOf('/auth/logout') !== -1) {
        result = { success: true, message: '登出成功' }
      } else if (url.indexOf('/auth/verify-admin') !== -1) {
        // Mock 模式：密码 wenmo123 为管理员密码
        result = data && data.password === 'wenmo123'
          ? { success: true, message: '验证通过' }
          : { code: 1, message: '密码错误' }
      } else if (url.indexOf('/auth/login') !== -1) {
        result = mockLogin(data)
      } else if (url.indexOf('/device/statistic') !== -1) {
        result = getMockDeviceStatistic()
      } else if (url.indexOf('/device/list') !== -1) {
        result = getMockDeviceList(data)
      } else if (url.indexOf('/device/detail') !== -1) {
        result = getMockDeviceDetail(data)
      } else if (url.indexOf('/device/add') !== -1) {
        result = mockAddDevice(data)
      } else if (url.indexOf('/device/delete') !== -1) {
        result = mockDeleteDevice(data)
      } else if (url.indexOf('/device/print/dispatch') !== -1) {
        result = mockPrintDispatch(data)
      } else if (url.indexOf('/device/print/history') !== -1) {
        result = getMockPrintHistory(data)
      } else {
        result = { code: 0, data: null }
      }

      resolve({ code: 0, message: 'success', data: result })
    }, 300)
  })
}

module.exports = {
  getMockResponse: getMockResponse
}
