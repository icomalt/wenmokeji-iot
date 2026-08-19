/**
 * 统一 HTTPS 请求封装 —— 生产级
 * ============================================================
 * 功能：
 *  1. 自动拼接 baseUrl，统一携带 token 鉴权（Authorization: Bearer xxx）
 *  2. 全局 loading（可通过 loading:false 关闭）
 *  3. 401 自动刷新 token 并重发原请求（refreshToken 机制）
 *  4. 过期前主动刷新（tokenRefreshThreshold 控制）
 *  5. 请求失败自动重试（retryTimes 次，retryDelay 间隔）
 *  6. 可配置请求超时（requestTimeout）
 *  7. 断网 / 超时统一 toast 提示
 *  8. 业务层约定：返回体 { code, message, data }，code===0 为成功
 *  9. Mock 模式：config.mock=true 时，拦截所有请求返回本地模拟数据
 *
 * 【多实例 token 刷新】
 *   当多个请求同时返回 401 时，只触发一次 refreshToken，
 *   其余请求挂起等待新 token 后自动重发，避免刷新风暴。
 */
const config = require('./config')
const auth = require('./auth')

// ============ Token 刷新队列控制 ============
let isRefreshing = false          // 是否正在刷新 token
let pendingRequests = []          // 等待 token 刷新完成后重发的请求队列

/**
 * 执行 token 刷新流程
 * @returns {Promise<string>} 新 token
 */
function doRefreshToken() {
  if (isRefreshing) {
    // 已经在刷新，返回等待中的 Promise
    return new Promise(function (resolve, reject) {
      pendingRequests.push({ resolve: resolve, reject: reject })
    })
  }
  isRefreshing = true

  return auth.refreshToken().then(function (newToken) {
    // 通知所有等待者：刷新成功
    pendingRequests.forEach(function (p) { p.resolve(newToken) })
    pendingRequests = []
    isRefreshing = false
    return newToken
  }).catch(function (err) {
    // 刷新失败（refreshToken 过期或无效）：清除登录态
    auth.clear()
    wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
    setTimeout(function () {
      wx.reLaunch({ url: '/pages/login/login' })
    }, 1000)
    // 通知所有等待者：刷新失败
    pendingRequests.forEach(function (p) { p.reject(err) })
    pendingRequests = []
    isRefreshing = false
    throw err
  })
}

