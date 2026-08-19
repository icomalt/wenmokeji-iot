/**
 * 小程序入口 —— 生产级
 * ============================================================
 * 1. 启动时检查登录态，未登录跳转登录页
 * 2. 已登录加载用户信息到全局
 * 3. 版本更新检测（wx.getUpdateManager）
 * 4. 全局错误捕获（onError）
 * 5. 页面不存在处理（onPageNotFound）
 * 6. 全局网络状态监听（断网提示 + 恢复提示）
 * 7. 系统信息获取（安全区域、状态栏高度）
 * 8. 维护全局数据（用户信息、当前选中设备、系统信息）
 */
const auth = require('./utils/auth')

App({
  globalData: {
    userInfo: null,          // 当前登录用户信息
    currentDevice: null,     // 当前选中设备（用于详情/打印传参）
    systemInfo: null,        // 系统信息（含安全区域、状态栏高度）
    networkType: 'unknown',  // 当前网络类型
    isOnline: true           // 网络是否可用
  },

  onLaunch: function () {
    // ====== 系统信息获取 ======
    try {
      const sysInfo = wx.getSystemInfoSync()
      this.globalData.systemInfo = sysInfo
    } catch (e) {
      console.warn('[app] 获取系统信息失败', e)
    }

    // ====== 版本更新检测 ======
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()
      updateManager.onCheckForUpdate(function (res) {
        // 请求完新版本信息
        if (res.hasUpdate) {
          console.log('[app] 检测到新版本')
        }
      })
      updateManager.onUpdateReady(function () {
        wx.showModal({
          title: '更新提示',
          content: '新版本已下载完成，是否重启应用？',
          success: function (res) {
            if (res.confirm) {
              updateManager.applyUpdate()
            }
          }
        })
      })
      updateManager.onUpdateFailed(function () {
        wx.showToast({ title: '新版本下载失败，请检查网络后重试', icon: 'none' })
      })
    }

    // ====== 登录态检查 ======
    if (!auth.isLogin()) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.globalData.userInfo = auth.getUserInfo()

    // ====== 全局网络状态监听 ======
    const that = this
    wx.getNetworkType({
      success: function (res) {
        that.globalData.networkType = res.networkType
        that.globalData.isOnline = res.networkType !== 'none'
      }
    })
    wx.onNetworkStatusChange(function (res) {
      that.globalData.networkType = res.networkType
      that.globalData.isOnline = res.isConnected
      if (!res.isConnected) {
        wx.showToast({ title: '网络已断开，请检查网络', icon: 'none', duration: 2000 })
      } else {
        wx.showToast({ title: '网络已恢复', icon: 'success', duration: 1500 })
      }
    })
  },

  // 小程序从前台进入后台时触发
  onHide: function () {
    console.log('[app] 小程序进入后台')
  },

  // 小程序从后台进入前台时触发
  onShow: function () {
    // 回到前台时检查登录态是否仍然有效
    if (!auth.isLogin()) {
      wx.reLaunch({ url: '/pages/login/login' })
    }
  },

  // 全局错误捕获：程序发生脚本错误或 API 调用失败时触发
  onError: function (err) {
    console.error('[app] 全局错误:', err)
    // 上报错误到服务端（生产环境可对接日志系统）
    // api.post('/log/error', { error: String(err), timestamp: Date.now() })
  },

  // 页面不存在时的回调
  onPageNotFound: function () {
    console.warn('[app] 页面不存在')
    wx.reLaunch({ url: '/pages/home/home' })
  },

  // 系统切换主题时的回调（暗色/亮色模式）
  onThemeChange: function (res) {
    console.log('[app] 主题切换:', res.theme)
  }
})
