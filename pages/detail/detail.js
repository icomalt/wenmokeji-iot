/**
 * 设备详情页逻辑 —— 对接公司物联网平台
 * 1. 进入拉取设备详情 /device/info?device_id=xxx
 * 2. 使用统一的 deviceMapper 映射平台字段到前端统一格式
 * 3. 页面销毁时清理
 */
const api = require('../../utils/request')
const ws = require('../../utils/websocket')
const config = require('../../utils/config')
const deviceMapper = require('../../utils/deviceMapper')
const auth = require('../../utils/auth')

Page({
  data: {
    deviceId: '',
    device: null,
    loadDone: false,
    currentTime: '',
    username: '',
    isAdmin: false,
    params: [],
    paramsLoading: false
  },

  onLoad: function (options) {
    // 加载用户名
    var userInfo = auth.getUserInfo() || {}
    var username = userInfo.name || userInfo.username || '用户'
    this.setData({ 
      deviceId: options.id ? decodeURIComponent(options.id) : '',
      username: username,
      isAdmin: auth.isAdmin()
    })
    this._routeStatus = Number(options.status) || 0
    this._routeCompanyName = options.company ? decodeURIComponent(options.company) : ''
    this.fetchDetail(true)
    // 只有配置了 wsUrl 才订阅 WebSocket（公司平台暂无 WebSocket）
    if (config.wsUrl && ws.subscribe) {
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
    // 回前台时恢复时钟
    this.startTimer()
  },

  onHide: function () {
    // 切后台时暂停时钟，省性能
    this.clearTimer()
  },

  onUnload: function () {
    if (this._wsHandler && ws.unsubscribe) {
      ws.unsubscribe(this._wsHandler)
      this._wsHandler = null
    }
    this.clearTimer()
  },

  startTimer: function () {
    this.clearTimer()
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
    var deviceId = this.data.deviceId
    if (!deviceId) {
      that.setData({ device: null, loadDone: true })
      return
    }
    api.get('/device/info', { device_id: deviceId }, { loading: loading !== false })
      .then(function (res) {
        // 使用统一的 deviceMapper 解析响应
        var device = deviceMapper.parseDeviceDetailResponse(res)
        var rawInfo = res && res.info ? res.info : (res && res.data && res.data.info ? res.data.info : null)
        if (device && that._routeStatus && (!rawInfo || rawInfo.status === undefined || rawInfo.status === null)) {
          device.onlineStatus = that._routeStatus
          device.statusText = deviceMapper.getStatusText(that._routeStatus)
        }
        if (device && !device.companyName && that._routeCompanyName) {
          device.companyName = that._routeCompanyName
        }
        
        if (!device) {
          that.setData({ device: null, loadDone: true })
          return
        }
        
        that.setData({ device: device, loadDone: true })
      })
      .catch(function (err) {
        console.error('[detail] fetchDetail error:', err)
        that.setData({ device: null, loadDone: true })
      })
  },

  handleWs: function (msg) {
    if (!msg || !msg.data) return
    var data = msg.data
    if (msg.type === 'device_status' && data.deviceId === this.data.deviceId) {
      var status = data.onlineStatus !== undefined ? data.onlineStatus : (this.data.device && this.data.device.onlineStatus)
      this.setData({
        'device.onlineStatus': status,
        'device.statusText': deviceMapper.getStatusText(status)
      })
    }
  },

  onShareAppMessage: function () {
    return {
      title: this.data.device ? this.data.device.deviceName + ' - 喷码机设备详情' : '喷码机设备详情',
      path: '/pages/detail/detail?id=' + encodeURIComponent(this.data.deviceId)
    }
  },

  goPrint: function () {
    if (!this.data.device) {
      wx.showToast({ title: '设备信息未加载', icon: 'none' })
      return
    }
    var url = '/pages/print/print?id=' + encodeURIComponent(this.data.deviceId) + '&name=' + encodeURIComponent(this.data.device.deviceName || '')
    wx.navigateTo({ url: url })
  },

  /**
   * 读取设备参数 —— POST /device/param/read
   */
  fetchParams: function () {
    var that = this
    if (!this.data.deviceId) return
    this.setData({ paramsLoading: true })
    api.post('/device/param/read', {
      dev_id: this.data.deviceId,
      param_keys: []
    }, { loading: false })
      .then(function (res) {
        var params = (res && res.params) || []
        that.setData({ params: params, paramsLoading: false })
      })
      .catch(function (err) {
        console.error('[detail] fetchParams error:', err)
        that.setData({ paramsLoading: false })
        wx.showToast({ title: '参数读取失败', icon: 'none' })
      })
  },

  /**
   * 设备重启 —— POST /device/reboot（仅 admin）
   */
  rebootDevice: function () {
    var that = this
    if (!this.data.isAdmin) {
      wx.showToast({ title: '无操作权限', icon: 'none' })
      return
    }
    if (this.data.device && this.data.device.onlineStatus !== 2) {
      wx.showToast({ title: '设备离线，无法重启', icon: 'none' })
      return
    }
    wx.showModal({
      title: '高危操作',
      content: '确定要重启设备 ' + this.data.deviceId + ' 吗？重启期间设备将短暂离线。',
      confirmText: '确认重启',
      confirmColor: '#EF4444',
      success: function (res) {
        if (!res.confirm) return
        api.post('/device/reboot', {
          dev_id: that.data.deviceId
        }, { loading: true })
          .then(function () {
            wx.showToast({ title: '重启指令已下发', icon: 'success' })
          })
          .catch(function (err) {
            console.error('[detail] reboot error:', err)
          })
      }
    })
  }
})
