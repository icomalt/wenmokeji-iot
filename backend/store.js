/**
 * 内存数据存储
 */
const users = [
  { id: 'U001', username: 'admin', password: '123456', customerId: 'C001', role: 'admin' },
  { id: 'U002', username: 'user002', password: '123456', customerId: 'C002', role: 'user' },
  { id: 'U003', username: 'user003', password: '123456', customerId: 'C003', role: 'user' }
]

const customers = [
  { id: 'C001', name: '某某包装有限公司' },
  { id: 'C002', name: '某某食品加工厂' },
  { id: 'C003', name: '某某制药有限公司' }
]

const devices = [
  { deviceId: 'DEV001', deviceName: '1号喷码机', deviceType: '大字符喷码机', onlineStatus: 1, faultStatus: 0, printContent: 'A12345', printTime: '2024-05-20 10:30:00' },
  { deviceId: 'DEV002', deviceName: '2号喷码机', deviceType: '小字符喷码机', onlineStatus: 1, faultStatus: 0, printContent: 'B67890', printTime: '2024-05-20 11:15:00' },
  { deviceId: 'DEV003', deviceName: '3号喷码机', deviceType: '大字符喷码机', onlineStatus: 0, faultStatus: 0, printContent: '--', printTime: '--' },
  { deviceId: 'DEV004', deviceName: '4号喷码机', deviceType: '小字符喷码机', onlineStatus: 1, faultStatus: 1, printContent: 'C11223', printTime: '2024-05-20 09:45:00' },
  { deviceId: 'DEV005', deviceName: '5号喷码机', deviceType: '大字符喷码机', onlineStatus: 1, faultStatus: 0, printContent: 'D45678', printTime: '2024-05-19 16:20:00' },
  { deviceId: 'DEV006', deviceName: '6号喷码机', deviceType: '小字符喷码机', onlineStatus: 1, faultStatus: 0, printContent: 'E90123', printTime: '2024-05-20 12:00:00' },
  { deviceId: 'DEV007', deviceName: '7号喷码机', deviceType: '大字符喷码机', onlineStatus: 0, faultStatus: 1, printContent: '--', printTime: '--' }
]

const deviceBindings = {
  'C001': ['DEV001', 'DEV002', 'DEV003', 'DEV004', 'DEV005'],
  'C002': ['DEV006', 'DEV007'],
  'C003': []
}

const printHistory = [
  { recordId: 'REC100001', deviceId: 'DEV001', printContent: 'A12345', printTime: '2024-05-20 10:30:00', operator: 'admin', status: 1, count: 10 },
  { recordId: 'REC100002', deviceId: 'DEV002', printContent: 'B67890', printTime: '2024-05-20 11:15:00', operator: 'admin', status: 1, count: 5 },
  { recordId: 'REC100003', deviceId: 'DEV004', printContent: 'C11223', printTime: '2024-05-20 09:45:00', operator: 'admin', status: 1, count: 20 },
  { recordId: 'REC100004', deviceId: 'DEV005', printContent: 'D45678', printTime: '2024-05-19 16:20:00', operator: 'admin', status: 1, count: 3 },
  { recordId: 'REC100005', deviceId: 'DEV006', printContent: 'E90123', printTime: '2024-05-20 12:00:00', operator: 'user002', status: 1, count: 8 },
  { recordId: 'REC100006', deviceId: 'DEV001', printContent: 'F00001', printTime: '2024-05-20 14:05:00', operator: 'admin', status: 1, count: 15 },
  { recordId: 'REC100007', deviceId: 'DEV002', printContent: 'G00002', printTime: '2024-05-20 15:30:00', operator: 'admin', status: 1, count: 1 },
  { recordId: 'REC100008', deviceId: 'DEV004', printContent: 'H00003', printTime: '2024-05-20 16:45:00', operator: 'admin', status: 1, count: 50 },
  { recordId: 'REC100009', deviceId: 'DEV005', printContent: 'I00004', printTime: '2024-05-20 17:20:00', operator: 'admin', status: 1, count: 12 },
  { recordId: 'REC100010', deviceId: 'DEV006', printContent: 'J00005', printTime: '2024-05-20 18:00:00', operator: 'user002', status: 1, count: 7 }
]
const refreshTokens = {}
const tokenBlacklist = new Set()

function now() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
}

function getDevicesByCustomer(customerId) {
  const ids = deviceBindings[customerId] || []
  return devices.filter(d => ids.includes(d.deviceId))
}

function getDeviceById(deviceId) {
  return devices.find(d => d.deviceId === deviceId)
}

function getUserByUsername(username) {
  return users.find(u => u.username === username)
}

function getCustomerById(customerId) {
  return customers.find(c => c.id === customerId)
}

function isDeviceOwnedByCustomer(deviceId, customerId) {
  const ids = deviceBindings[customerId] || []
  return ids.includes(deviceId)
}

function bindDeviceToCustomer(deviceId, customerId) {
  if (!deviceBindings[customerId]) deviceBindings[customerId] = []
  if (!deviceBindings[customerId].includes(deviceId)) {
    deviceBindings[customerId].push(deviceId)
  }
}

function unbindDeviceFromCustomer(deviceId, customerId) {
  if (!deviceBindings[customerId]) return
  deviceBindings[customerId] = deviceBindings[customerId].filter(id => id !== deviceId)
}

function addHistoryRecord(record) {
  printHistory.unshift(record)
}

function getHistoryByDevice(deviceId, page, pageSize) {
  const list = printHistory.filter(r => r.deviceId === deviceId)
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total: list.length }
}

module.exports = {
  users, customers, devices, deviceBindings, printHistory,
  refreshTokens, tokenBlacklist, now,
  getDevicesByCustomer, getDeviceById, getUserByUsername, getCustomerById,
  isDeviceOwnedByCustomer, bindDeviceToCustomer, unbindDeviceFromCustomer,
  addHistoryRecord, getHistoryByDevice
}
