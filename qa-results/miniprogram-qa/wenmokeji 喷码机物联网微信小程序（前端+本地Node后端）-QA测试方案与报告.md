# 喷码机物联网微信小程序（wenmokeji）严格 QA 测试报告

| 项目 | 内容 |
|------|------|
| 测试对象 | wenmokeji 喷码机物联网微信小程序（前端 6 页 + 6 工具模块 + 本地 Express 后端） |
| AppID | wx8c5a2b95965410ba |
| 测试日期 | 2026-09-24 |
| 测试方法 | 静态代码逐文件审查 + 真实启动 node 后端用 curl 执行 24 组接口探针（L3 可复现证据） |
| 用例总数 | 29（通过 9 / 失败 18 / 阻塞 1 / 待确认 1） |
| 缺陷总数 | 20（P0 × 4 / P1 × 6 / P2 × 8 / P3 × 2） |
| **发布结论** | **NO GO（不可发布）** |

---

## 一、结论

**NO GO。** 当前代码存在 4 个 P0 阻断级问题，任一上线都会造成数据泄露、越权操作或业务事故；另有 6 个 P1 安全/契约问题必须在联调前修复。

最严重的三点：

1. **`/api/debug/db` 未做任何鉴权即可访问**（已 curl 复现）：任何人打开浏览器就能看到全部用户账号、客户名称、设备清单、绑定关系和打印历史。
2. **普通登录用户可把任意客户的设备绑定到自己名下**（已 curl 复现）：user002 一条请求就把 admin 的 DEV001 绑走，前端那道"管理员密码"校验在后端形同虚设。
3. **生产配置仍是 `dev` + `http://8.134.177.27:8082`**：HTTP + IP 地址，微信真机直接拒绝请求；prod 环境填的还是占位域名。

> 与 2026-08-18 旧报告相比，本轮新发现/升级 12 个问题（旧报告未覆盖后端）。旧报告中的 3 个 P0 已部分修复：硬编码密码已改为后端 verify-admin、登出已调用 /auth/logout、WS token 已改为首条消息传输——但同时引入了新的后端侧 P0。

---

## 二、需求口径与资料冲突

| 冲突点 | 现状 |
|--------|------|
| 前后端字段命名 | 前端发 `device_id / font_size / print_count / page_num / page_size`；本地后端期望 `deviceId / fontSize / count / page / pageSize`。deploy.md 3.2 节打印下发 body 又写 camelCase，自相矛盾 |
| refreshToken | auth.js 注释与 deploy.md 都写"平台无 refreshToken 机制"，但本地后端 `/auth/refresh` 已实现且前端从未调用 |
| 后端身份 | 前端 baseUrl 指向 `8.134.177.27:8082`（公司真实平台），仓库内 `backend/` 是参考实现，两者字段契约不一致——联调时必须先对齐 |
| 历史日期筛选 | history.js 传 `date` 参数，后端 `getHistoryByDevice` 完全没读这个字段 |

---

## 三、业务链路与范围

**核心链路**：登录（账号+密码+验证码）→ 首页统计/设备列表 → 设备详情 → 打印下发（内容/字号/次数/立即）→ 打印历史；管理员可添加/删除设备；WS 推送设备状态变更。

**本轮覆盖**：

- 前端：app.js 启动/版本更新/错误捕获、login/home/device/detail/print/history 6 页、auth/request/config/websocket/deviceMapper 5 个工具模块。
- 后端：Express app、JWT 中间件、auth 路由（login/refresh/logout/verify-admin）、device 路由（statistic/list/detail/add/delete/print-dispatch/history）、ws.js 鉴权心跳、store.js 内存数据。
- 真实执行：启动 `node app.js`，用 curl 跑了登录、越权、CORS、黑名单、refresh 旋转、参数边界、错误处理等 24 组探针。

**未覆盖（见第六节）**：微信开发者工具/真机 UI 交互、真实公司后端联调、wss 连接、机型兼容、性能压测、微信审核。

---

## 四、风险排序

| 优先级 | 数量 | 关键项 |
|--------|------|--------|
| **P0 阻断** | 4 | debug 数据泄露、跨租户绑定、生产配置错误、打印接口重复重试 |
| **P1 重要** | 6 | 硬编码密钥、CORS 全开、登录无速率限制、字段契约不一致、JWT 解码错字段、打印内容/次数无上限 |
| **P2 一般** | 8 | pageSize 无上限、404 误返 401、sourcemap 上传、wsUrl 为空、内存无持久化、历史筛选无效、debug 页 XSS、无隐私协议 |
| **P3 轻微** | 2 | malformed JSON 返回 500、打印按钮未防重入 |

