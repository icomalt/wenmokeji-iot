/**
 * 告警详情页 —— 对接 /alarm/detail 和 /alarm/handle
 * 1. 展示告警完整信息
 * 2. 未处理告警可标记已处理或忽略
 */
const api = require('../../utils/request')

var LEVEL_MAP = {
  1: { text: '提示', color: '#3B82F6' },
  2: { text: '警告', color: '#F59E0B' },
  3: { text: '严重', color: '#EF4444' }
}
var TYPE_MAP = {
  ink_empty: '墨水耗尽', ink_low: '墨水不足', offline: '设备离线',
  online: '设备上线', high_temperature: '温度过高', low_temperature: '温度过低',
  nozzle_block: '喷头堵塞', power_failure: '断电', print_error: '喷印故障',
  firmware_update_success: '固件升级成功', firmware_update_failed: '固件升级失败',
  sensor_abnormal: '传感器异常'
}
var STATUS_MAP = {
  0: { text: '未处理', color: '#EF4444' },
  1: { text: '已处理', color: '#10B981' },
  2: { text: '已忽略', color: '#94A3B8' }
}

Page({
  data: {
    id: '',
    detail: null,
    loading: true,
    loadError: false,
    showHandleModal: false,
    handleAction: '',   // resolve / ignore
    handleRemark: '',
    submitting: false
  },

  onLoad: function (options) {
    this.setData({ id: options.id || '' })
    this.fetchDetail()
  },

  onRetry: function () {
    this.fetchDetail()
  },

  fetchDetail: function () {
    var that = this
    this.setData({ loading: true, loadError: false })
    api.get('/alarm/detail', { id: this.data.id }, { loading: true })
      .then(function (res) {
        var item = res || {}
        var level = Number(item.level) || 1
        var status = Number(item.status) || 0
        that.setData({
          detail: {
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
            handled_at: item.handled_at || '',
            handled_by: item.handled_by || '',
            remark: item.remark || '',
            raw_data: item.raw_data || null
          },
          loading: false
        })
      })
      .catch(function (err) {
        console.error('[alarm-detail] fetch error:', err)
        that.setData({ loading: false, loadError: true })
      })
  },

  openHandleModal: function (e) {
    var action = e.currentTarget.dataset.action
    this.setData({
      showHandleModal: true,
      handleAction: action,
      handleRemark: ''
    })
  },

  closeHandleModal: function () {
    this.setData({ showHandleModal: false })
  },

  onRemarkInput: function (e) {
    this.setData({ handleRemark: e.detail.value })
  },

  confirmHandle: function () {
    var that = this
    if (this.data.submitting) return
    this.setData({ submitting: true })

    api.post('/alarm/handle', {
      id: this.data.id,
      action: this.data.handleAction,
      remark: this.data.handleRemark
    }, { loading: true })
      .then(function () {
        wx.showToast({ title: '操作成功', icon: 'success' })
        that.setData({ showHandleModal: false })
        that.fetchDetail()
      })
      .catch(function (err) {
        console.error('[alarm-detail] handle error:', err)
      })
      .then(function () {
        that.setData({ submitting: false })
      })
  }
})
