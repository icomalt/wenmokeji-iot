/**
 * 设备列表页逻辑 —— 对接公司物联网平台
 * 1. 进入即拉取设备列表
 * 2. 下拉刷新（重置第一页）/ 上拉分页加载
 * 3. 关键字搜索（带防抖）
 * 4. 字段映射：平台 dev_id/device_name/product_model/status → 前端统一格式
 * 5. 空数据判断 + loading + 断网提示
 */
const api = require('../../utils/request')
const ws = require('../../utils/websocket')
const config = require('../../utils/config')

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
    list: [],
    keyword: '',
    page: 1,
    pageSize: config.pageSize,
    hasMore: true,
    loading: false,
    wsConnected: false
  },

  onLoad: function () {
    this.fetchList(true)
    if (ws.subscribe) {
      this._wsHandler = (msg) => this.handleWsMessage(msg)
      ws.subscribe(this._wsHandler)
    }
  },

  onShow: function () {
    if (this.data.list.length > 0) {
      this.fetchList(true)
    }
  },

  onPullDownRefresh: function () {
    var that = this
    this.fetchList(true).then(function () {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.fetchList(false)
    }
  },

  onSearchInput: function (e) {
    var that = this
    this.setData({ keyword: e.detail.value })
    clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(function () {
      that.fetchList(true)
    }, 400)
  },

  /**
   * 拉取设备列表（平台参数 page_num/page_size）
   * @param {Boolean} reset 是否重置到第一页
   */
  fetchList: function (reset) {
    var that = this
    var page = reset ? 1 : this.data.page + 1
    this.setData({ loading: true })
    // 平台使用 page_num/page_size 参数
    var params = {
      page_num: page,
      page_size: this.data.pageSize
    }
    if (this.data.keyword) {
      params.device_name = this.data.keyword
    }
    return api.get('/device/list', params, { loading: reset })
      .then(function (res) {
        var rawList = res.list || res.rows || res.data || res || []
        if (!Array.isArray(rawList)) rawList = []
        // 映射字段
        var rows = rawList.map(mapDevice).filter(function (d) { return d !== null })
        var total = res.total || res.total_count || rows.length
        var list = reset ? rows : that.data.list.concat(rows)
        var hasMore = list.length < total
        that.setData({
          list: list,
          page: page,
          hasMore: hasMore,
          loading: false
        })
      })
      .catch(function () {
        that.setData({ loading: false })
      })
  },

  handleWsMessage: function (msg) {
    if (!msg) return
    this.setData({ wsConnected: true })
    if (msg.type !== 'device_status') return
    var item = msg.data || {}
    var id = item.deviceId
    if (!id) return
    var list = this.data.list.map(function (d) {
      if (d.deviceId === id) {
        return Object.assign({}, d, {
          onlineStatus: item.onlineStatus !== undefined ? item.onlineStatus : d.onlineStatus
        })
      }
      return d
    })
    this.setData({ list: list })
  },

  onShareAppMessage: function () {
    return {
      title: '喷码机设备列表 - 物联网云平台',
      path: '/pages/device/device'
    }
  },

  goDetail: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  }
})
