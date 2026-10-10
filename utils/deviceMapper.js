/**
 * 设备数据映射工具 —— 对接文墨物联网平台
 * ============================================================
 * 平台列表字段：dev_id, product_model, imei, lessee_name,
 *              user_nickname, dmc_ver, status, last_login, ...
 * 平台详情字段：device_id, product_model, tenant_name, user_name,
 *              cpu, mem_usage, disk_usage, csq, lat, lon, ...
 *
 * 平台 status 字段含义：
 *   1 - 未激活
 *   2 - 在线
 *   3 - 离线
 *
 * 小程序内部也统一使用 1/2/3，避免与公司平台语义错位。
 */

function getStatusText(status, statusStr) {
  var value = Number(status)
  if (value === 2) return '在线'
  if (value === 1) return '未激活'
  if (value === 3) return '离线'

  if (statusStr) {
    var text = String(statusStr).toLowerCase()
    if (text.indexOf('在线') !== -1 || text.indexOf('online') !== -1) return '在线'
    if (text.indexOf('未激活') !== -1 || text.indexOf('not active') !== -1 || text.indexOf('inactive') !== -1) return '未激活'
    if (text.indexOf('离线') !== -1 || text.indexOf('offline') !== -1) return '离线'
  }
  return '离线'
}

function normalizeStatus(rawStatus, statusStr) {
  if (typeof rawStatus === 'boolean') return rawStatus ? 2 : 3
  if (rawStatus !== undefined && rawStatus !== null) {
    if (typeof rawStatus === 'number' || /^\d+$/.test(String(rawStatus).trim())) {
      var value = Number(rawStatus)
      if (value === 1 || value === 2 || value === 3) return value
      if (value === 0) return 3
    }
    var text = String(rawStatus).toLowerCase()
    if (text.indexOf('未激活') !== -1 || text.indexOf('not active') !== -1 || text.indexOf('inactive') !== -1) return 1
    if (text.indexOf('在线') !== -1 || text.indexOf('online') !== -1) return 2
    if (text.indexOf('离线') !== -1 || text.indexOf('offline') !== -1) return 3
  }

  if (statusStr) {
    var statusText = String(statusStr).toLowerCase()
    if (statusText.indexOf('未激活') !== -1 || statusText.indexOf('not active') !== -1 || statusText.indexOf('inactive') !== -1) return 1
    if (statusText.indexOf('在线') !== -1 || statusText.indexOf('online') !== -1) return 2
    if (statusText.indexOf('离线') !== -1 || statusText.indexOf('offline') !== -1) return 3
  }
  return 3
}

/**
 * 将平台设备数据映射为小程序统一格式。
 * 同时兼容本项目旧 mock 数据中的 onlineStatus/faultStatus。
 */
