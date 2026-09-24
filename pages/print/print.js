/**
 * 打印下发页逻辑
 * 1. 接收 deviceId / deviceName 参数
 * 2. 表单校验 → 调用 /device/print/dispatch → 成功后返回
 * 3. 提交期间禁用按钮，防止重复下发
 * 4. 插入时间：自由配置年/月/日/时/分/秒格式与连接符，确认后直接插入内容框
 */
const api = require('../../utils/request')
const deviceMapper = require('../../utils/deviceMapper')

Page({
  data: {
    deviceId: '',
    deviceName: '',
    content: '',
    fontSize: 16,
    count: 1,
    immediate: true,
    submitting: false,

    // ===== 时间格式配置弹窗 =====
    showTimeModal: false,
    yearOptions: ['空', '2位(26)', '4位(2026)'],
    partOptions: ['空', '1位(8)', '2位(08)'],
    yearIdx: 1,
    monthIdx: 2,
    dayIdx: 0,
    hourIdx: 0,
    minuteIdx: 0,
    secondIdx: 0,
    dateSeparator: '-',
    timeSeparator: ':',
    timePreview: ''
  },

  onLoad: function (options) {
    this.setData({
      deviceId: options.id || '',
      deviceName: options.name ? decodeURIComponent(options.name) : ''
    })
    if (options.id && !options.name) {
      var that = this
      api.get('/device/info', { device_id: options.id }, { loading: false })
        .then(function (res) {
          var device = deviceMapper.parseDeviceDetailResponse(res)
          if (device) {
            that.setData({ deviceName: device.deviceName || '' })
          }
        })
        .catch(function (err) {
          console.warn('[print] fetch device info error:', err)
        })
    }
  },

  // 文本/数字输入
  onInput: function (e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value })
  },
  // 滑块
  onSlider: function (e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value })
  },
  // 开关
  onSwitch: function (e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value })
  },

  // ========== 时间格式弹窗 ==========
  openTimeModal: function () {
    this.updatePreview()
    this.setData({ showTimeModal: true })
  },

  closeTimeModal: function () {
    this.setData({ showTimeModal: false })
  },

  onYearChange: function (e) {
    this.setData({ yearIdx: Number(e.detail.value) })
    this.updatePreview()
  },
  onMonthChange: function (e) {
    this.setData({ monthIdx: Number(e.detail.value) })
    this.updatePreview()
  },
  onDayChange: function (e) {
    this.setData({ dayIdx: Number(e.detail.value) })
    this.updatePreview()
  },
  onHourChange: function (e) {
    this.setData({ hourIdx: Number(e.detail.value) })
    this.updatePreview()
  },
  onMinuteChange: function (e) {
    this.setData({ minuteIdx: Number(e.detail.value) })
    this.updatePreview()
  },
  onSecondChange: function (e) {
    this.setData({ secondIdx: Number(e.detail.value) })
    this.updatePreview()
  },
  onDateSeparatorInput: function (e) {
    this.setData({ dateSeparator: e.detail.value })
    this.updatePreview()
  },
  onTimeSeparatorInput: function (e) {
    this.setData({ timeSeparator: e.detail.value })
    this.updatePreview()
  },

  /**
   * 根据当前配置生成时间字符串
   * 年/月/日用 dateSeparator 连接，时/分/秒用 timeSeparator 连接
   * 两部分之间用空格分隔
   */
  buildTimeString: function () {
    var d = new Date()
    var pad = function (n) { return n < 10 ? '0' + n : '' + n }
    var data = this.data

    var dateParts = []
    if (data.yearIdx === 1) dateParts.push(String(d.getFullYear()).slice(-2))
    else if (data.yearIdx === 2) dateParts.push(String(d.getFullYear()))
    if (data.monthIdx === 1) dateParts.push(String(d.getMonth() + 1))
    else if (data.monthIdx === 2) dateParts.push(pad(d.getMonth() + 1))
    if (data.dayIdx === 1) dateParts.push(String(d.getDate()))
    else if (data.dayIdx === 2) dateParts.push(pad(d.getDate()))

    var timeParts = []
    if (data.hourIdx === 1) timeParts.push(String(d.getHours()))
    else if (data.hourIdx === 2) timeParts.push(pad(d.getHours()))
    if (data.minuteIdx === 1) timeParts.push(String(d.getMinutes()))
    else if (data.minuteIdx === 2) timeParts.push(pad(d.getMinutes()))
    if (data.secondIdx === 1) timeParts.push(String(d.getSeconds()))
    else if (data.secondIdx === 2) timeParts.push(pad(d.getSeconds()))

    var parts = []
    if (dateParts.length > 0) parts.push(dateParts.join(data.dateSeparator))
    if (timeParts.length > 0) parts.push(timeParts.join(data.timeSeparator))
    return parts.join(' ')
  },

  updatePreview: function () {
    var preview = this.buildTimeString()
    this.setData({ timePreview: preview || '（无）' })
  },

  // 确认插入时间：直接追加到打印内容框
  confirmTimeFormat: function () {
    var timeStr = this.buildTimeString()
    if (!timeStr) {
      wx.showToast({ title: '请至少选择一个时间字段', icon: 'none' })
      return
    }
    var newContent = this.data.content
    if (newContent) {
      newContent = newContent + ' ' + timeStr
    } else {
      newContent = timeStr
    }
    this.setData({ content: newContent, showTimeModal: false })
  },

  // 分享
  onShareAppMessage: function () {
    return {
      title: '喷码打印下发 - 物联网云平台',
      path: '/pages/print/print?id=' + this.data.deviceId
    }
  },

  // 下发
  onSubmit: function () {
    var that = this
    // BUG-019 修复：入口防重入，避免双击重复提交
    if (this.data.submitting) return
    var data = this.data
    var deviceId = data.deviceId
    var content = data.content
    var fontSize = Number(data.fontSize)
    var count = Number(data.count)
    var immediate = data.immediate

    if (!deviceId) {
      wx.showToast({ title: '缺少设备信息', icon: 'none' })
      return
    }
    if (!content) {
      wx.showToast({ title: '请输入打印内容', icon: 'none' })
      return
    }
    if (content.length > 500) {
      wx.showToast({ title: '打印内容不能超过 500 字', icon: 'none' })
      return
    }
    if (isNaN(count) || count < 1) {
      wx.showToast({ title: '喷印次数需为≥1的数字', icon: 'none' })
      return
    }
    if (count > 99) {
      wx.showToast({ title: '单次最多 99 次', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    api.post('/device/print/dispatch', {
      device_id: deviceId,
      content: content,
      font_size: fontSize,
      print_count: count,
      immediate: immediate ? 1 : 0
    })
      .then(function () {
        wx.showToast({ title: '下发成功', icon: 'success' })
        setTimeout(function () {
          wx.navigateBack()
        }, 800)
      })
      .catch(function (err) {
        console.error('[print] dispatch error:', err)
      })
      .then(function () {
        that.setData({ submitting: false })
      })
  }
})
