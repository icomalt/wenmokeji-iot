const api = require('../../utils/request')
const auth = require('../../utils/auth')
const ws = require('../../utils/websocket')
const config = require('../../utils/config')
const deviceMapper = require('../../utils/deviceMapper')

Page({
  data: {
    username: '',
    deviceStat: { total: 0, online: 0, offline: 0, fault: 0 },
    deviceList: [],
    logoExists: true
  },

  onLoad: function () {
    // 只有配置了 wsUrl 才订阅 WebSocket（公司平台暂无 WebSocket）
    if (config.wsUrl && ws.subscribe) {
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
    // 每次进入页面刷新用户名
    var userInfo = auth.getUserInfo() || {}
    var username = userInfo.name || userInfo.username || '用户'
    this.setData({ username: username })
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
    // 使用较大的 page_size 获取所有设备用于统计（类似Web平台的10000）
    return api.get('/device/list', { page_num: 1, page_size: 10000 }, { loading: false })
      .then(function (res) {
        // 使用统一的解析方法
        var result = deviceMapper.parseDeviceListResponse(res)
        var list = result.list
        var total = result.total
        
        // 计算统计
        var stats = deviceMapper.calculateStats(list)
        
        // 首页只显示前10台设备
        var displayList = list.slice(0, 10)
        that.setData({
          deviceList: displayList,
          deviceStat: { 
            total: total || stats.total, 
            online: stats.online, 
            offline: stats.offline, 
            fault: stats.fault 
          }
        })
      })
      .catch(function (err) {
        console.error('[home] loadDeviceList error:', err)
        that.setData({ 
          deviceList: [], 
          deviceStat: { total: 0, online: 0, offline: 0, fault: 0 } 
        })
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

  // 跳转到设备详情
  goDetail: function (e) {
    var id = e.currentTarget.dataset.id
    if (!id) {
      wx.showToast({ title: '设备ID无效', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
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
