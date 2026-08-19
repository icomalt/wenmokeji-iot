/**
 * 设备路由：列表/详情/增删/打印/历史/统计
 */
const express = require('express')
const config = require('../config')
const store = require('../store')
const wsService = require('../ws')

const router = express.Router()

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
  const keyword = req.query.keyword || ''
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || config.defaultPageSize
  let devices = store.getDevicesByCustomer(req.user.customerId)
  if (keyword) {
    devices = devices.filter(d => d.deviceId.indexOf(keyword) !== -1 || d.deviceName.indexOf(keyword) !== -1)
  }
  const start = (page - 1) * pageSize
  res.json({ code: 0, message: 'success', data: { list: devices.slice(start, start + pageSize), total: devices.length } })
})

// 详情
router.get('/detail', function (req, res) {
  const deviceId = req.query.deviceId
  if (!deviceId) return res.json({ code: 1, message: '缺少 deviceId', data: null })
  if (!store.isDeviceOwnedByCustomer(deviceId, req.user.customerId)) {
    return res.json({ code: 1, message: '设备不存在或无权访问', data: null })
  }
  const device = store.getDeviceById(deviceId)
  if (!device) return res.json({ code: 1, message: '设备不存在', data: null })
  res.json({ code: 0, message: 'success', data: { device } })
})

// 添加设备
router.post('/add', function (req, res) {
  const { deviceId } = req.body
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
router.post('/delete', function (req, res) {
  const { deviceId } = req.body
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
  const { deviceId, content, fontSize, count, immediate } = req.body
  if (!deviceId) return res.json({ code: 1, message: '缺少 deviceId', data: null })
  if (!content) return res.json({ code: 1, message: '请输入打印内容', data: null })
  const numCount = Number(count)
  if (isNaN(numCount) || numCount < 1) return res.json({ code: 1, message: '打印次数需为≥1的数字', data: null })
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
  const deviceId = req.query.deviceId
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || config.defaultPageSize
  if (!deviceId) return res.json({ code: 1, message: '缺少 deviceId', data: null })
  if (!store.isDeviceOwnedByCustomer(deviceId, req.user.customerId)) {
    return res.json({ code: 1, message: '设备不存在或无权访问', data: null })
  }
  res.json({ code: 0, message: 'success', data: store.getHistoryByDevice(deviceId, page, pageSize) })
})

module.exports = router
