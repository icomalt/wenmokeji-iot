/**
 * 告警列表页 —— 对接 GET /alarm/list
 * 1. 按级别/状态筛选
 * 2. 下拉刷新 / 上拉分页
 * 3. 点击跳告警详情
 */
const api = require('../../utils/request')
const config = require('../../utils/config')

// 告警级别映射
var LEVEL_MAP = {
  1: { text: '提示', color: '#3B82F6' },
  2: { text: '警告', color: '#F59E0B' },
  3: { text: '严重', color: '#EF4444' }
}

// 告警类型映射（接口文档 4.3 节）
var TYPE_MAP = {
  ink_empty: '墨水耗尽',
  ink_low: '墨水不足',
  offline: '设备离线',
  online: '设备上线',
  high_temperature: '温度过高',
  low_temperature: '温度过低',
  nozzle_block: '喷头堵塞',
  power_failure: '断电',
  print_error: '喷印故障',
  firmware_update_success: '固件升级成功',
  firmware_update_failed: '固件升级失败',
  sensor_abnormal: '传感器异常'
}

// 处理状态映射
var STATUS_MAP = {
  0: { text: '未处理', color: '#EF4444' },
  1: { text: '已处理', color: '#10B981' },
  2: { text: '已忽略', color: '#94A3B8' }
}

Page({
  data: {
    list: [],
    page: 1,
    pageSize: config.pageSize,
    hasMore: true,
    loading: false,
    loadError: false,
    // 筛选
    levelFilter: 0,       // 0=全部 1=提示 2=警告 3=严重
    statusFilter: 0,      // 0=全部 1=未处理 2=已处理 3=已忽略
    levelOptions: ['全部', '提示', '警告', '严重'],
    statusOptions: ['全部', '未处理', '已处理', '已忽略']
  },

  onLoad: function () {
    this.fetchList(true)
  },

  onShow: function () {
    // 从详情页返回时刷新
    if (this.data.list.length > 0) {
      this.fetchList(true)
    }
  },

  onPullDownRefresh: function () {
    this.fetchList(true).then(function () { wx.stopPullDownRefresh() })
  },

  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.fetchList(false)
    }
  },

  onLevelChange: function (e) {
    this.setData({ levelFilter: Number(e.detail.value) })
    this.fetchList(true)
  },

  onStatusChange: function (e) {
    this.setData({ statusFilter: Number(e.detail.value) })
    this.fetchList(true)
  },

  onRetry: function () {
    this.fetchList(true)
  },

  /**
   * 拉取告警列表
   * @param {Boolean} reset 是否重置到第一页
   */
  fetchList: function (reset) {
    var that = this
    var page = reset ? 1 : this.data.page + 1
    this.setData({ loading: true, loadError: false })

    var params = {
      page_num: page,
      page_size: this.data.pageSize
    }
    if (this.data.levelFilter > 0) {
      params.level = this.data.levelFilter
    }
    if (this.data.statusFilter > 0) {
      params.status = this.data.statusFilter - 1  // 筛选1=未处理对应接口status=0
    }

    return api.get('/alarm/list', params, { loading: reset })
      .then(function (res) {
        var rawList = (res && res.list) || []
        var total = (res && res.total) || 0
        var rows = rawList.map(function (item) {
          var level = Number(item.level) || 1
          var status = Number(item.status) || 0
          return {
            id: item.id,
            dev_id: item.dev_id || '',
            alarm_type: item.alarm_type || '',
            alarm_type_text: TYPE_MAP[item.alarm_type] || item.alarm_type || '未知告警',
            level: level,
            level_text: (LEVEL_MAP[level] || LEVEL_MAP[1]).text,
            level_color: (LEVEL_MAP[level] || LEVEL_MAP[1]).color,
            status: status,
            status_text: (STATUS_MAP[status] || STATUS_MAP[0]).text,
            status_color: (STATUS_MAP[status] || STATUS_MAP[0]).color,
            message: item.message || item.content || '',
            created_at: item.created_at || item.alarm_time || '',
            handled_at: item.handled_at || ''
          }
        })
        var list = reset ? rows : that.data.list.concat(rows)
        that.setData({
          list: list,
          page: page,
          hasMore: list.length < total,
          loading: false
        })
      })
      .catch(function (err) {
        console.error('[alarm] fetchList error:', err)
        that.setData({ loading: false, loadError: reset })
      })
  },

  goDetail: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/alarm-detail/alarm-detail?id=' + id })
  }
})
