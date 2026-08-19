/**
 * 设备列表页逻辑
 * 1. 进入即拉取设备列表（首页加载）
 * 2. 下拉刷新（重置第一页）/ 上拉分页加载
 * 3. 关键字搜索（带防抖）
 * 4. 订阅 WebSocket，实时更新列表中设备的 在线状态/故障状态/打印时间
 * 5. 空数据判断 + loading + 断网提示（request 已统一处理）
 */
const api = require('../../utils/request')
const ws = require('../../utils/websocket')
const config = require('../../utils/config')

Page({
  data: {
    list: [],              // 设备列表
    keyword: '',           // 搜索关键字
    page: 1,               // 当前页码
    pageSize: config.pageSize,
    hasMore: true,         // 是否还有更多
    loading: false,        // 是否正在加载
    wsConnected: false     // WS 是否已收到推送（用于状态条）
  },

  onLoad: function () {
    this.fetchList(true)
    // 订阅实时设备状态推送
    this._wsHandler = (msg) => this.handleWsMessage(msg)
    ws.subscribe(this._wsHandler)
  },

  onShow: function () {
    // 从详情页/打印页返回时刷新列表，保证数据同步（打印内容/时间已更新）
    if (this.data.list.length > 0) {
      this.fetchList(true)
    }
  },

  onHide: function () {
    // Tab 页不会 onUnload，保留订阅以便后台也能更新
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.fetchList(true).then(function () {
      wx.stopPullDownRefresh()
    })
  },

  // 上拉加载更多
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.fetchList(false)
    }
  },

  // 搜索输入（防抖 400ms）
  onSearchInput: function (e) {
    const that = this
    this.setData({ keyword: e.detail.value })
    clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(function () {
      that.fetchList(true)
    }, 400)
  },

  /**
   * 拉取设备列表
   * @param {Boolean} reset 是否重置到第一页
   */
  fetchList: function (reset) {
    const that = this
    const page = reset ? 1 : this.data.page + 1
    this.setData({ loading: true })
    return api.get('/device/list', {
      page: page,
      pageSize: this.data.pageSize,
      keyword: this.data.keyword
    }, { loading: reset })
      .then(function (res) {
        // 兼容多种返回结构：{ list, total } / { rows, total } / [ ... ]
        const rows = res.list || res.rows || res || []
        const total = res.total || 0
        const list = reset ? rows : that.data.list.concat(rows)
        const hasMore = list.length < total
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

  // 处理 WebSocket 推送，实时更新列表
  handleWsMessage: function (msg) {
    if (!msg) return
    // 收到任意消息都标记连接正常
    this.setData({ wsConnected: true })

    // 设备状态变更
    if (msg.type !== 'device_status') return
    const item = msg.data || {}
    const id = item.deviceId
    if (!id) return
    const list = this.data.list.map(function (d) {
      if (d.deviceId === id) {
        return Object.assign({}, d, {
          onlineStatus: item.onlineStatus !== undefined ? item.onlineStatus : d.onlineStatus,
          faultStatus: item.faultStatus !== undefined ? item.faultStatus : d.faultStatus,
          printTime: item.printTime || d.printTime
        })
      }
      return d
    })
    this.setData({ list: list })
  },

  // 分享给朋友
  onShareAppMessage: function () {
    return {
      title: '喷码机设备列表 - 物联网云平台',
      path: '/pages/device/device'
    }
  },

  // 跳转设备详情
  goDetail: function (e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  }
})
