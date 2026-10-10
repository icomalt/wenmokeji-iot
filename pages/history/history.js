/**
 * 喷印记录页 —— 对接公司平台 /api/v1/inkjet_printer/list
 * 记录本身没有公司字段时，通过设备列表按 dev_id 关联用户名称。
 */
const api = require('../../utils/request')
const config = require('../../utils/config')
const deviceMapper = require('../../utils/deviceMapper')

Page({
  data: {
    date: '',
    list: [],
    page: 1,
    pageSize: config.pageSize,
    hasMore: true,
    loading: false
  },

  onLoad: function () {
    this._companyMap = {}
    this.loadCompanyMap().then(() => this.fetchList(true))
  },

  onPullDownRefresh: function () {
    this.loadCompanyMap()
      .catch(function () {})
      .then(() => this.fetchList(true))
      .then(function () { wx.stopPullDownRefresh() })
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.fetchList(false)
    }
  },

  onDateChange: function (e) {
    this.setData({ date: e.detail.value }, () => this.fetchList(true))
  },

  clearDate: function () {
    this.setData({ date: '' }, () => this.fetchList(true))
  },

  onShareAppMessage: function () {
    return {
      title: '喷印记录 - 文墨物联网',
      path: '/pages/history/history'
    }
  },

  loadCompanyMap: function () {
    var that = this
    return api.get('/device/list', {
      page_num: 1,
      page_size: 10000
    }, { loading: false })
      .then(function (res) {
        var result = deviceMapper.parseDeviceListResponse(res)
        var map = {}
        result.list.forEach(function (device) {
          if (device.deviceId) map[String(device.deviceId)] = device.companyName || ''
        })
        that._companyMap = map
      })
      .catch(function (err) {
        console.warn('[history] loadCompanyMap error:', err)
        that._companyMap = that._companyMap || {}
      })
  },

  enrichRows: function (rows) {
    var companyMap = this._companyMap || {}
    return (rows || []).map(function (row) {
      var deviceId = row.dev_id || row.device_id || row.deviceId || ''
      var companyName = row.company_name || row.user_nickname || row.user_name || companyMap[String(deviceId)] || ''
      return Object.assign({}, row, { companyName: companyName })
    })
  },

  fetchList: function (reset) {
    var that = this
    var page = reset ? 1 : this.data.page + 1
    var date = this.data.date ? this.data.date.replace(/-/g, '/') : null
    this.setData({ loading: true })

    return api.post('/inkjet_printer/list', {
      date_range: [date, date],
      page_num: page,
      page_size: this.data.pageSize
    }, { loading: reset })
      .then(function (res) {
        var rows = that.enrichRows(res && res.list ? res.list : [])
        var total = (res && res.total) || 0
        var list = reset ? rows : that.data.list.concat(rows)
        that.setData({
          list: list,
          page: page,
          hasMore: list.length < total,
          loading: false
        })
      })
      .catch(function (err) {
        console.error('[history] fetchList error:', err)
        that.setData({ loading: false })
      })
  }
})