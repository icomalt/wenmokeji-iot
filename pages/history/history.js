/**
 * 历史记录页逻辑
 * 1. 按设备 ID + 日期筛选拉取打印历史
 * 2. 下拉刷新 / 上拉分页
 * 3. 切换日期自动重置第一页
 */
const api = require('../../utils/request')
const config = require('../../utils/config')

Page({
  data: {
    deviceId: '',
    date: '',            // 筛选日期 yyyy-MM-dd
    list: [],
    page: 1,
    pageSize: config.pageSize,
    hasMore: true,
    loading: false
  },

  onLoad: function (options) {
    this.setData({ deviceId: options.id || '' })
    this.fetchList(true)
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.fetchList(true).then(function () {
      wx.stopPullDownRefresh()
    })
  },

  // 上拉加载
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.fetchList(false)
    }
  },

  // 日期变更
  onDateChange: function (e) {
    this.setData({ date: e.detail.value }, () => this.fetchList(true))
  },

  // 清除日期
  clearDate: function () {
    this.setData({ date: '' }, () => this.fetchList(true))
  },

  // 分享给朋友
  onShareAppMessage: function () {
    return {
      title: '喷码打印历史记录 - 物联网云平台',
      path: '/pages/history/history?id=' + this.data.deviceId
    }
  },

  /**
   * 拉取历史记录
   * @param {Boolean} reset 是否重置到第一页
   */
  fetchList: function (reset) {
    const that = this
    const page = reset ? 1 : this.data.page + 1
    this.setData({ loading: true })
    return api.get('/device/print/history', {
      deviceId: this.data.deviceId,
      date: this.data.date,
      page: page,
      pageSize: this.data.pageSize
    }, { loading: reset })
      .then(function (res) {
        const rows = res.list || res.rows || res || []
        const total = res.total || 0
        const list = reset ? rows : that.data.list.concat(rows)
        that.setData({
          list: list,
          page: page,
          hasMore: list.length < total,
          loading: false
        })
      })
      .catch(function () {
        that.setData({ loading: false })
      })
  }
})
