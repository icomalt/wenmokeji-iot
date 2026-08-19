/**
 * 登录页逻辑 —— 对接公司物联网平台
 * 1. 进入拉取验证码图片（平台返回 JSON，含 verify_key + base64 图片）
 * 2. 账号 + 密码 + 验证码 + verify_key → 调用平台 /api/v1/login → 获取 JWT token
 *    平台参数名：user_name, user_password, verify_code, verify_key, lang
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

  // 获取验证码图片（平台返回 JSON：{ code:0, data: { verify_key, img } }）
  fetchCaptcha: function () {
    var that = this
    this.setData({ captchaLoading: true })
    wx.request({
      url: config.baseUrl + '/pub/captcha?t=' + Date.now(),
      method: 'GET',
      timeout: 10000,
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          var body = res.data || {}
          // 平台返回格式：{ code:0, data: { verify_key, img } }
          var captchaData = body.data || body
          var img = captchaData.img || ''
          var key = captchaData.verify_key || ''
          if (img) {
            that.setData({
              captchaImg: img,  // img 已包含 data:image/png;base64, 前缀
              captchaLoading: false
            })
          }
          // 保存验证码 key（登录时提交，替代 cookie 方案）
          that._captchaKey = key
        } else {
          that.setData({ captchaLoading: false })
        }
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

    // 调用平台登录接口 /api/v1/login
    // 平台参数：user_name, user_password, verify_code, verify_key, lang
    wx.request({
      url: config.baseUrl + '/login',
      method: 'POST',
      data: {
        user_name: username,
        user_password: password,
        verify_code: captcha,
        verify_key: that._captchaKey || '',
        lang: 'zh'
      },
      header: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: config.requestTimeout,
      success: function (res) {
        if (res.statusCode === 200) {
          var body = res.data || {}
          // 平台返回格式：{ code:0, message:'', data: { token, user_name, user_nickname, ... } }
          if (body.code !== 0) {
            wx.showToast({ title: body.message || '登录失败', icon: 'none' })
            that.refreshCaptcha()
            return
          }
          var dataObj = body.data || {}
          var token = dataObj.token || ''
          if (!token) {
            wx.showToast({ title: '返回数据异常', icon: 'none' })
            that.refreshCaptcha()
            return
          }
          // 保存 JWT token（自动从 JWT 中解码过期时间）
          auth.setToken(token)
          // 优先用响应数据中的用户信息，再从 JWT 中补充
          var jwtUserInfo = auth.decodeUserInfo() || {}
          var displayInfo = {
            id: jwtUserInfo.id,
            username: dataObj.user_name || jwtUserInfo.user_name || username,
            name: dataObj.user_nickname || jwtUserInfo.user_nickname || username,
            mobile: jwtUserInfo.mobile,
            roleId: jwtUserInfo.role_id,
            address: jwtUserInfo.address,
            tenantId: jwtUserInfo.tenant_id
          }
          auth.setUserInfo(displayInfo)
          // 记住账号
          wx.setStorageSync('iot_saved_user', username)
          wx.showToast({ title: '登录成功', icon: 'success' })
          setTimeout(function () {
            wx.reLaunch({ url: '/pages/home/home' })
          }, 600)
        } else {
          var msg = (res.data && res.data.message) || '登录失败(' + res.statusCode + ')'
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
