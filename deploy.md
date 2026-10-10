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

## 三、公司平台接口对接说明

> 小程序 `utils/config.js` 中的 `baseUrl = http://8.134.177.27:8082/api/v1`，下表路径均省略该前缀。

### 3.1 登录鉴权

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 验证码图片 | GET | `/pub/captcha` | 返回 `{ code:0, data:{ verify_key, img } }` |
| 账号登录 | POST | `/login` | body: `{ user_name, user_password, verify_code, verify_key, lang }` |
| 平台登出 | - | - | 当前平台未提供公开登出接口；小程序仅清除本地 token/userInfo |

登录成功后，请求头使用 `Authorization: Bearer <token>`。平台返回 HTTP 200 时也可能携带业务 `code=402` 表示未授权，前端会清除本地登录态并跳转登录页。

### 3.2 设备查询

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 设备列表 | GET | `/device/list` | query: `{ product_name, lessee, username, imei, device_id, status, page_num, page_size }`；响应 `data.device`、`data.total` |
| 设备详情 | GET | `/device/info` | query: `{ device_id }`；响应 `data.info` |

设备状态以公司平台定义为准：

| status | 含义 |
|--------|------|
| 1 | 未激活 |
| 2 | 在线 |
| 3 | 离线 |

小程序只接入查询类设备接口，不包含添加设备、删除设备或修改平台数据的功能。

### 3.3 喷码打印

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 可喷印设备 | POST | `/inkjet_printer/k300_list` | 返回 `data.list`，用于喷码打印页设备选择 |
| 喷印记录 | POST | `/inkjet_printer/list` | body: `{ date_range:[start,end], page_num, page_size }`；返回 `data.list`、`data.total` |
| 开始喷印 | POST | `/inkjet_printer/start` | body: `{ dev_id, content }`；仅在用户主动点击“开始喷印”时调用 |

字段显示：记录时间使用 `created_at`，设备 ID 使用 `dev_id`，喷印内容使用 `content`。

**联调约束：** 自动化测试和开发验证不得调用 `/inkjet_printer/start`，避免对真实设备执行下发。

### 3.4 实时状态

公司平台当前未配置公开 WebSocket 地址，小程序 `wsUrl` 保持为空，页面通过重新进入或下拉刷新获取最新状态。
## 四、发布前自测清单

### 4.1 功能测试

- [ ] 登录正常，退出后本地 token/userInfo 已清理
- [ ] 设备列表加载、搜索、下拉刷新、上拉分页正常
- [ ] 设备详情字段和状态值显示正常
- [ ] 可喷印设备列表加载正常（不调用 start）
- [ ] 喷印记录日期筛选和分页正常
- [ ] 网络断开时有提示，恢复后可正常使用
- [ ] token 失效（HTTP 401 或业务 code 401/402）后跳转登录

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

### Q4: token 失效后接口返回 401/402
A: 平台无 refreshToken 机制。HTTP 401 或业务 code 401/402 时，前端会清理本地登录态并跳转登录页，重新登录即可

### Q5: 小程序包大小超过 2MB
A: 在 project.config.json 的 packOptions.ignore 中配置需忽略的文件；图片等资源可放在 CDN

---

## 七、版本记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-08-15 | 初始版本，支持设备管理、打印下发、历史记录 |
| 1.0.1 | 2026-09-24 | 对接公司平台真实设备/喷印接口，统一状态值并改为只读设备查询 |
