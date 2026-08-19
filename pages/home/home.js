const api = require('../../utils/request')
const auth = require('../../utils/auth')
const ws = require('../../utils/websocket')

Page({
  data: {
    username: '',
    deviceStat: {},
    deviceList: [],
    logoExists: true
  },

  onLoad: function () {
    const userInfo = auth.getUserInfo() || {}
    this.setData({ username: userInfo.name || userInfo.username || '用户' })
    // 订阅 WebSocket，实时同步设备列表变更
    this._wsHandler = (msg) => this.handleWsMessage(msg)
    ws.subscribe(this._wsHandler)
  },

  // 页面销毁：取消订阅
  onUnload: function () {
    if (this._wsHandler) {
      ws.unsubscribe(this._wsHandler)
      this._wsHandler = null
    }
  },

  // 处理 WebSocket 推送：设备列表变更时实时刷新
  handleWsMessage: function (msg) {
    if (!msg || !msg.type) return
    // 设备列表变更（添加/删除设备后端推送）
    if (msg.type === 'device_list_change') {
      this.loadDeviceList()
      this.fetchStat()
      return
    }
    // 单设备状态变更，更新列表中对应设备
    if (msg.type === 'device_status' && msg.data && msg.data.deviceId) {
      const data = msg.data
      const list = this.data.deviceList.map(function (d) {
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
    this.fetchStat()
    this.loadDeviceList()
  },

  onPullDownRefresh: function () {
    const that = this
    Promise.all([this.fetchStat(), this.loadDeviceList()])
      .then(function () { wx.stopPullDownRefresh() })
  },

  fetchStat: function () {
    const that = this
    return api.get('/device/statistic', {}, { loading: false })
      .then(function (res) {
        that.setData({ deviceStat: res || {} })
      })
      .catch(function () {})
  },

  // 加载设备列表
  loadDeviceList: function () {
    const that = this
    return api.get('/device/list', {}, { loading: false })
      .then(function (res) {
        const list = res.list || res.rows || res || []
        that.setData({ deviceList: Array.isArray(list) ? list : [] })
      })
      .catch(function () {
        that.setData({ deviceList: [] })
      })
  },

  // 验证管理员密码（后端鉴权）
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
        const password = res.content || ''
        // 调用后端接口验证密码
        api.post('/auth/verify-admin', { password: password }, { loading: true })
          .then(function () {
            callback && callback(true)
          })
          .catch(function () {
            callback && callback(false)
          })
      }
    })
  },

  // 添加设备
  onAddDevice: function () {
    const that = this
    this.verifyPassword(function (passed) {
      if (!passed) return
      wx.showModal({
        title: '添加设备',
        editable: true,
        placeholderText: '请输入设备ID',
        success: function (res) {
          if (!res.confirm) return
          const deviceId = (res.content || '').trim()
          if (!deviceId) {
            wx.showToast({ title: '设备ID不能为空', icon: 'none' })
            return
          }
          that.doAddDevice(deviceId)
        }
      })
    })
  },

  // 执行添加设备
  doAddDevice: function (deviceId) {
    const that = this
    wx.showLoading({ title: '添加中...' })
    api.post('/device/add', { deviceId: deviceId }, { loading: false })
      .then(function () {
        wx.hideLoading()
        wx.showToast({ title: '添加成功', icon: 'success' })
        // 通过 WebSocket 通知物联网平台：新设备已绑定
        ws.send({ type: 'device_bind', data: { deviceId: deviceId, action: 'add' } })
        // 本地立即刷新列表
        that.loadDeviceList()
        that.fetchStat()
      })
      .catch(function () {
        wx.hideLoading()
      })
  },

  // 删除设备
  onDeleteDevice: function () {
    const that = this
    if (this.data.deviceList.length === 0) {
      wx.showToast({ title: '暂无设备可删除', icon: 'none' })
      return
    }
    this.verifyPassword(function (passed) {
      if (!passed) return
      const items = that.data.deviceList.map(function (d) { return d.deviceName + ' (' + d.deviceId + ')' })
      wx.showActionSheet({
        itemList: items,
        success: function (res) {
          const device = that.data.deviceList[res.tapIndex]
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

  // 执行删除设备
  doDeleteDevice: function (deviceId) {
    const that = this
    wx.showLoading({ title: '删除中...' })
    api.post('/device/delete', { deviceId: deviceId }, { loading: false })
      .then(function () {
        wx.hideLoading()
        wx.showToast({ title: '删除成功', icon: 'success' })
        // 通过 WebSocket 通知物联网平台：设备已解绑
        ws.send({ type: 'device_bind', data: { deviceId: deviceId, action: 'remove' } })
        // 本地立即刷新列表
        that.loadDeviceList()
        that.fetchStat()
      })
      .catch(function () {
        wx.hideLoading()
      })
  },

  goDevice: function () {
    wx.switchTab({ url: '/pages/device/device' })
  },

  // 分享给朋友
  onShareAppMessage: function () {
    return {
      title: '喷码机物联网云平台',
      path: '/pages/home/home',
      imageUrl: '/images/logo.png'
    }
  },

  // 分享到朋友圈
  onShareTimeline: function () {
    return {
      title: '喷码机物联网云平台',
      imageUrl: '/images/logo.png'
    }
  },

  logout: function () {
    const that = this
    wx.showModal({
      title: '提示',
      content: '确定退出登录？',
      success: function (res) {
        if (res.confirm) {
          // 调用后端登出接口，使 token 失效
          api.post('/auth/logout', {}, { loading: false }).catch(function () {})
          // 关闭 WebSocket 连接
          ws.closeAll()
          // 清除登录态
          auth.clearAuth()
          wx.reLaunch({ url: '/pages/login/login' })
        }
      }
    })
  },
})