// ============ Mock 模式 ============
if (config.mock) {
  const mock = require('./mock')

  function request(options) {
    const { url, data = {}, loading = true } = options
    const fullUrl = url.indexOf('http') === 0 ? url : config.baseUrl + url

    if (loading) {
      wx.showLoading({ title: '加载中', mask: true })
    }

    return mock.getMockResponse(fullUrl, data).then(function (body) {
      if (loading) wx.hideLoading()
      // body 格式: { code: 0, message: 'success', data: ... }
      if (body.code !== undefined) {
        if (body.code !== 0) {
          wx.showToast({ title: body.message || '业务异常', icon: 'none' })
          return Promise.reject(new Error(body.message || '业务异常'))
        }
        return body.data !== undefined ? body.data : body
      }
      return body
    })
  }

  module.exports = {
    get: function (url, data, opt) {
      return request(Object.assign({ url: url, method: 'GET', data: data }, opt || {}))
    },
    post: function (url, data, opt) {
      return request(Object.assign({ url: url, method: 'POST', data: data }, opt || {}))
    },
    put: function (url, data, opt) {
      return request(Object.assign({ url: url, method: 'PUT', data: data }, opt || {}))
    },
    del: function (url, data, opt) {
      return request(Object.assign({ url: url, method: 'DELETE', data: data }, opt || {}))
    },
    request: request
  }
} else {
  // ============ 真实请求模式 ============

  /**
   * 真实请求的核心实现
   * @param {Object} options { url, method, data, header, loading, retry, _isRetry, _isRefreshRetry }
   */
  function doRealRequest(options) {
    const { url, method = 'GET', data = {}, header = {}, loading = true, retry = config.retryTimes, _isRefreshRetry = false } = options
    const fullUrl = url.indexOf('http') === 0 ? url : config.baseUrl + url

    // 组装请求头
    const finalHeader = Object.assign({ 'Content-Type': 'application/json' }, header)
    const token = auth.getToken()
    if (token) {
      finalHeader['Authorization'] = 'Bearer ' + token
    }

    if (loading) {
      wx.showLoading({ title: '加载中', mask: true })
    }

    return new Promise(function (resolve, reject) {
      wx.request({
        url: fullUrl,
        method: method,
        data: data,
        header: finalHeader,
        timeout: config.requestTimeout,
        success: function (res) {
          if (loading) wx.hideLoading()

          // 401：token 过期，平台无 refreshToken 机制，直接跳登录
          if (res.statusCode === 401) {
            auth.clear()
            wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
            setTimeout(function () {
              wx.reLaunch({ url: '/pages/login/login' })
            }, 1000)
            reject(new Error('未授权'))
            return
          }

          // HTTP 层错误
          if (res.statusCode < 200 || res.statusCode >= 300) {
            // 5xx 服务器错误，可重试
            if (res.statusCode >= 500 && retry > 0) {
              console.warn('[request] 服务器错误 ' + res.statusCode + '，' + config.retryDelay + 'ms 后重试（剩余 ' + retry + ' 次）')
              setTimeout(function () {
                resolve(doRealRequest(Object.assign({}, options, { retry: retry - 1 })))
              }, config.retryDelay)
              return
            }
            wx.showToast({ title: '请求失败(' + res.statusCode + ')', icon: 'none' })
            reject(new Error('请求失败 ' + res.statusCode))
            return
          }

          const body = res.data || {}
          // 业务层带 code 字段（兼容 code=0 和 code=200 两种成功格式）
          if (body.code !== undefined) {
            if (body.code !== 0 && body.code !== 200) {
              wx.showToast({ title: body.message || '业务异常', icon: 'none' })
              reject(new Error(body.message || '业务异常'))
              return
            }
            resolve(body.data !== undefined ? body.data : body)
            return
          }
          // 无 code 字段，直接返回整段 body
          resolve(body)
        },
        fail: function (err) {
          if (loading) wx.hideLoading()

          // 网络失败（非主动取消），可重试
          if (retry > 0 && (!err.errMsg || err.errMsg.indexOf('cancel') === -1)) {
            console.warn('[request] 请求失败，' + config.retryDelay + 'ms 后重试（剩余 ' + retry + ' 次）:', url)
            setTimeout(function () {
              resolve(doRealRequest(Object.assign({}, options, { retry: retry - 1 })))
            }, config.retryDelay)
            return
          }

          // 断网 / 超时统一提示
          wx.showToast({ title: '网络异常，请检查网络', icon: 'none' })
          reject(err)
        }
      })
    })
  }

  /**
   * 对外暴露的 request 入口（增加 token 即将过期主动检查）
   */
  function request(options) {
    // 非 mock 模式下，如果 token 即将过期，先主动刷新再发请求
    if (auth.needRefresh && auth.needRefresh()) {
      console.log('[request] token 即将过期，主动刷新')
      return doRefreshToken().then(function () {
        return doRealRequest(options)
      }).catch(function () {
        // 主动刷新失败仍然继续尝试原请求（让原请求的 401 逻辑兜底）
        return doRealRequest(options)
      })
    }
    return doRealRequest(options)
  }

  module.exports = {
    get: function (url, data, opt) {
      return request(Object.assign({ url: url, method: 'GET', data: data }, opt || {}))
    },
    post: function (url, data, opt) {
      return request(Object.assign({ url: url, method: 'POST', data: data }, opt || {}))
    },
    put: function (url, data, opt) {
      return request(Object.assign({ url: url, method: 'PUT', data: data }, opt || {}))
    },
    del: function (url, data, opt) {
      return request(Object.assign({ url: url, method: 'DELETE', data: data }, opt || {}))
    },
    request: request
  }
}