---

## 五、执行结果复核

### 5.1 通过项（9 条，L3 curl 复现）

| 用例 | 结果 |
|------|------|
| 未带 token 访问受保护接口 | 401 拒绝 ✓ |
| 错误密码登录 | code:1 ✓ |
| 正确登录返回 JWT + refreshToken + expiresIn=7200 ✓ |
| 跨租户访问他人设备详情 | code:1 无权 ✓ |
| 离线设备拒绝打印 | code:1 ✓ |
| count=0 拒绝 | code:1 ✓ |
| 登出后 token 入黑名单，复用 401 ✓ |
| refreshToken 旋转后旧 rt 失效 ✓ |
| malformed JWT | 401 ✓ |

### 5.2 失败/阻塞项（19 条）

详见第六节缺陷清单。失败项中 18 条为 L3 curl 复现或 L2 代码坐实，1 条（内存持久化）为架构性观察。

---

## 六、已确认缺陷与解决方案

### 🔴 P0 阻断（必须修完才能上线）

**BUG-001 `/api/debug/db 未鉴权全量数据泄露**（S1）
- 位置：`backend/app.js` 第 27 行，路由注册在 `app.use('/api', authMiddleware)` **之前**。
- 复现：`curl http://host:3000/api/debug/db` → 200，返回全部用户、客户、设备、绑定关系、打印历史的 HTML。
- 修复：① 生产环境**直接删除**该路由；② 如需保留调试页，移到 `app.use('/api', authMiddleware)` 之后并加 `role==='admin'` 校验；③ 反向代理层对 `/api/debug/*` 做 IP 白名单。

**BUG-002 任意登录用户可绑定任意设备（越权）**（S1）
- 位置：`backend/routes/device.js` 第 50 行 `/add`。
- 复现：user002 登录后 `POST /api/device/add {deviceId:"DEV001"}`（DEV001 属 admin）→ `code:0 绑定成功`。
- 修复：`/add` 和 `/delete` 增加角色判断：
  ```js
  if (req.user.role !== 'admin') return res.status(403).json({code:1,message:'无权限'});
  ```
  前端的"管理员密码"弹窗只是 UX，不能作为唯一防线。

**BUG-003 生产配置仍为 dev + HTTP + IP**（S2）
- 位置：`utils/config.js` 第 66 行 `CURRENT_ENV='dev'`；dev.baseUrl = `http://8.134.177.27:8082/api/v1`；prod.baseUrl = 占位 `iot.your-domain.com`。
- 问题：微信真机强制 HTTPS + 已备案域名，HTTP/IP 直接请求失败；prod 未填真实域名。
- 修复：① `CURRENT_ENV='prod'`；② baseUrl 换成 `https://真实域名/api/v1`；③ 在微信公众平台配置 request/socket 合法域名；④ 上线前加 CI 检查阻止 dev 包上传。

**BUG-004 5xx/网络失败自动重试会重复打印**（S2）
- 位置：`utils/request.js` 第 104–110、134–139 行，对所有请求无差别重试。
- 问题：打印下发是写操作，若设备已喷印但响应超时，重试会再喷一次，造成重复喷码。
- 修复：重试只对 `GET/HEAD` 生效；POST/PUT/DELETE 不自动重试，由业务层决定是否幂等重试。

### 🟠 P1 重要

**BUG-005 敏感凭据硬编码**（S2）
- `backend/config.js`：`jwtSecret='wenmo-iot-secret-key-2024'`、`adminPassword='wenmo123'`；`store.js` 三个用户密码明文 `123456`。
- 修复：密钥改 `process.env.JWT_SECRET`；用户密码用 bcrypt 哈希；adminPassword 从环境变量读。

**BUG-006 CORS 完全开放**（S3）
- `app.use(cors())` 返回 `Access-Control-Allow-Origin: *`（curl OPTIONS 已验证）。
- 修复：`cors({ origin: ['https://你的小程序业务域名'], credentials: true })`。

**BUG-007 登录无速率限制/无锁定**（S3）
- 连续错密码无延迟无锁定。修复：加 `express-rate-limit`，5 次失败锁定 10 分钟。

