/**
 * 首页：设备统计 + 只读功能入口
 * 数据来自公司平台 /device/list，不执行添加、删除或设备下发。
 */
const api = require('../../utils/request')
const auth = require('../../utils/auth')
const ws = require('../../utils/websocket')
const config = require('../../utils/config')
const deviceMapper = require('../../utils/deviceMapper')

Page({
  data: {
    username: '',
    isAdmin: false,
    deviceStat: { total: 0, online: 0, inactive: 0, offline: 0 },
    logoExists: true,
    loading: true
  },

  onLoad: function () {
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
    if (msg && msg.type === 'device_list_change') {
      this.loadDeviceStats()
    }
  },

  onLogoError: function () {
    this.setData({ logoExists: false })
  },

  onShow: function () {
    var userInfo = auth.getUserInfo() || {}
    this.setData({
      username: userInfo.name || userInfo.username || '用户',
      isAdmin: auth.isAdmin()
    })
    this.loadDeviceStats()
  },

  onPullDownRefresh: function () {
    this.loadDeviceStats().then(function () {
      wx.stopPullDownRefresh()
    })
  },

  loadDeviceStats: function () {
    var that = this
    that.setData({ loading: true })

    return api.get('/device/list', {
      page_num: 1,
      page_size: 10000
    }, { loading: false })
      .then(function (listRes) {
        var result = deviceMapper.parseDeviceListResponse(listRes)
        var stats = deviceMapper.calculateStats(result.list)
        stats.total = result.total || stats.total
        that.setData({ deviceStat: stats, loading: false })
      })
      .catch(function (err) {
        console.error('[home] loadDeviceStats error:', err)
        that.setData({
          deviceStat: { total: 0, online: 0, inactive: 0, offline: 0 },
          loading: false
        })
      })
  },

  goDevice: function () {
    wx.switchTab({ url: '/pages/device/device' })
  },

  goHistory: function () {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  goPrint: function () {
    wx.navigateTo({ url: '/pages/print/print' })
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

  logout: function () {
    var that = this
    wx.showModal({
      title: '提示',
      content: '确定退出登录？',
      success: function (res) {
        if (!res.confirm) return
        if (ws.closeAll) ws.closeAll()
        that._wsHandler = null
        auth.clearAuth()
        wx.reLaunch({ url: '/pages/login/login' })
      }
    })
  }
})