/**
 * 喷码打印页 —— 对接公司平台 /api/v1/inkjet_printer/*
 * 1. 从 /inkjet_printer/k300_list 加载可喷印设备
 * 2. 输入内容，可插入格式化时间
 * 3. 用户确认后调用 /inkjet_printer/start 下发
 *
 * 注意：开发/联调期间禁止自动或批量调用 start 接口。
 */
const api = require('../../utils/request')
const deviceMapper = require('../../utils/deviceMapper')

Page({
  data: {
    deviceId: '',
    deviceName: '',
    deviceCompanyName: '',
    deviceStatusText: '',
    deviceOptions: [],
    selectedDevIndex: 0,
    content: '',
    submitting: false,

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
    this._preferredDeviceId = options.id ? decodeURIComponent(options.id) : ''
    this.fetchDevices()
  },

  fetchDevices: function () {
    var that = this
    return api.post('/inkjet_printer/k300_list', {}, { loading: true })
      .then(function (res) {
        var result = deviceMapper.parseDeviceListResponse(res)
        var devices = result.list.filter(function (d) { return !!d.deviceId })
        if (devices.length === 0) {
          wx.showToast({ title: '暂无可喷印设备', icon: 'none' })
          that.setData({ deviceOptions: [] })
          return
        }

        var selectedIndex = that._preferredDeviceId ? -1 : 0
        if (that._preferredDeviceId) {
          devices.some(function (d, index) {
            if (String(d.deviceId) === String(that._preferredDeviceId)) {
              selectedIndex = index
              return true
            }
            return false
          })
        }
        if (selectedIndex < 0) {
          that.setData({
            deviceOptions: devices.map(function (d) {
              return { label: d.companyName ? d.deviceId + '（' + d.companyName + '）' : d.deviceId, value: d.deviceId, statusText: d.statusText, companyName: d.companyName }
            }),
            selectedDevIndex: 0,
            deviceId: '',
            deviceName: '',
            deviceCompanyName: '',
            deviceStatusText: ''
          })
          wx.showToast({ title: '当前设备不支持喷码打印', icon: 'none' })
          return
        }
        that.applySelectedDevice(devices, selectedIndex)
      })
      .catch(function (err) {
        console.error('[print] fetchDevices error:', err)
      })
  },

  applySelectedDevice: function (devices, index) {
    var selected = devices[index] || {}
    this.setData({
      deviceOptions: devices.map(function (d) {
        return {
          label: d.companyName ? d.deviceId + '（' + d.companyName + '）' : d.deviceId,
          value: d.deviceId,
          statusText: d.statusText,
          companyName: d.companyName
        }
      }),
      selectedDevIndex: index,
      deviceId: selected.deviceId || '',
      deviceName: selected.deviceName || selected.deviceId || '',
      deviceCompanyName: selected.companyName || '',
      deviceStatusText: selected.statusText || ''
    })
  },

  onDeviceChange: function (e) {
    this.applySelectedDevice(this.data.deviceOptions.map(function (d) {
      return {
        deviceId: d.value,
        deviceName: d.label,
        statusText: d.statusText,
        companyName: d.companyName
      }
    }), Number(e.detail.value))
  },

  onInput: function (e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value })
  },

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

  confirmTimeFormat: function () {
    var timeStr = this.buildTimeString()
    if (!timeStr) {
      wx.showToast({ title: '请至少选择一个时间字段', icon: 'none' })
      return
    }
    var content = this.data.content
    this.setData({
      content: content ? content + ' ' + timeStr : timeStr,
      showTimeModal: false
    })
  },

  onShareAppMessage: function () {
    return {
      title: '喷码打印 - 文墨物联网',
      path: '/pages/print/print?id=' + encodeURIComponent(this.data.deviceId)
    }
  },

  onSubmit: function () {
    if (this.data.submitting) return

    var deviceId = this.data.deviceId
    var content = this.data.content
    if (!deviceId) {
      wx.showToast({ title: '请选择喷码设备', icon: 'none' })
      return
    }
    if (this.data.deviceStatusText === '离线') {
      wx.showToast({ title: '设备离线，无法下发', icon: 'none' })
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

    this.setData({ submitting: true })
    api.post('/inkjet_printer/start', {
      dev_id: deviceId,
      content: content
    }, { loading: true })
      .then(function () {
        wx.showToast({ title: '喷印成功', icon: 'success' })
        setTimeout(function () { wx.navigateBack() }, 800)
      })
      .catch(function (err) {
        console.error('[print] start error:', err)
      })
      .then(function () {
        this.setData({ submitting: false })
      }.bind(this))
  }
})