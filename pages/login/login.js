/**
 * 登录页逻辑 —— 对接公司物联网平台
 * 1. 进入拉取验证码图片（base64 方式，避免 cookie 跨域问题）
 * 2. 账号 + 密码 + 验证码 → 调用平台 /pub/login → 获取 JWT token
 * 3. 从 JWT 中解码用户信息，缓存 token/userInfo
 * 4. 全程异常捕获 + loading + toast
 */
const api = require('../../utils/request')
const auth = require('../../utils/auth')
const config = require('../../utils/config')

Page({
  data: {
    username: '',
    password: '',
    captcha: '',            // 用户输入的验证码
    captchaImg: '',         // 验证码图片 base64
    captchaLoading: false,   // 验证码是否正在加载
    loading: false,
    isMock: config.mock,
    logoExists: true
  },

  onLoad: function () {
    // 已登录直接跳首页
    if (auth.isLogin()) {
      wx.reLaunch({ url: '/pages/home/home' })
      return
    }
    // 读取记住的账号
    var savedUser = wx.getStorageSync('iot_saved_user') || ''
    this.setData({ username: savedUser })
    // 加载验证码
    if (!config.mock) {
      this.fetchCaptcha()
    }
  },

  // 获取验证码图片（base64 方式，同时保存 cookie）
  fetchCaptcha: function () {
    var that = this
    this.setData({ captchaLoading: true })
    wx.request({
      url: config.baseUrl + '/pub/captcha?t=' + Date.now(),
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 10000,
      success: function (res) {
        // 验证码图片转 base64
        if (res.data && res.statusCode === 200) {
          var base64 = wx.arrayBufferToBase64(res.data)
          that.setData({
            captchaImg: 'data:image/png;base64,' + base64,
            captchaLoading: false
          })
        }
        // 提取 cookie（用于登录时携带）
        var cookie = ''
        if (res.header) {
          cookie = res.header['Set-Cookie'] || res.header['set-cookie'] || res.header['Cookie'] || ''
        }
        that._captchaCookie = cookie
      },
      fail: function () {
        that.setData({ captchaLoading: false })
        wx.showToast({ title: '验证码加载失败', icon: 'none' })
      }
    })
  },

  // Logo 图片加载失败 → 切换为 CSS 绘制版本
  onLogoError: function () {
    this.setData({ logoExists: false })
  },

  // 输入双向绑定
  onInput: function (e) {
    var key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail.value })
  },

  // 登录
  onLogin: function () {
    var that = this
    var username = this.data.username
    var password = this.data.password
    var captcha = this.data.captcha

    if (!username) {
      wx.showToast({ title: '请输入账号', icon: 'none' })
      return
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    if (!captcha) {
      wx.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    // 直接调用平台登录接口（需要携带验证码 cookie）
    wx.request({
      url: config.baseUrl + '/pub/login',
      method: 'POST',
      data: {
        username: username,
        password: password,
        captcha: captcha
      },
      header: {
        'Content-Type': 'application/json',
        'Cookie': that._captchaCookie || ''
      },
      timeout: config.requestTimeout,
      success: function (res) {
        if (res.statusCode === 200) {
          var body = res.data || {}
          // 兼容多种返回格式
          var token = body.token || (body.data && body.data.token) || ''
          if (!token) {
            wx.showToast({ title: body.message || '登录失败', icon: 'none' })
            that.refreshCaptcha()
            return
          }
          // 保存 JWT token（自动从 JWT 中解码过期时间）
          auth.setToken(token)
          // 从 JWT 中解码用户信息
          var userInfo = auth.decodeUserInfo() || {}
          var displayInfo = {
            id: userInfo.id,
            username: userInfo.user_name || username,
            name: userInfo.user_nickname || username,
            mobile: userInfo.mobile,
            roleId: userInfo.role_id,
            address: userInfo.address,
            tenantId: userInfo.tenant_id
          }
          auth.setUserInfo(displayInfo)
          // 记住账号
          wx.setStorageSync('iot_saved_user', username)
          wx.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(function () {
            wx.reLaunch({ url: '/pages/home/home' })
          }, 600)
        } else {
          var msg = (res.data && res.data.message) || '登录失败'
          wx.showToast({ title: msg, icon: 'none' })
          that.refreshCaptcha()
        }
      },
      fail: function () {
        wx.showToast({ title: '网络异常，请检查网络', icon: 'none' })
        that.refreshCaptcha()
      },
      complete: function () {
        that.setData({ loading: false })
      }
    })
  },

  // 刷新验证码
  refreshCaptcha: function () {
    this.setData({ captcha: '' })
    this.fetchCaptcha()
  },

  // 密码输入框确认键
  onConfirmPassword: function () {
    this.onLogin()
  }
})
