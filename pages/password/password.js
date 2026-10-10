/**
 * 修改密码页 —— 对接 /auth/change_password
 * 1. 校验旧密码、新密码、确认密码
 * 2. 调用后端修改密码
 * 3. 成功后清除登录态跳登录页
 */
const api = require('../../utils/request')
const auth = require('../../utils/auth')

Page({
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    submitting: false
  },

  onInput: function (e) {
    var key = e.currentTarget.dataset.key
    this.setData({ [key]: e.detail.value })
  },

  onSubmit: function () {
    var that = this
    var oldPassword = this.data.oldPassword
    var newPassword = this.data.newPassword
    var confirmPassword = this.data.confirmPassword

    if (!oldPassword) {
      wx.showToast({ title: '请输入旧密码', icon: 'none' })
      return
    }
    if (!newPassword) {
      wx.showToast({ title: '请输入新密码', icon: 'none' })
      return
    }
    if (newPassword.length < 6) {
      wx.showToast({ title: '新密码至少6位', icon: 'none' })
      return
    }
    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' })
      return
    }
    if (newPassword === oldPassword) {
      wx.showToast({ title: '新密码不能与旧密码相同', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    api.post('/auth/change_password', {
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword
    }, { loading: true })
      .then(function () {
        wx.showToast({ title: '密码修改成功，请重新登录', icon: 'success' })
        setTimeout(function () {
          auth.clearAuth()
          wx.reLaunch({ url: '/pages/login/login' })
        }, 1200)
      })
      .catch(function (err) {
        console.error('[password] change error:', err)
      })
      .then(function () {
        that.setData({ submitting: false })
      })
  }
})
