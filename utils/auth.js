/**
 * 鉴权工具 —— 增强版
 * ============================================================
 * 负责 token / refreshToken / 用户信息 的本地存取、
 * 过期判断、自动刷新、清理、登录态判断。
 * 所有数据均使用 wx.sync 同步接口，保证取值即时可用。
 */
const config = require('./config')

// ============ 内部辅助：token 过期时间戳 ============

/** 保存 token 过期时间戳（秒，UNIX 时间戳） */
function setTokenExpire(expireSeconds) {
  try {
    // 计算绝对过期时间戳
    const expireAt = Math.floor(Date.now() / 1000) + expireSeconds
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
 * @returns {boolean} true=需要刷新
 */
function isTokenExpiringSoon(threshold) {
  const t = threshold || config.tokenRefreshThreshold || 300
  const expireAt = getTokenExpire()
  if (!expireAt) return false
  const now = Math.floor(Date.now() / 1000)
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
   * @param {string} token
   * @param {number} expireSeconds token 有效期（秒），可选
   */
  setToken(token, expireSeconds) {
    try {
      wx.setStorageSync(config.tokenKey, token)
      if (expireSeconds) {
        setTokenExpire(expireSeconds)
      }
    } catch (e) {
      console.warn('[auth] setToken 失败', e)
    }
  },

  /** 读取 refreshToken */
  getRefreshToken() {
    try {
      return wx.getStorageSync(config.refreshTokenKey) || ''
    } catch (e) {
      return ''
    }
  },

  /** 保存 refreshToken */
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

  /** 是否已登录（仅判断 token 是否存在） */
  isLogin() {
    return !!this.getToken()
  },

  /**
   * 判断 token 是否需要刷新
   * @param {number} threshold 提前量（秒）
   */
  needRefresh(threshold) {
    return isTokenExpiringSoon(threshold)
  },

  /**
   * 调用后端接口刷新 token
   * @returns {Promise<string>} 新 token
   */
  refreshToken() {
    const request = require('./request')
    const rt = this.getRefreshToken()
    if (!rt) {
      return Promise.reject(new Error('无 refreshToken'))
    }
    return request.post('/auth/refresh', { refreshToken: rt }).then(function (data) {
      // 后端返回：{ token, refreshToken, expiresIn }
      if (data && data.token) {
        this.setToken(data.token, data.expiresIn || 7200)
        if (data.refreshToken) {
          this.setRefreshToken(data.refreshToken)
        }
        return data.token
      }
      throw new Error('刷新 token 返回异常')
    }.bind(this))
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
  }
}
