/**
 * 设备详情页逻辑
 * 1. 进入拉取设备详情（含 deviceParams）
 * 2. 订阅 WebSocket，实时更新该设备的参数 / 状态
 * 3. 页面销毁时取消订阅（无订阅者自动关闭连接）
 */
const api = require('../../utils/request')
const ws = require('../../utils/websocket')

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
    // 订阅实时推送
    this._wsHandler = (msg) => this.handleWs(msg)
    ws.subscribe(this._wsHandler)
    // 启动实时时间
    this.startTimer()
  },

  // 页面再次显示（从打印页返回时）：静默刷新详情，同步最新打印内容
  onShow: function () {
    if (this.data.deviceId && this.data.device) {
      this.fetchDetail(false)
    }
  },

  // 页面销毁：取消订阅，无订阅者时自动关闭 WS
  onUnload: function () {
    if (this._wsHandler) {
      ws.unsubscribe(this._wsHandler)
      this._wsHandler = null
    }
    // 清除定时器
    this.clearTimer()
  },

  // 启动实时时间定时器
  startTimer: function () {
    const that = this
    this.updateTime()
    this._timer = setInterval(function () {
      that.updateTime()
    }, 1000)
  },

  // 清除定时器
  clearTimer: function () {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  },

  // 更新当前时间
  updateTime: function () {
    const now = new Date()
    const pad = function (n) { return n < 10 ? '0' + n : '' + n }
    const t = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())
    this.setData({ currentTime: t })
  },

  // 拉取设备详情
  // 后端会校验 deviceId 是否属于当前客户，无权限时返回 device: null
  fetchDetail: function (loading) {
    const that = this
    api.get('/device/detail', { deviceId: this.data.deviceId }, { loading: loading !== false })
      .then(function (res) {
        const device = res.device || res
        if (!device || (device && !device.deviceId)) {
          // 设备不存在或不属于当前客户
          that.setData({ device: null, loadDone: true })
          return
        }
        that.setData({
          device: device,
          loadDone: true
        })
      })
      .catch(function () {
        that.setData({ loadDone: true })
      })
  },

  // 处理 WS 推送
  handleWs: function (msg) {
    if (!msg || !msg.data) return
    const data = msg.data
    // 状态变更
    if (msg.type === 'device_status' && data.deviceId === this.data.deviceId) {
      this.setData({
        'device.onlineStatus': data.onlineStatus !== undefined ? data.onlineStatus : (this.data.device && this.data.device.onlineStatus)
      })
    }
  },

  // 分享给朋友
  onShareAppMessage: function () {
    return {
      title: this.data.device ? this.data.device.deviceName + ' - 喷码机设备详情' : '喷码机设备详情',
      path: '/pages/detail/detail?id=' + this.data.deviceId
    }
  },

  // 跳转打印下发
  goPrint: function () {
    wx.navigateTo({ url: '/pages/print/print?id=' + this.data.deviceId + '&name=' + encodeURIComponent(this.data.device.deviceName || '') })
  },

  // 跳转历史记录
  goHistory: function () {
    wx.navigateTo({ url: '/pages/history/history?id=' + this.data.deviceId })
  }
})
