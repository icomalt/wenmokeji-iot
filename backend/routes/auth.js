/**
 * 认证路由：登录/刷新/登出/管理员验证
 */
const express = require('express')
const jwt = require('jsonwebtoken')
const config = require('../config')
const store = require('../store')
const wsService = require('../ws')

const router = express.Router()

// 登录
router.post('/login', function (req, res) {
  const { username, password } = req.body
  if (!username || !password) {
    return res.json({ code: 1, message: '账号和密码不能为空', data: null })
  }
  const user = store.getUserByUsername(username)
  if (!user || user.password !== password) {
    return res.json({ code: 1, message: '账号或密码错误', data: null })
  }
  const customer = store.getCustomerById(user.customerId)
  const token = jwt.sign(
    { userId: user.id, username: user.username, customerId: user.customerId, role: user.role },
    config.jwtSecret,
    { expiresIn: config.tokenExpiresIn }
  )
  const refreshToken = 'rt_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  store.refreshTokens[refreshToken] = {
    userId: user.id, customerId: user.customerId, username: user.username, role: user.role,
    expireAt: Date.now() + config.refreshTokenExpiresIn * 1000
  }
  res.json({
    code: 0, message: 'success', data: {
      token, refreshToken, expiresIn: config.tokenExpiresIn,
      userInfo: { username: user.username, name: user.username, role: user.role, customerId: user.customerId, customerName: customer ? customer.name : '' }
    }
  })
})

// 刷新 token
router.post('/refresh', function (req, res) {
  const { refreshToken } = req.body
  if (!refreshToken) return res.json({ code: 1, message: '缺少 refreshToken', data: null })
  const stored = store.refreshTokens[refreshToken]
  if (!stored) return res.json({ code: 1, message: 'refreshToken 无效', data: null })
  if (Date.now() > stored.expireAt) {
    delete store.refreshTokens[refreshToken]
    return res.json({ code: 1, message: 'refreshToken 已过期', data: null })
  }
  delete store.refreshTokens[refreshToken]
  const newRefreshToken = 'rt_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  store.refreshTokens[newRefreshToken] = { ...stored, expireAt: Date.now() + config.refreshTokenExpiresIn * 1000 }
  const token = jwt.sign(
    { userId: stored.userId, username: stored.username, customerId: stored.customerId, role: stored.role },
    config.jwtSecret,
    { expiresIn: config.tokenExpiresIn }
  )
  res.json({ code: 0, message: 'success', data: { token, refreshToken: newRefreshToken, expiresIn: config.tokenExpiresIn } })
})

// 登出
router.post('/logout', function (req, res) {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    store.tokenBlacklist.add(authHeader.substring(7))
    Object.keys(store.refreshTokens).forEach(rt => {
      if (store.refreshTokens[rt].userId === (req.user && req.user.userId)) {
        delete store.refreshTokens[rt]
      }
    })
  }
  res.json({ code: 0, message: 'success', data: { success: true } })
})

// 管理员验证
router.post('/verify-admin', function (req, res) {
  const { password } = req.body
  if (!password) return res.json({ code: 1, message: '请输入密码', data: null })
  if (password === config.adminPassword) {
    return res.json({ code: 0, message: 'success', data: { success: true } })
  }
  res.json({ code: 1, message: '密码错误', data: null })
})

module.exports = router
