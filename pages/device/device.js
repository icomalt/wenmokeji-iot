/**
 * 设备列表页逻辑 —— 对接公司物联网平台
 * 1. 进入即拉取设备列表
 * 2. 下拉刷新（重置第一页）/ 上拉分页加载
 * 3. 关键字搜索（带防抖）
 * 4. 使用统一的 deviceMapper 进行字段映射
 * 5. 空数据判断 + loading + 断网提示
 */
const api = require('../../utils/request')
const ws = require('../../utils/websocket')
const config = require('../../utils/config')
const deviceMapper = require('../../utils/deviceMapper')

Page({
  data: {
    list: [],
    keyword: '',
    page: 1,
    pageSize: config.pageSize,
    hasMore: true,
    loading: false,
    wsConnected: false,
    wsEnabled: !!config.wsUrl  // 公司平台暂无 WebSocket，根据配置决定是否显示连接状态
  },

  onLoad: function () {
    // 只有配置了 wsUrl 才订阅 WebSocket（公司平台暂无 WebSocket）
    if (config.wsUrl && ws.subscribe) {
      this._wsHandler = (msg) => this.handleWsMessage(msg)
      ws.subscribe(this._wsHandler)
    }
  },

  onShow: function () {
    // 统一在 onShow 中加载设备列表，确保每次进入页面都刷新数据
    this.fetchList(true)
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
        // 使用统一的解析方法
        var result = deviceMapper.parseDeviceListResponse(res)
        var rows = result.list
        var total = result.total
        
        var list = reset ? rows : that.data.list.concat(rows)
        var hasMore = list.length < total
        
        that.setData({
          list: list,
          page: page,
          hasMore: hasMore,
          loading: false
        })
      })
      .catch(function (err) {
        console.error('[device] fetchList error:', err)
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
