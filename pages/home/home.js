const api = require('../../utils/request')
const auth = require('../../utils/auth')
const ws = require('../../utils/websocket')

/**
 * 将平台设备数据映射为前端统一格式
 * 平台字段：dev_id, device_name, product_model, status, status_str, ...
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
    username: '',
    deviceStat: { total: 0, online: 0, offline: 0 },
    deviceList: [],
    logoExists: true
  },

  onLoad: function () {
    var userInfo = auth.getUserInfo() || {}
    this.setData({ username: userInfo.name || userInfo.username || '用户' })
    // 订阅 WebSocket（如有）
    if (ws.subscribe) {
      this._wsHandler = (msg) => this.handleWsMessage(msg)
      ws.subscribe(this._wsHandler)
    }
  },

  onUnload: function () {
    if (this._wsHandler && ws.unsubscribe) {
      ws.unsubscribe(this._wsHandler)
      this._wsHandler = null
    }
  },

  handleWsMessage: function (msg) {
    if (!msg || !msg.type) return
    if (msg.type === 'device_list_change') {
      this.loadDeviceList()
      return
    }
    if (msg.type === 'device_status' && msg.data) {
      var data = msg.data
      var list = this.data.deviceList.map(function (d) {
        if (d.deviceId === data.deviceId) {
          return Object.assign({}, d, {
            onlineStatus: data.onlineStatus !== undefined ? data.onlineStatus : d.onlineStatus
          })
        }
        return d
      })
      this.setData({ deviceList: list })
    }
  },

  onLogoError: function () {
    this.setData({ logoExists: false })
  },

  onShow: function () {
    this.loadDeviceList()
  },

  onPullDownRefresh: function () {
    var that = this
    this.loadDeviceList().then(function () {
      wx.stopPullDownRefresh()
    })
  },

  // 加载设备列表（从设备列表接口获取，前端计算统计）
  loadDeviceList: function () {
    var that = this
    return api.get('/device/list', { page_num: 1, page_size: 100 }, { loading: false })
      .then(function (res) {
        // 兼容多种返回结构
        var rawList = res.list || res.rows || res.data || res || []
        if (!Array.isArray(rawList)) rawList = []
        // 映射字段
        var list = rawList.map(mapDevice).filter(function (d) { return d !== null })
        // 计算统计
        var online = 0
        var offline = 0
        list.forEach(function (d) {
          if (d.onlineStatus === 2 || d.onlineStatus === 1) online++
          else offline++
        })
        that.setData({
          deviceList: list,
          deviceStat: { total: list.length, online: online, offline: offline }
        })
      })
      .catch(function () {
        that.setData({ deviceList: [], deviceStat: { total: 0, online: 0, offline: 0 } })
      })
  },

  // 验证管理员密码（调用后端 /auth/verify-admin 接口鉴权，避免前端硬编码密码）
  verifyPassword: function (callback) {
    wx.showModal({
      title: '密码验证',
      editable: true,
      placeholderText: '请输入管理员密码',
      success: function (res) {
        if (!res.confirm) {
          callback && callback(false)
          return
        }
        var password = (res.content || '').trim()
        if (!password) {
          wx.showToast({ title: '密码不能为空', icon: 'none' })
          callback && callback(false)
          return
        }
        // 调用后端接口验证管理员密码，密码不在前端保存
        api.post('/auth/verify-admin', { password: password }, { loading: false })
          .then(function () {
            callback && callback(true)
          })
          .catch(function () {
            wx.showToast({ title: '密码错误', icon: 'none' })
            callback && callback(false)
          })
      }
    })
  },

  onAddDevice: function () {
    var that = this
    this.verifyPassword(function (passed) {
      if (!passed) return
      wx.showModal({
        title: '添加设备',
        editable: true,
        placeholderText: '请输入设备ID',
        success: function (res) {
          if (!res.confirm) return
          var deviceId = (res.content || '').trim()
          if (!deviceId) {
            wx.showToast({ title: '设备ID不能为空', icon: 'none' })
            return
          }
          that.doAddDevice(deviceId)
        }
      })
    })
  },

  doAddDevice: function (deviceId) {
    var that = this
    wx.showLoading({ title: '添加中...' })
    api.post('/device/add', { device_id: deviceId }, { loading: false })
      .then(function () {
        wx.hideLoading()
        wx.showToast({ title: '添加成功', icon: 'success' })
        that.loadDeviceList()
      })
      .catch(function () {
        wx.hideLoading()
      })
  },

  onDeleteDevice: function () {
    var that = this
    if (this.data.deviceList.length === 0) {
      wx.showToast({ title: '暂无设备可删除', icon: 'none' })
      return
    }
    this.verifyPassword(function (passed) {
      if (!passed) return
      var items = that.data.deviceList.map(function (d) { return d.deviceName + ' (' + d.deviceId + ')' })
      wx.showActionSheet({
        itemList: items,
        success: function (res) {
          var device = that.data.deviceList[res.tapIndex]
          wx.showModal({
            title: '确认删除',
            content: '确定删除设备「' + device.deviceName + '」吗？',
            success: function (r) {
              if (r.confirm) {
                that.doDeleteDevice(device.deviceId)
              }
            }
          })
        }
      })
    })
  },

  doDeleteDevice: function (deviceId) {
    var that = this
    wx.showLoading({ title: '删除中...' })
    api.post('/device/delete', { device_id: deviceId }, { loading: false })
      .then(function () {
        wx.hideLoading()
        wx.showToast({ title: '删除成功', icon: 'success' })
        that.loadDeviceList()
      })
      .catch(function () {
        wx.hideLoading()
      })
  },

  goDevice: function () {
    wx.switchTab({ url: '/pages/device/device' })
  },

  onShareAppMessage: function () {
    return {
      title: '喷码机物联网云平台',
      path: '/pages/home/home',
      imageUrl: '/images/logo.png'
    }
  },

  onShareTimeline: function () {
    return {
      title: '喷码机物联网云平台',
      imageUrl: '/images/logo.png'
    }
  },

  // 退出登录：先关闭 WebSocket，再调用后端 /auth/logout 使 token 失效，最后清理本地状态
  logout: function () {
    var that = this
    wx.showModal({
      title: '提示',
      content: '确定退出登录？',
      success: function (res) {
        if (res.confirm) {
          // 先关闭 WebSocket 连接
          if (ws.closeAll) ws.closeAll()
          // 调用后端登出接口，使 token 在服务端失效
          api.post('/auth/logout', {}, { loading: false })
            .catch(function () {
              // 登出接口失败不阻塞，仍然清理本地登录态
            })
            .then(function () {
              auth.clearAuth()
              wx.reLaunch({ url: '/pages/login/login' })
            })
        }
      }
    })
  }
})
