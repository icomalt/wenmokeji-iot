/**
 * 设备路由：列表/详情/增删/打印/历史/统计
 */
const express = require('express')
const config = require('../config')
const store = require('../store')
const wsService = require('../ws')

const router = express.Router()

// BUG-008 兼容层：同时接受 snake_case 与 camelCase 字段
// 前端发 device_id/font_size/print_count/page_num/page_size；后端历史代码用 deviceId/fontSize/count/page/pageSize
function pick(body, query, camel, snake) {
  if (body && body[camel] !== undefined) return body[camel]
  if (body && body[snake] !== undefined) return body[snake]
  if (query && query[camel] !== undefined) return query[camel]
  if (query && query[snake] !== undefined) return query[snake]
  return undefined
}
function clampPageSize(v) {
  const n = parseInt(v) || config.defaultPageSize
  return Math.min(Math.max(1, n), 100) // BUG-011: 上限 100
}

// 统计
router.get('/statistic', function (req, res) {
  const devices = store.getDevicesByCustomer(req.user.customerId)
  res.json({
    code: 0, message: 'success', data: {
      total: devices.length,
      online: devices.filter(d => d.onlineStatus === 1).length,
      offline: devices.filter(d => d.onlineStatus !== 1).length,
      fault: devices.filter(d => d.faultStatus === 1).length
    }
  })
})

// 列表
router.get('/list', function (req, res) {
  const keyword = req.query.keyword || req.query.device_name || ''
  const page = parseInt(req.query.page || req.query.page_num) || 1
  const pageSize = clampPageSize(req.query.pageSize || req.query.page_size)
  let devices = store.getDevicesByCustomer(req.user.customerId)
  if (keyword) {
    devices = devices.filter(d => d.deviceId.indexOf(keyword) !== -1 || d.deviceName.indexOf(keyword) !== -1)
  }
  const start = (page - 1) * pageSize
  res.json({ code: 0, message: 'success', data: { list: devices.slice(start, start + pageSize), total: devices.length } })
})

// 详情
router.get('/detail', function (req, res) {
  const deviceId = req.query.deviceId || req.query.device_id
  if (!deviceId) return res.json({ code: 1, message: '缺少 deviceId', data: null })
  if (!store.isDeviceOwnedByCustomer(deviceId, req.user.customerId)) {
    return res.json({ code: 1, message: '设备不存在或无权访问', data: null })
  }
  const device = store.getDeviceById(deviceId)
  if (!device) return res.json({ code: 1, message: '设备不存在', data: null })
  res.json({ code: 0, message: 'success', data: { device } })
})

// BUG-002 修复：添加/删除设备必须是管理员
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '需要管理员权限', data: null })
  }
  next()
}

// 添加设备
router.post('/add', requireAdmin, function (req, res) {
  const deviceId = pick(req.body, null, 'deviceId', 'device_id')
  if (!deviceId) return res.json({ code: 1, message: '请输入设备ID', data: null })
  const device = store.getDeviceById(deviceId)
  if (!device) return res.json({ code: 1, message: '设备不存在于平台', data: null })
  if (store.isDeviceOwnedByCustomer(deviceId, req.user.customerId)) {
    return res.json({ code: 1, message: '设备已添加', data: null })
  }
  store.bindDeviceToCustomer(deviceId, req.user.customerId)
  wsService.broadcastToCustomer(req.user.customerId, { type: 'device_list_change', data: { action: 'add', deviceId } })
  res.json({ code: 0, message: 'success', data: { success: true } })
})

// 删除设备
router.post('/delete', requireAdmin, function (req, res) {
  const deviceId = pick(req.body, null, 'deviceId', 'device_id')
  if (!deviceId) return res.json({ code: 1, message: '缺少 deviceId', data: null })
  if (!store.isDeviceOwnedByCustomer(deviceId, req.user.customerId)) {
    return res.json({ code: 1, message: '设备不存在或无权操作', data: null })
  }
  store.unbindDeviceFromCustomer(deviceId, req.user.customerId)
  wsService.broadcastToCustomer(req.user.customerId, { type: 'device_list_change', data: { action: 'remove', deviceId } })
  res.json({ code: 0, message: 'success', data: { success: true } })
})

// 打印下发
router.post('/print/dispatch', function (req, res) {
  const deviceId = pick(req.body, null, 'deviceId', 'device_id')
  const content = req.body.content
  const countRaw = pick(req.body, null, 'count', 'print_count')
  const immediate = req.body.immediate
  if (!deviceId) return res.json({ code: 1, message: '缺少 deviceId', data: null })
  if (!content) return res.json({ code: 1, message: '请输入打印内容', data: null })
  // BUG-010: 内容长度上限 500，次数上限 99
  if (content.length > 500) return res.json({ code: 1, message: '打印内容不能超过 500 字', data: null })
  const numCount = Number(countRaw)
  if (isNaN(numCount) || numCount < 1) return res.json({ code: 1, message: '打印次数需为≥1的数字', data: null })
  if (numCount > 99) return res.json({ code: 1, message: '单次打印次数不能超过 99', data: null })
  if (!store.isDeviceOwnedByCustomer(deviceId, req.user.customerId)) {
    return res.json({ code: 1, message: '设备不存在或无权操作', data: null })
  }
  const device = store.getDeviceById(deviceId)
  if (device.onlineStatus !== 1) return res.json({ code: 1, message: '设备离线，无法下发', data: null })
  device.printContent = content
  device.printTime = store.now()
  store.addHistoryRecord({
    recordId: 'REC' + Date.now(), deviceId, printContent: content, printTime: device.printTime,
    operator: req.user.username, status: 1, count: numCount
  })
  wsService.broadcastToCustomer(req.user.customerId, {
    type: 'device_status',
    data: { deviceId, printContent: device.printContent, printTime: device.printTime }
  })
  res.json({ code: 0, message: 'success', data: { success: true, message: '下发成功' } })
})

// 打印历史
router.get('/print/history', function (req, res) {
  const deviceId = req.query.deviceId || req.query.device_id
  const page = parseInt(req.query.page || req.query.page_num) || 1
  const pageSize = clampPageSize(req.query.pageSize || req.query.page_size)
  const date = req.query.date // BUG-016: 日期筛选
  if (!deviceId) return res.json({ code: 1, message: '缺少 deviceId', data: null })
  if (!store.isDeviceOwnedByCustomer(deviceId, req.user.customerId)) {
    return res.json({ code: 1, message: '设备不存在或无权访问', data: null })
  }
  const result = store.getHistoryByDevice(deviceId, page, pageSize, date)
  res.json({ code: 0, message: 'success', data: result })
})

module.exports = router
