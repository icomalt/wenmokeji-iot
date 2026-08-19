/**
 * 鉴权工具 —— 适配公司物联网平台 JWT
 * ============================================================
 * 负责 JWT token / 用户信息 的本地存取、
 * 过期判断（从 JWT payload 中解码 exp）、清理、登录态判断。
 * 平台无 refreshToken 机制，token 过期后直接跳登录页。
 * 所有数据均使用 wx.sync 同步接口，保证取值即时可用。
 */
const config = require('./config')

// ============ 内部辅助：JWT 解码 ============

/**
 * Base64Url 解码（微信小程序不支持 atob，手动实现）
 * @param {string} str Base64Url 字符串
 * @returns {string} 解码后的字符串
 */
function base64UrlDecode(str) {
  // Base64Url → Base64
  var base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  // 补齐 padding
  var pad = base64.length % 4
  if (pad) {
    base64 += new Array(5 - pad).join('=')
  }
  // 使用小程序自带的 base64 解码
  try {
    var arrayBuffer = wx.base64ToArrayBuffer(base64)
    var bytes = new Uint8Array(arrayBuffer)
    var result = ''
    for (var i = 0; i < bytes.length; i++) {
      result += String.fromCharCode(bytes[i])
    }
    return decodeURIComponent(escape(result))
  } catch (e) {
    console.warn('[auth] base64UrlDecode 失败', e)
    return ''
  }
}

/**
 * 解码 JWT token，提取 payload
 * @param {string} token JWT token
 * @returns {object|null} payload 对象
 */
function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null
  var parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    var payloadStr = base64UrlDecode(parts[1])
    return JSON.parse(payloadStr)
  } catch (e) {
    console.warn('[auth] JWT 解码失败', e)
    return null
  }
}

// ============ 内部辅助：token 过期时间戳 ============

/** 保存 token 过期时间戳（秒，UNIX 时间戳） */
function setTokenExpire(expireSeconds) {
  try {
    var expireAt = Math.floor(Date.now() / 1000) + expireSeconds
    wx.setStorageSync(config.tokenExpireKey, expireAt)
  } catch (e) {
    console.warn('[auth] setTokenExpire 失败', e)
  }
}

/** 读取 token 过期时间戳 */
function getTokenExpire() {
  try {
    return wx.getStorageSync(config.tokenExpireKey) || 0
  } catch (e) {
    return 0
  }
}

/**
 * 判断 token 是否即将过期
 * @param {number} threshold 提前量（秒），默认取 config 中的 tokenRefreshThreshold
 * @returns {boolean} true=即将过期
 */
function isTokenExpiringSoon(threshold) {
  var t = threshold || config.tokenRefreshThreshold || 300
  var expireAt = getTokenExpire()
  if (!expireAt) return false
  var now = Math.floor(Date.now() / 1000)
  return (expireAt - now) < t
}

// ============ 导出接口 ============

module.exports = {
  /** 读取 token */
  getToken() {
    try {
      return wx.getStorageSync(config.tokenKey) || ''
    } catch (e) {
      return ''
    }
  },

  /**
   * 保存 token
   * @param {string} token JWT token
   * @param {number} expireSeconds token 有效期（秒），可选（不传则从 JWT 中解码）
   */
  setToken(token, expireSeconds) {
    try {
      wx.setStorageSync(config.tokenKey, token)
      if (expireSeconds) {
        setTokenExpire(expireSeconds)
      } else if (token) {
        // 从 JWT payload 中解码过期时间
        var payload = decodeJwt(token)
        if (payload && payload.exp) {
          var now = Math.floor(Date.now() / 1000)
          var remaining = payload.exp - now
          if (remaining > 0) {
            setTokenExpire(remaining)
          }
        }
      }
    } catch (e) {
      console.warn('[auth] setToken 失败', e)
    }
  },

  /** 读取 refreshToken（平台无此机制，保留兼容） */
  getRefreshToken() {
    try {
      return wx.getStorageSync(config.refreshTokenKey) || ''
    } catch (e) {
      return ''
    }
  },

  /** 保存 refreshToken（平台无此机制，保留兼容） */
  setRefreshToken(refreshToken) {
    try {
      wx.setStorageSync(config.refreshTokenKey, refreshToken)
    } catch (e) {
      console.warn('[auth] setRefreshToken 失败', e)
    }
  },

  /** 读取用户信息 */
  getUserInfo() {
    try {
      return wx.getStorageSync(config.userInfoKey) || null
    } catch (e) {
      return null
    }
  },

  /** 保存用户信息 */
  setUserInfo(info) {
    try {
      wx.setStorageSync(config.userInfoKey, info)
    } catch (e) {
      console.warn('[auth] setUserInfo 失败', e)
    }
  },

  /** 是否已登录（token 存在且未过期） */
  isLogin() {
    var token = this.getToken()
    if (!token) return false
    var expireAt = getTokenExpire()
    if (expireAt) {
      var now = Math.floor(Date.now() / 1000)
      return now < expireAt
    }
    return true
  },

  /**
   * 判断 token 是否即将过期
   * @param {number} threshold 提前量（秒）
   */
  needRefresh(threshold) {
    return isTokenExpiringSoon(threshold)
  },

  /**
   * 刷新 token（平台无 refreshToken 接口，直接返回失败）
   * request.js 中 401 会直接跳转登录页
   */
  refreshToken() {
    return Promise.reject(new Error('平台无 refreshToken 机制，请重新登录'))
  },

  /**
   * 从 JWT token 中解码用户信息
   * @returns {object|null} 用户信息
   */
  decodeUserInfo() {
    var token = this.getToken()
    if (!token) return null
    var payload = decodeJwt(token)
    if (payload && payload.User) {
      return payload.User
    }
    return null
  },

  /**
   * 清除登录态（token + refreshToken + 用户信息 + 过期时间）
   */
  clear() {
    try {
      wx.removeStorageSync(config.tokenKey)
      wx.removeStorageSync(config.refreshTokenKey)
      wx.removeStorageSync(config.userInfoKey)
      wx.removeStorageSync(config.tokenExpireKey)
    } catch (e) {
      console.warn('[auth] clear 失败', e)
    }
  },

  /** 兼容旧代码的 clearAuth */
  clearAuth() {
    this.clear()
  },

  /** 内部方法导出（供 login.js 调用） */
  _decodeJwt: decodeJwt
}

