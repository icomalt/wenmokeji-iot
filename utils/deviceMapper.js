/**
 * 设备数据映射工具 —— 统一管理平台字段到前端字段的映射
 * ============================================================
 * 平台字段：dev_id, device_name, product_model, status, status_str, 
 *          csq, cpu, mem_usage, m4g_vbat, imei, last_login, ...
 *          
 * 前端统一字段：deviceId, deviceName, deviceType, onlineStatus, 
 *              statusText, imei, lastLogin, onlineDuration, ...
 * 
 * 平台 status 字段含义：
 *   0 - 离线
 *   1 - 故障
 *   2 - 在线
 */

/**
 * 解析设备状态文本
 * @param {Number|String} status 平台状态值
 * @param {String} statusStr 平台状态文本
 * @returns {String} 状态文本
 */
function getStatusText(status, statusStr) {
  if (statusStr) return statusStr
  if (status === 2) return '在线'
  if (status === 1) return '故障'
  return '离线'
}

/**
 * 将平台设备数据映射为前端统一格式
 * @param {Object} d 平台原始数据
 * @returns {Object} 前端统一格式的设备对象（始终返回对象，永不返回 null）
 */
function mapDevice(d) {
  if (!d || typeof d !== 'object') {
    // 返回一个默认对象，而不是 null，避免过滤导致数量不一致
    return {
      deviceId: '',
      deviceName: '未知设备',
      deviceType: '未知型号',
      onlineStatus: 0,
      statusText: '离线',
      imei: '',
      lastLogin: '',
      onlineDuration: '',
      lesseeName: '',
      customerName: '',
      firmwareVersion: '',
      cpu: '',
      memoryUsage: '',
      signalStrength: '',
      iccid: '',
      batteryVoltage: '',
      latitude: '',
      longitude: '',
      deviceModel: '',
      deviceSn: ''
    }
  }
  
  // ===== 兼容多种状态字段名 =====
  // 列表接口可能用 status，详情接口可能用 online_status / is_online 等
  var rawStatus = d.status
  if (rawStatus === undefined || rawStatus === null) rawStatus = d.onlineStatus
  if (rawStatus === undefined || rawStatus === null) rawStatus = d.online_status
  if (rawStatus === undefined || rawStatus === null) rawStatus = d.is_online
  if (rawStatus === undefined || rawStatus === null) rawStatus = d.net_status
  if (rawStatus === undefined || rawStatus === null) rawStatus = d.device_status
  if (rawStatus === undefined || rawStatus === null) rawStatus = d.run_status

  // 兼容多种状态文本字段名
  var statusStr = d.status_str || d.statusText || d.status_text || d.online_status_str || d.state_str || d.state || ''

  var status = 0
  if (rawStatus !== undefined && rawStatus !== null) {
    if (typeof rawStatus === 'number') {
      status = rawStatus
    } else if (typeof rawStatus === 'boolean') {
      status = rawStatus ? 2 : 0
    } else if (typeof rawStatus === 'string') {
      var parsed = parseInt(rawStatus, 10)
      if (!isNaN(parsed)) {
        status = parsed
      } else if (rawStatus.indexOf('在线') !== -1 || rawStatus.indexOf('online') !== -1) {
        status = 2
      } else if (rawStatus.indexOf('故障') !== -1 || rawStatus.indexOf('fault') !== -1) {
        status = 1
      } else if (rawStatus.indexOf('离线') !== -1 || rawStatus.indexOf('offline') !== -1) {
        status = 0
      }
    }
  }

  // 如果数字状态默认为0，但statusStr显示在线，则用文本推断数字状态
  if (status === 0 && statusStr) {
    if (statusStr.indexOf('在线') !== -1) {
      status = 2
    } else if (statusStr.indexOf('故障') !== -1) {
      status = 1
    }
  }
  
  return {
    // 基础标识
    deviceId: d.dev_id || d.deviceId || d.id || '',
    deviceName: d.device_name || d.deviceName || d.productName || '喷码机',
    deviceType: d.product_model || d.deviceType || 'K300',
    
    // 状态相关
    onlineStatus: status,
    statusText: getStatusText(status, statusStr),
    
    // 设备标识
    imei: d.imei || '',
    iccid: d.iccid || '',
    
    // 时间相关
    lastLogin: d.last_login || d.lastLogin || '',
    onlineDuration: d.online_duration || '',
    updateTime: d.update_time || '',
    
    // 客户/租户信息（兼容多种字段名）
    lesseeName: d.lessee_name || d.tenant_name || d.tenantName || d.company || d.company_name || d.lessee || '',
    customerName: d.user_nickname || d.customerName || d.user_name || d.username || '',
    userId: d.user_id || d.userid || '',
    tenantId: d.tenant_id || d.tenantId || d.lessee_id || '',
    
    // 硬件信息
    firmwareVersion: d.dmc_ver || '',
    cpu: d.cpu || '',
    memoryUsage: d.mem_usage || '',
    diskUsage: d.disk_usage || '',
    signalStrength: d.csq !== undefined ? d.csq : '',
    batteryVoltage: d.m4g_vbat || '',
    powerType: d.power_type || '',
    
    // 网络信息
    upFlow: d.up_flow || '',
    downFlow: d.down_flow || '',
    
    // 位置信息
    latitude: d.lat || '',
    longitude: d.lon || '',
    
    // 产品型号（冗余，便于展示）
    deviceModel: d.product_model || '',
    deviceSn: d.dev_id || ''
  }
}

