/**
 * 登录页逻辑
 * 1. 已登录直接跳设备列表
 * 2. 账号密码校验 → 调用云平台 /auth/login → 缓存 token/userInfo → reLaunch 到设备列表
 * 3. 全程异常捕获 + loading + toast
 * 4. Mock 模式下支持任意账号密码登录
 */
const api = require('../../utils/request')
const auth = require('../../utils/auth')
const config = require('../../utils/config')

Page({
  data: {
    username: '',
    password: '',
    loading: false,
    isMock: config.mock,
    logoExists: true  // logo.png 是否存在，图片加载失败时自动切换为 CSS 绘制版本
  },

  onLoad: function () {
    // 已登录直接跳首页
    if (auth.isLogin()) {
      wx.reLaunch({ url: '/pages/home/home' })
      return
    }
    // 读取记住的账号
    const savedUser = wx.getStorageSync('iot_saved_user') || ''
    this.setData({ username: savedUser })
  },

  // Logo 图片加载失败 → 切换为 CSS 绘制版本
  onLogoError: function () {
    this.setData({ logoExists: false })
  },

  // 输入双向绑定
  onInput: function (e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail.value })
  },

  // 登录
  onLogin: function () {
    const that = this
    const username = this.data.username
    const password = this.data.password

    if (!username) {
      wx.showToast({ title: '请输入账号', icon: 'none' })
      return
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    api.post('/auth/login', { username: username, password: password })
      .then(function (res) {
        // 约定返回 { token, userInfo }
        if (!res || !res.token) {
          wx.showToast({ title: '登录返回异常', icon: 'none' })
          return
        }
        // 保存 token、refreshToken、过期时间
        auth.setToken(res.token, res.expiresIn || 7200)
        if (res.refreshToken) {
          auth.setRefreshToken(res.refreshToken)
        }
        auth.setUserInfo(res.userInfo || {})
        // 记住账号
        wx.setStorageSync('iot_saved_user', that.data.username)
        wx.showToast({ title: '登录成功', icon: 'success' })
        setTimeout(function () {
          wx.reLaunch({ url: '/pages/home/home' })
        }, 600)
      })
      .catch(function () {
        // 异常已在 request 内统一 toast
      })
      .then(function () {
        that.setData({ loading: false })
      })
  },

  // 密码输入框确认键
  onConfirmPassword: function () {
    this.onLogin()
  }
})
