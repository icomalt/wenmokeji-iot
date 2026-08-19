/**
 * 打印下发页逻辑
 * 1. 接收 deviceId / deviceName 参数
 * 2. 表单校验 → 调用 /device/print/dispatch → 成功后返回
 * 3. 提交期间禁用按钮，防止重复下发
 */
const api = require('../../utils/request')

Page({
  data: {
    deviceId: '',
    deviceName: '',
    content: '',
    fontSize: 16,
    count: 1,
    immediate: true,
    submitting: false
  },

  onLoad: function (options) {
    this.setData({
      deviceId: options.id || '',
      deviceName: options.name ? decodeURIComponent(options.name) : ''
    })
    // 若未通过参数传入设备名，则拉取一次
    if (options.id && !options.name) {
      api.get('/device/detail', { deviceId: options.id }, { loading: false })
        .then((res) => {
          const d = res.device || res
          this.setData({ deviceName: d.deviceName || '' })
        })
        .catch(() => {})
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

  // 分享给朋友
  onShareAppMessage: function () {
    return {
      title: '喷码打印下发 - 物联网云平台',
      path: '/pages/print/print?id=' + this.data.deviceId
    }
  },

  // 下发
  onSubmit: function () {
    const that = this
    const { deviceId, content, fontSize, count, immediate } = this.data

    if (!deviceId) {
      wx.showToast({ title: '缺少设备信息', icon: 'none' })
      return
    }
    if (!content) {
      wx.showToast({ title: '请输入打印内容', icon: 'none' })
      return
    }
    const numCount = Number(count)
    if (isNaN(numCount) || numCount < 1) {
      wx.showToast({ title: '喷印次数需为≥1的数字', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    api.post('/device/print/dispatch', {
      deviceId: deviceId,
      content: content,
      fontSize: Number(fontSize),
      count: numCount,
      immediate: immediate
    })
      .then(function () {
        wx.showToast({ title: '下发成功', icon: 'success' })
        setTimeout(function () {
          wx.navigateBack()
        }, 800)
      })
      .catch(function () {})
      .then(function () {
        that.setData({ submitting: false })
      })
  }
})