/**
 * 解析设备列表接口响应
 * @param {Object|Array} res 接口响应（已通过 request.js 处理）
 * @returns {Object} { list: Array, total: Number }
 */
function parseDeviceListResponse(res) {
  var rawList = []
  var total = 0
  
  if (!res) {
    return { list: [], total: 0 }
  }
  
  // res 直接是数组
  if (Array.isArray(res)) {
    rawList = res
    total = res.length
  } else if (res.device && Array.isArray(res.device)) {
    // res 是 { device: [...], total: N }
    rawList = res.device
    total = res.total || rawList.length
  } else if (res.list && Array.isArray(res.list)) {
    // res 是 { list: [...], total: N }
    rawList = res.list
    total = res.total || rawList.length
  } else if (res.data && Array.isArray(res.data)) {
    // res.data 是数组
    rawList = res.data
    total = res.data_total || rawList.length
  } else if (res.data && res.data.device && Array.isArray(res.data.device)) {
    // 嵌套格式
    rawList = res.data.device
    total = res.data.total || rawList.length
  }
  
  // 映射字段（不再过滤，保证数量一致）
  var list = rawList.map(mapDevice)
  
  return { list: list, total: total || list.length }
}

/**
 * 解析设备详情接口响应
 * @param {Object} res 接口响应（已通过 request.js 处理）
 * @returns {Object|null} 设备对象
 */
function parseDeviceDetailResponse(res) {
  if (!res) {
    return null
  }
  
  var raw = null
  
  // 尝试多种格式解析
  if (res.device && typeof res.device === 'object') {
    raw = res.device
  } else if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
    raw = res.data
  } else if (res.info && typeof res.info === 'object') {
    raw = res.info
  } else if (res.result && typeof res.result === 'object') {
    raw = res.result
  } else if (res.dev_id || res.deviceId || res.id || res.device_name) {
    raw = res  // res 本身就是设备对象
  } else if (res.data && typeof res.data === 'object' && res.data.device) {
    raw = res.data.device
  }
  
  if (!raw) {
    return null
  }
  
  return mapDevice(raw)
}

/**
 * 计算设备统计
 * @param {Array} list 设备列表
 * @returns {Object} { total, online, offline, fault }
 */
function calculateStats(list) {
  if (!Array.isArray(list)) {
    return { total: 0, online: 0, offline: 0, fault: 0 }
  }
  
  var online = 0
  var offline = 0
  var fault = 0
  
  list.forEach(function (d) {
    if (d.onlineStatus === 2) {
      // 在线
      online++
    } else if (d.onlineStatus === 1) {
      // 故障（设备可能在线但有故障，或离线故障）
      fault++
      offline++  // 故障设备同时计入离线
    } else {
      // 离线
      offline++
    }
  })
  
  return {
    total: list.length,
    online: online,
    offline: offline,
    fault: fault
  }
}

module.exports = {
  mapDevice: mapDevice,
  parseDeviceListResponse: parseDeviceListResponse,
  parseDeviceDetailResponse: parseDeviceDetailResponse,
  calculateStats: calculateStats,
  getStatusText: getStatusText
}