**BUG-008 前后端字段契约不一致**（S2）
- 前端 `device_id/font_size/print_count/page_num/page_size` vs 后端 `deviceId/fontSize/count/page/pageSize`。
- 修复：以 deploy.md 为准统一一套命名，建议全用 snake_case；联调前用 Postman 走一遍全部接口。

**BUG-009 decodeUserInfo 读错 JWT 字段**（S3）
- `utils/auth.js` 第 203 行读 `payload.User`（大写 U），实际 JWT 无此字段，恒返回 null。
- 修复：按公司平台真实 JWT payload 字段名改映射（如 `payload.user_name`）。

**BUG-010 打印内容/次数无上限**（S3）
- curl 实测 `count=9999`、`content=5000 字` 均下发成功。
- 修复：`count` 限 1–99，`content` 限 500 字符，超限直接拒绝。

### 🟡 P2 一般

| ID | 问题 | 修复 |
|----|------|------|
| BUG-011 | `pageSize=10000` 不限制 | `Math.min(pageSize, 100)` |
| BUG-012 | 未知路由返回 401 而非 404 | 404 handler 前移，或中间件对未匹配路径放行 |
| BUG-013 | `uploadWithSourceMap:true` 上传 sourcemap | 发布前改 false |
| BUG-014 | 三环境 `wsUrl` 均为空串，WS 实时推送在生产不工作 | 配 `wss://` 地址，或明确砍掉该功能 |
| BUG-015 | 内存存储，重启丢全部数据 | 接 MySQL/Redis |
| BUG-016 | 历史页 `date` 参数后端未过滤 | `getHistoryByDevice` 按日期区间过滤 |
| BUG-017 | debug 页 HTML 未转义（叠加未鉴权 = 存储型 XSS） | 删除该页或 escape |
| BUG-020 | 无隐私政策/用户协议页面 | 补 privacy 页并在 app.json 注册 |

### 🟢 P3 轻微

| ID | 问题 | 修复 |
|----|------|------|
| BUG-018 | malformed JSON body 返回 500 而非 400 | error handler 透传 `err.status` |
| BUG-019 | print `onSubmit` 入口未判断 `submitting` | 首行加 `if (this.data.submitting) return` |

---

## 七、回归安排

修复后至少回归以下用例：

1. **BUG-001**：未登录访问 `/api/debug/db` 应 401/404。
2. **BUG-002**：普通用户 `/device/add` 他人设备应 403；admin 正常添加。
3. **BUG-003**：prod 环境下 `wx.request` 成功，无 `url not in domain list`。
4. **BUG-004**：mock 5xx 后打印接口不重试（GET 仍重试）。
5. **BUG-008**：全接口联调，字段一一对应。
6. **回归旧通过项**：登出黑名单、refreshToken 旋转、跨租户隔离不得回退。
7. 微信开发者工具中跑通核心链路：登录 → 列表 → 详情 → 打印 → 历史。

---

## 八、准出条件（全部满足才允许发布）

| # | 条件 | 对应缺陷 |
|---|------|----------|
| 1 | 删除或鉴权化 `/api/debug/db` | BUG-001 |
| 2 | `/device/add` `/device/delete` 服务端校验 role=admin | BUG-002 |
| 3 | `CURRENT_ENV=prod`、HTTPS 域名、微信合法域名已配 | BUG-003 |
| 4 | POST 写接口关闭自动重试 | BUG-004 |
| 5 | 密钥/密码迁出源码，密码哈希存储 | BUG-005 |
| 6 | CORS 白名单、登录加限流 | BUG-006/007 |
| 7 | 前后端字段契约对齐并联调通过 | BUG-008 |
| 8 | 真机（至少 iOS + Android 各一台）核心链路走通 | UNV-001/003 |
| 9 | 隐私协议页面/配置完成 | BUG-020 |

---

## 九、未覆盖范围（本轮未验证）

- 微信开发者工具/真机 UI 交互（登录点击、表单输入、页面跳转、样式）
- 公司真实后端 `8.134.177.27:8082` 联调
- 真机兼容性矩阵（iOS/Android 多机型、微信版本）
- WebSocket 真实 wss 连接、重连、心跳
- 性能/弱网/并发/压测
- 微信平台审核合规性（需提交审核）

---

*报告生成：2026-09-24 | 方法：静态审查 + curl 接口探针（L3） | 证据等级：L3_reproducible（后端接口）/ L2_observation（前端代码）*
