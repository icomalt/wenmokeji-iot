/**
 * 设备详情页逻辑 —— 对接公司物联网平台
 * 1. 进入拉取设备详情 /device/info?device_id=xxx
 * 2. 映射平台字段到前端统一格式
 * 3. 页面销毁时清理
 */
const api = require('../../utils/request')
const ws = require('../../utils/websocket')

/**
 * 将平台设备数据映射为前端统一格式
 */
function mapDevice(d) {
  if (!d) return null
  return {
    deviceId: d.dev_id || d.deviceId || '',
    deviceName: d.device_name || d.deviceName || '未命名设备',
    deviceType: d.product_model || d.deviceType || '未知型号',
    onlineStatus: d.status !== undefined ? d.status : (d.onlineStatus !== undefined ? d.onlineStatus : 0),
    statusText: d.status_str || d.statusText || (d.status === 2 ? '在线' : '离线'),
    imei: d.imei || '',
    lastLogin: d.last_login || d.lastLogin || '',
    onlineDuration: d.online_duration || '',
    lesseeName: d.lessee_name || '',
    customerName: d.user_nickname || '',
    firmwareVersion: d.dmc_ver || '',
    cpu: d.cpu || '',
    memoryUsage: d.mem_usage || '',
    signalStrength: d.csq !== undefined ? d.csq : '',
    iccid: d.iccid || '',
    batteryVoltage: d.m4g_vbat || '',
    latitude: d.lat || '',
    longitude: d.lon || ''
  }
}

Page({
  data: {
    deviceId: '',
    device: null,
    loadDone: false,
    currentTime: ''
  },

  onLoad: function (options) {
    this.setData({ deviceId: options.id || '' })
    this.fetchDetail(true)
    // 订阅实时推送（如有 WebSocket）
    if (ws.subscribe) {
      this._wsHandler = (msg) => this.handleWs(msg)
      ws.subscribe(this._wsHandler)
    }
    // 启动实时时间
    this.startTimer()
  },

  onShow: function () {
    if (this.data.deviceId && this.data.device) {
      this.fetchDetail(false)
    }
  },

  onUnload: function () {
    if (this._wsHandler && ws.unsubscribe) {
      ws.unsubscribe(this._wsHandler)
      this._wsHandler = null
    }
    this.clearTimer()
  },

  startTimer: function () {
    var that = this
    this.updateTime()
    this._timer = setInterval(function () {
      that.updateTime()
    }, 1000)
  },

  clearTimer: function () {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  updateTime: function () {
    var now = new Date()
    var pad = function (n) { return n < 10 ? '0' + n : '' + n }
    var t = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())
    this.setData({ currentTime: t })
  },

  // 拉取设备详情（平台接口 /device/info?device_id=xxx）
  fetchDetail: function (loading) {
    var that = this
    api.get('/device/info', { device_id: this.data.deviceId }, { loading: loading !== false })
      .then(function (res) {
        var raw = res.device || res.data || res
        if (!raw || (!raw.dev_id && !raw.deviceId)) {
          that.setData({ device: null, loadDone: true })
          return
        }
        var device = mapDevice(raw)
        that.setData({ device: device, loadDone: true })
      })
      .catch(function () {
        that.setData({ loadDone: true })
      })
  },

  handleWs: function (msg) {
    if (!msg || !msg.data) return
    var data = msg.data
    if (msg.type === 'device_status' && data.deviceId === this.data.deviceId) {
      this.setData({
        'device.onlineStatus': data.onlineStatus !== undefined ? data.onlineStatus : (this.data.device && this.data.device.onlineStatus)
      })
    }
  },

  onShareAppMessage: function () {
    return {
      title: this.data.device ? this.data.device.deviceName + ' - 喷码机设备详情' : '喷码机设备详情',
      path: '/pages/detail/detail?id=' + this.data.deviceId
    }
  },

  goPrint: function () {
    if (!this.data.device) return
    wx.navigateTo({ url: '/pages/print/print?id=' + this.data.deviceId + '&name=' + encodeURIComponent(this.data.device.deviceName || '') })
  },

  goHistory: function () {
    wx.navigateTo({ url: '/pages/history/history?id=' + this.data.deviceId })
  }
})
