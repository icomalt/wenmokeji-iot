# 喷码机物联网微信小程序 —— 部署上线指南

## 一、微信公众平台后台配置（必须）

登录 [微信公众平台](https://mp.weixin.qq.com) → 开发 → 开发管理 → 开发设置：

### 1.1 服务器域名配置

| 域名类型 | 填写内容 | 说明 |
|---------|---------|------|
| **request 合法域名** | `https://iot.your-domain.com` | HTTPS 接口基础域名（与 config.js 中 baseUrl 对应） |
| **socket 合法域名** | `wss://iot.your-domain.com` | WebSocket 长连接域名（与 config.js 中 wsUrl 对应） |
| uploadFile 合法域名 | `https://iot.your-domain.com` | 如有文件上传功能需配置 |
| downloadFile 合法域名 | `https://iot.your-domain.com` | 如有文件下载功能需配置 |

**注意事项：**
- 域名必须为 HTTPS（证书建议使用 Let's Encrypt 免费证书）
- 域名必须经过 ICP 备案
- 不支持 IP 地址，必须为域名
- 开发阶段可在微信开发者工具中勾选「不校验合法域名」

### 1.2 小程序信息

- 小程序 AppID：`wx8c5a2b95965410ba`（已在 project.config.json 中配置）
- 小程序名称：喷码机物联网
- 小程序类目：工具 → 效率

---

## 二、环境切换（config.js）

打开 `utils/config.js`，修改 `CURRENT_ENV` 字段即可：

```javascript
const CURRENT_ENV = 'dev'      // 开发环境，对接公司物联网平台（mock=false）
// const CURRENT_ENV = 'staging' // 预发布环境，联调验证
// const CURRENT_ENV = 'prod'    // 正式生产环境，上线前切换
```

### 各环境说明

| 环境 | mock | baseUrl | 用途 |
|------|------|---------|------|
| dev | false | 8.134.177.27:8082/api/v1 | 对接公司物联网平台（阿里云） |
| staging | false | iot-staging.your-domain.com | 预发布验证 |
| prod | false | iot.your-domain.com | 正式上线 |

---

## 三、后端接口约定 Checklist

### 3.1 登录鉴权

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 验证码图片 | GET | /pub/captcha | 返回 JSON 格式：{ code:0, data: { verify_key, img } }，其中 img 为 base64 图片 |
| 账号登录 | POST | /login | body: { user_name, user_password, verify_code, verify_key, lang }，返回 JWT token |
| 登出 | POST | /auth/logout | 使后端 token 失效，前端清除本地缓存 |
| 管理员验证 | POST | /auth/verify-admin | body: { password }，验证添加/删除设备权限 |

**登录响应格式（平台实际）：**
```json
{
  "code": 0,
  "message": "",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "user_name": "admin",
    "user_nickname": "管理员",
    "list": [...],
    "version": "1.0"
  }
}
```
> 平台采用 JWT Bearer token 鉴权，无 refreshToken 机制。JWT payload 中包含 User 对象（id、user_name、user_nickname、role_id、tenant_id 等字段），前端通过 decodeJwt 解码提取过期时间和用户信息。

### 3.2 设备管理

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 设备统计 | GET | /device/statistic | 返回 total/online/offline/fault |
| 设备列表 | GET | /device/list | 分页，按 token 中 tenant_id 过滤，query: { device_name, page_num, page_size } |
| 设备详情 | GET | /device/info | query: { device_id }，返回设备实时信息 |
| 添加设备 | POST | /device/add | body: { device_id }，需先通过 /auth/verify-admin 鉴权 |
| 删除设备 | POST | /device/delete | body: { device_id }，需先通过 /auth/verify-admin 鉴权 |
| 打印下发 | POST | /device/print/dispatch | body: { deviceId, content, fontSize, count, immediate } |
| 历史记录 | GET | /device/print/history | 分页，body: { deviceId, page, pageSize } |

### 3.3 WebSocket

- 连接地址：wss://iot.your-domain.com/ws（URL 不携带 token）
- 鉴权方式：连接建立后，客户端发送第一条消息 { type: auth, token: xxx } 进行鉴权
- 鉴权成功：后端返回 { type: auth_ok }
- 鉴权失败：后端返回 { code: 4001, message: token expired }
- 心跳：客户端每 25s 发送 { type: ping }，服务端需回复 { type: pong }
- 设备绑定通知：客户端发送 { type: device_bind, data: { deviceId, action: add|remove } }
- 列表变更推送：后端推送 { type: device_list_change } 通知前端刷新设备列表
- 状态变更推送：后端推送 { type: device_status, data: { deviceId, onlineStatus, faultStatus, printTime } }
- 权限隔离：后端根据 token 中的 customerId 过滤推送数据

---

## 四、发布前自测清单

### 4.1 功能测试

- [ ] 登录/登出功能正常
- [ ] 设备列表加载、下拉刷新、上拉分页正常
- [ ] 设备详情展示正常
- [ ] 打印下发成功后，详情页数据自动刷新
- [ ] 历史记录查询正常
- [ ] WebSocket 实时状态更新正常
- [ ] 网络断开时有提示，恢复后可正常使用
- [ ] token 过期后自动刷新或跳转登录

### 4.2 兼容性测试

- [ ] iOS 12+ 所有机型
- [ ] Android 主流机型（华为、小米、OPPO、VIVO）
- [ ] 微信版本 7.0+

### 4.3 异常场景测试

- [ ] 无网络环境下的提示
- [ ] 接口超时/服务器错误的重试
- [ ] 连续快速操作的 loading 处理
- [ ] 退出登录后数据清理
- [ ] 小程序切后台后恢复

### 4.4 合规性检查

- [ ] 用户协议已配置
- [ ] 隐私政策已配置
- [ ] 无违规内容（广告、诱导分享等）
- [ ] 类目资质已上传

---

## 五、发布流程

### 5.1 上传代码

1. 打开微信开发者工具，打开项目
2. 确认 `project.config.json` 中 appid 正确
3. 点击「上传」按钮
4. 填写版本号（如 `1.0.0`）和项目备注
5. 等待上传成功

### 5.2 提交审核

1. 登录微信公众平台
2. 进入「版本管理」→「开发版本」
3. 点击「提交审核」
4. 填写审核信息（测试账号、功能说明等）
5. 等待审核通过（一般 1-7 天）

### 5.3 发布上线

1. 审核通过后，点击「发布」
2. 版本正式对外提供

---

## 六、常见问题排查

### Q1: 开发工具中请求报「request:fail url not in domain list」
A: 在开发者工具右上角「详情」→「本地设置」→ 勾选「不校验合法域名」

### Q2: 真机上请求报 404
A: 检查 config.js 中 baseUrl 是否为正确的生产环境地址，确认微信后台已配置合法域名

### Q3: WebSocket 连接不上
A: 检查 wsUrl 是否使用 wss://，检查微信后台 socket 合法域名配置

### Q4: token 过期后接口返回 401
A: 平台无 refreshToken 机制，token 过期后前端会自动清理登录态并跳转登录页，重新登录即可

### Q5: 小程序包大小超过 2MB
A: 在 project.config.json 的 packOptions.ignore 中配置需忽略的文件；图片等资源可放在 CDN

---

## 七、版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-08-15 | 初始版本，支持设备管理、打印下发、历史记录 |