function mapDevice(d) {
  if (!d || typeof d !== 'object') {
    return {
      deviceId: '',
      deviceName: '未知设备',
      deviceType: '未知型号',
      onlineStatus: 3,
      statusText: '离线',
      imei: '',
      lastLogin: '',
      onlineDuration: '',
      offlineDuration: '',
      lesseeName: '',
      companyName: '',
      customerName: '',
      firmwareVersion: '',
      cpu: '',
      memoryUsage: '',
      diskUsage: '',
      signalStrength: '',
      iccid: '',
      batteryVoltage: '',
      latitude: '',
      longitude: '',
      deviceModel: '',
      deviceSn: '',
      sensorCount: ''
    }
  }

  var statusStr = d.status_str || d.statusText || d.status_text || d.online_status_str || d.state_str || d.state || ''
  var hasPlatformStatus = d.status !== undefined && d.status !== null
  var status

  if (hasPlatformStatus) {
    status = normalizeStatus(d.status, statusStr)
  } else if (d.device_status !== undefined || d.net_status !== undefined || d.run_status !== undefined ||
             d.online_status !== undefined || d.is_online !== undefined) {
    status = normalizeStatus(
      d.device_status !== undefined ? d.device_status :
      (d.net_status !== undefined ? d.net_status :
      (d.run_status !== undefined ? d.run_status :
      (d.online_status !== undefined ? d.online_status : d.is_online))),
      statusStr
    )
  } else {
    // 兼容本地 mock/旧后端：onlineStatus=1/2 表示在线，0 表示离线。
    var faultVal = Number(d.faultStatus !== undefined ? d.faultStatus : d.fault_status)
    var onlineVal = Number(d.onlineStatus !== undefined ? d.onlineStatus : d.online_status)
    if (faultVal === 1) status = 1
    else if (onlineVal === 1 || onlineVal === 2 || d.is_online === true) status = 2
    else status = 3
  }

  var deviceId = d.dev_id || d.device_id || d.deviceId || d.id || ''
  var deviceName = d.product_name || d.device_name || d.deviceName || d.productName || d.product_model || deviceId || '喷码机'

  return {
    deviceId: deviceId,
    deviceName: deviceName,
    deviceType: d.product_model || d.deviceType || '喷码机',

    onlineStatus: status,
    statusText: getStatusText(status, statusStr),

    imei: d.imei || '',
    iccid: d.iccid || '',

    lastLogin: d.last_login || d.lastLogin || '',
    onlineDuration: d.online_duration || '',
    offlineDuration: d.offline_duration || '',
    updateTime: d.update_time || '',

    lesseeName: d.lessee_name || d.tenant_name || d.tenantName || d.company_name || d.company || d.lessee || '',
    companyName: d.user_nickname || d.user_name || d.username || d.customerName || '',
    customerName: d.user_nickname || d.user_name || d.customerName || d.username || '',
    userId: d.user_id || d.userid || '',
    tenantId: d.tenant_id || d.tenantId || d.lessee_id || '',

    firmwareVersion: d.dmc_ver || '',
    cpu: d.cpu || '',
    memoryUsage: d.mem_usage || '',
    diskUsage: d.disk_usage || '',
    signalStrength: d.csq !== undefined ? d.csq : '',
    batteryVoltage: d.m4g_vbat || '',
    powerType: d.power_type || '',

    upFlow: d.up_flow || '',
    downFlow: d.down_flow || '',

    latitude: d.lat || d.latitude || '',
    longitude: d.lon || d.longitude || '',

    deviceModel: d.product_model || '',
    deviceSn: deviceId,
    sensorCount: d.sensor_cnt !== undefined ? d.sensor_cnt : '',
    productName: d.product_name || ''
  }
}

function parseDeviceListResponse(res) {
  var rawList = []
  var total = 0

  if (!res) return { list: [], total: 0 }

  if (Array.isArray(res)) {
    rawList = res
    total = res.length
  } else if (res.device && Array.isArray(res.device)) {
    rawList = res.device
    total = res.total || rawList.length
  } else if (res.list && Array.isArray(res.list)) {
    rawList = res.list
    total = res.total || rawList.length
  } else if (res.data && Array.isArray(res.data)) {
    rawList = res.data
    total = res.data_total || rawList.length
  } else if (res.data && res.data.device && Array.isArray(res.data.device)) {
    rawList = res.data.device
    total = res.data.total || rawList.length
  } else if (res.data && res.data.list && Array.isArray(res.data.list)) {
    rawList = res.data.list
    total = res.data.total || rawList.length
  }

  return { list: rawList.map(mapDevice), total: total || rawList.length }
}

function parseDeviceDetailResponse(res) {
  if (!res) return null

  var raw = null
  if (res.data && res.data.info && typeof res.data.info === 'object') {
    raw = res.data.info
  } else if (res.info && typeof res.info === 'object') {
    raw = res.info
  } else if (res.data && res.data.device && typeof res.data.device === 'object') {
    raw = res.data.device
  } else if (res.device && typeof res.device === 'object') {
    raw = res.device
  } else if (res.result && typeof res.result === 'object') {
    raw = res.result
  } else if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
    raw = res.data
  } else if (res.dev_id || res.device_id || res.deviceId || res.id || res.device_name) {
    raw = res
  }

  return raw ? mapDevice(raw) : null
}

function calculateStats(list) {
  if (!Array.isArray(list)) {
    return { total: 0, online: 0, inactive: 0, offline: 0, fault: 0 }
  }

  var online = 0
  var inactive = 0
  var offline = 0

  list.forEach(function (d) {
    if (d.onlineStatus === 2) online++
    else if (d.onlineStatus === 1) inactive++
    else offline++
  })

  return {
    total: list.length,
    online: online,
    inactive: inactive,
    offline: offline,
    // 保留 fault 字段名，避免旧页面读取时报错；平台没有单独故障状态。
    fault: inactive
  }
}

module.exports = {
  mapDevice: mapDevice,
  parseDeviceListResponse: parseDeviceListResponse,
  parseDeviceDetailResponse: parseDeviceDetailResponse,
  calculateStats: calculateStats,
  getStatusText: getStatusText
}