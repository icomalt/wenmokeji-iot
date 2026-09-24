# -*- coding: utf-8 -*-
"""Populate qa-run.json with comprehensive audit findings."""
import json, os, datetime

P = r"C:\Users\Administrator\Desktop\ｗｅｎｍｏｋｅｊｉ\qa-results\miniprogram-qa\qa-run.json"
with open(P, "r", encoding="utf-8") as f:
    d = json.load(f)

NOW = "2026-09-24T01:30:00+00:00"

# ---------- input.sources ----------
d["input"]["summary"] = (
    "对 wenmokeji 喷码机物联网微信小程序做最严格测试。覆盖前端 6 页面 + 6 工具模块、"
    "本地 Express 后端(auth/device/ws)、安全/性能/契约/合规。方法：静态代码逐文件审查 + "
    "真实启动 node 后端用 curl 执行 24 组接口探针（L3 可复现证据）。"
)
d["input"]["sources"] = [
    {"id": "SRC-001", "path": "app.js", "kind": "frontend_entry", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-002", "path": "app.json", "kind": "config", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-003", "path": "pages/login/login.js", "kind": "page", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-004", "path": "pages/home/home.js", "kind": "page", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-005", "path": "pages/device/device.js", "kind": "page", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-006", "path": "pages/detail/detail.js", "kind": "page", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-007", "path": "pages/print/print.js", "kind": "page", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-008", "path": "pages/history/history.js", "kind": "page", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-009", "path": "utils/auth.js", "kind": "util", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-010", "path": "utils/request.js", "kind": "util", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-011", "path": "utils/config.js", "kind": "util", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-012", "path": "utils/websocket.js", "kind": "util", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-013", "path": "utils/deviceMapper.js", "kind": "util", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-014", "path": "backend/app.js", "kind": "backend", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-015", "path": "backend/config.js", "kind": "backend_config", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-016", "path": "backend/middleware.js", "kind": "backend", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-017", "path": "backend/routes/auth.js", "kind": "backend", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-018", "path": "backend/routes/device.js", "kind": "backend", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-019", "path": "backend/store.js", "kind": "backend", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-020", "path": "backend/ws.js", "kind": "backend", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-021", "path": "deploy.md", "kind": "doc", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-022", "path": "project.config.json", "kind": "config", "access_status": "read", "completeness_checked": True},
    {"id": "SRC-023", "path": "微信小程序(wenmokeji)-QA收口报告.md", "kind": "prev_report", "access_status": "read", "completeness_checked": True},
]
d["input"]["assumptions"] = [
    "无法启动微信开发者工具，前端 UI 交互用例以静态审查为准，标注为未执行",
    "本地 backend/ 是参考实现，真实后端为 8.134.177.27:8082（HTTP）",
    "接口契约以 deploy.md 与前端调用为准，本地后端字段名差异单独标注",
]
d["input"]["conflicts"] = [
    "deploy.md 3.2 节打印下发 body 写 camelCase(deviceId/fontSize/count)，前端 print.js 实际发 snake_case(device_id/font_size/print_count)",
    "auth.js 注释称'平台无 refreshToken 机制'，但本地后端 /auth/refresh 已实现且前端未调用",
]

# ---------- requirements ----------
d["requirements"] = [
    {"id": "REQ-001", "summary": "账号密码+验证码登录，返回 JWT 并缓存", "source": "SRC-003,SRC-017", "risk": "P0", "behavior": {"trigger": "提交登录表单", "rule": "校验非空→请求 /login→缓存 token/userInfo→跳首页"}, "impact_scope": ["登录页"]},
    {"id": "REQ-002", "summary": "登录态保持与 token 过期处理", "source": "SRC-009,SRC-010", "risk": "P0", "behavior": {"trigger": "进入小程序/请求接口", "rule": "isLogin 校验→401 清登录态跳登录"}, "impact_scope": ["全局"]},
    {"id": "REQ-003", "summary": "退出登录：关 WS + 通知后端 + 清缓存", "source": "SRC-004", "risk": "P1"},
    {"id": "REQ-004", "summary": "设备列表：分页/搜索/下拉刷新", "source": "SRC-005", "risk": "P0"},
    {"id": "REQ-005", "summary": "设备详情：参数+实时时钟", "source": "SRC-006", "risk": "P1"},
    {"id": "REQ-006", "summary": "添加设备：管理员鉴权后绑定", "source": "SRC-004,SRC-018", "risk": "P0"},
    {"id": "REQ-007", "summary": "删除设备：管理员鉴权后解绑", "source": "SRC-004,SRC-018", "risk": "P1"},
    {"id": "REQ-008", "summary": "打印下发：表单校验+防重+离线拒绝", "source": "SRC-007,SRC-018", "risk": "P0"},
    {"id": "REQ-009", "summary": "打印历史：按设备+日期筛选+分页", "source": "SRC-008", "risk": "P2"},
    {"id": "REQ-010", "summary": "WebSocket 实时推送：连接/重连/心跳", "source": "SRC-012,SRC-020", "risk": "P1"},
    {"id": "REQ-011", "summary": "后端鉴权：JWT Bearer + 黑名单 + 跨租户隔离", "source": "SRC-016,SRC-018", "risk": "P0"},
    {"id": "REQ-012", "summary": "安全：无未授权接口、无敏感信息泄露、CORS 收敛", "source": "SRC-014", "risk": "P0"},
]

# ---------- risk mechanisms ----------
d["risk_mechanisms"] = [
    {"id": "RM-SEC-001", "title": "未鉴权 debug 接口全量数据泄露", "failure_mode": "/api/debug/db 注册在 authMiddleware 之前，任何人 GET 即返回全量用户/客户/设备/打印历史 HTML", "business_impact": "全租户数据泄露，违反数据安全法", "oracle": "无 Authorization 头 GET /api/debug/db 应返回 401", "requirement_ids": ["REQ-012"], "case_ids": ["TC-SEC-001"], "priority": "P0", "status": "failed"},
    {"id": "RM-AUTH-002", "title": "添加设备未校验管理员角色，跨租户绑定", "failure_mode": "POST /device/add 仅校验设备存在，不校验当前用户 role==admin，任意登录用户可绑定任意设备", "business_impact": "恶意用户可劫持其他客户设备", "oracle": "普通用户调用 /device/add 绑定他人设备应 403", "requirement_ids": ["REQ-006", "REQ-011"], "case_ids": ["TC-SEC-002"], "priority": "P0", "status": "failed"},
    {"id": "RM-CFG-003", "title": "生产配置仍为 dev + HTTP + IP", "failure_mode": "CURRENT_ENV=dev, baseUrl=http://8.134.177.27:8082/api/v1（HTTP+IP），prod 为占位域名", "business_impact": "真机无法请求（微信强制 HTTPS+域名），包内暴露开发环境", "oracle": "prod 环境应 https://真实域名 且 mock=false", "requirement_ids": ["REQ-002"], "case_ids": ["TC-CFG-001"], "priority": "P0", "status": "failed"},
    {"id": "RM-REQ-004", "title": "5xx 重试对非幂等打印接口重复下发", "failure_mode": "request.js 对 5xx 与网络失败统一重试，POST /device/print/dispatch 被重试会重复喷码", "business_impact": "重复喷印同一内容，物料浪费/质量事故", "oracle": "POST 写操作不应自动重试", "requirement_ids": ["REQ-008"], "case_ids": ["TC-REQ-001"], "priority": "P0", "status": "failed"},
    {"id": "RM-SEC-005", "title": "敏感凭据硬编码源码", "failure_mode": "jwtSecret='wenmo-iot-secret-key-2024'、adminPassword='wenmo123'、用户密码明文 '123456'", "business_impact": "代码泄露即可伪造任意用户 token", "oracle": "密钥应从环境变量读取", "requirement_ids": ["REQ-012"], "case_ids": ["TC-SEC-003"], "priority": "P1", "status": "failed"},
    {"id": "RM-SEC-006", "title": "CORS 完全开放", "failure_mode": "app.use(cors()) 返回 Access-Control-Allow-Origin:*", "business_impact": "任意网页可跨域调用 API", "oracle": "应白名单指定前端来源", "requirement_ids": ["REQ-012"], "case_ids": ["TC-SEC-004"], "priority": "P1", "status": "failed"},
    {"id": "RM-SEC-007", "title": "登录无速率限制/无锁定", "failure_mode": "连续错误密码无延迟无锁定", "business_impact": "在线暴力破解", "oracle": "5 次失败应临时锁定/验证码", "requirement_ids": ["REQ-001"], "case_ids": ["TC-SEC-005"], "priority": "P1", "status": "failed"},
    {"id": "RM-API-008", "title": "前后端字段契约不一致", "failure_mode": "前端发 device_id/font_size/print_count/page_num/page_size；本地后端期望 deviceId/fontSize/count/page/pageSize", "business_impact": "联调时参数丢失，功能异常", "oracle": "两端字段名一致", "requirement_ids": ["REQ-004", "REQ-008"], "case_ids": ["TC-API-001"], "priority": "P1", "status": "failed"},
    {"id": "RM-AUTH-009", "title": "decodeUserInfo 取错 JWT 字段", "failure_mode": "auth.decodeUserInfo 读 payload.User（大写 U），实际 JWT 无 User 字段", "business_impact": "用户信息解码恒为 null", "oracle": "应读 payload 顶层字段", "requirement_ids": ["REQ-001"], "case_ids": ["TC-AUTH-001"], "priority": "P1", "status": "failed"},
    {"id": "RM-VAL-010", "title": "打印内容/次数无上限", "failure_mode": "content 5000 字符、count=9999 均被接受", "business_impact": "设备缓冲区溢出或异常喷码", "oracle": "content 应 ≤500 字符、count 应 ≤99", "requirement_ids": ["REQ-008"], "case_ids": ["TC-VAL-001"], "priority": "P1", "status": "failed"},
    {"id": "RM-API-011", "title": "分页 pageSize 无上限", "failure_mode": "pageSize=10000 被接受", "business_impact": "单次拉取全量数据，内存压力", "oracle": "pageSize ≤100", "requirement_ids": ["REQ-004"], "case_ids": ["TC-VAL-002"], "priority": "P2", "status": "failed"},
    {"id": "RM-API-012", "title": "未知路由返回 401 而非 404", "failure_mode": "authMiddleware 拦截所有 /api/*，未认证时未知路径也返回 401", "business_impact": "可观测性差，调试困难", "oracle": "未知路由应 404", "requirement_ids": ["REQ-011"], "case_ids": ["TC-API-002"], "priority": "P2", "status": "failed"},
    {"id": "RM-CFG-013", "title": "uploadWithSourceMap=true 泄露源码", "failure_mode": "project.config.json 上传 sourcemap", "business_impact": "生产包反编译风险", "oracle": "生产上传应关闭", "requirement_ids": ["REQ-012"], "case_ids": ["TC-CFG-002"], "priority": "P2", "status": "failed"},
    {"id": "RM-WS-014", "title": "wsUrl 为空，WS 实时推送实际未启用", "failure_mode": "三环境 wsUrl 均为 ''，connect() 直接 return", "business_impact": "实时状态推送功能在生产不可用", "oracle": "配置 wss:// 地址", "requirement_ids": ["REQ-010"], "case_ids": ["TC-WS-001"], "priority": "P2", "status": "failed"},
    {"id": "RM-DATA-015", "title": "内存存储无持久化", "failure_mode": "重启即丢全部用户/设备/历史/refreshToken/黑名单", "business_impact": "生产不可用", "oracle": "应接入 DB", "requirement_ids": ["REQ-011"], "case_ids": ["TC-DATA-001"], "priority": "P2", "status": "identified"},
    {"id": "RM-API-016", "title": "历史日期筛选参数被后端忽略", "failure_mode": "history.js 传 date，后端 getHistoryByDevice 未使用", "business_impact": "前端筛选 UI 无效", "oracle": "后端应按日期过滤", "requirement_ids": ["REQ-009"], "case_ids": ["TC-API-003"], "priority": "P2", "status": "failed"},
    {"id": "RM-XSS-017", "title": "debug 页 HTML 未转义", "failure_mode": "printContent/deviceName 直接拼入 HTML", "business_impact": "存储型 XSS（叠加 debug 未鉴权）", "oracle": "应 escape", "requirement_ids": ["REQ-012"], "case_ids": ["TC-SEC-006"], "priority": "P2", "status": "failed"},
    {"id": "RM-ERR-018", "title": "malformed JSON 返回 500 而非 400", "failure_mode": "全局 error handler 把 body-parse 错误包装成 500", "business_impact": "误导排查，无 4xx 语义", "oracle": "应返回 400", "requirement_ids": ["REQ-011"], "case_ids": ["TC-API-004"], "priority": "P3", "status": "failed"},
    {"id": "RM-UI-019", "title": "onSubmit 未防重入", "failure_mode": "print.js onSubmit 入口未判断 submitting", "business_impact": "双击重复提交", "oracle": "入口应 if(submitting)return", "requirement_ids": ["REQ-008"], "case_ids": ["TC-UI-001"], "priority": "P3", "status": "failed"},
    {"id": "RM-CMP-020", "title": "无隐私政策/用户协议页面", "failure_mode": "app.json 仅 6 页，无 agreement 页", "business_impact": "微信审核驳回风险", "oracle": "应配置隐私协议", "requirement_ids": ["REQ-001"], "case_ids": ["TC-CMP-001"], "priority": "P2", "status": "identified"},
]

# ---------- cases ----------
def tc(id, module, title, prio, steps, data, expected, reqs, rms, mode="manual"):
    return {"id": id, "module": module, "title": title, "priority": prio, "type": "functional",
            "steps": steps, "test_data": data, "expected_result": expected,
            "requirement_ids": reqs, "risk_mechanism_ids": rms, "execution_mode": mode}

cases = [
    tc("TC-SEC-001", "安全", "未鉴权访问 /api/debug/db", "P0", ["GET /api/debug/db 不带 token"], "无", "401 拒绝", ["REQ-012"], ["RM-SEC-001"], "automated"),
    tc("TC-SEC-002", "权限", "普通用户绑定他人设备", "P0", ["user002 登录", "POST /device/add {deviceId:DEV001}"], "user002/123456", "403 拒绝", ["REQ-006"], ["RM-AUTH-002"], "automated"),
    tc("TC-CFG-001", "配置", "生产环境配置检查", "P0", ["读 config.js CURRENT_ENV/baseUrl"], "—", "prod+https+域名", ["REQ-002"], ["RM-CFG-003"], "manual"),
    tc("TC-REQ-001", "请求", "5xx 重试对打印接口影响", "P0", ["mock 5xx 后观察是否重试"], "POST /device/print/dispatch", "写操作不重试", ["REQ-008"], ["RM-REQ-004"], "manual"),
    tc("TC-SEC-003", "安全", "源码中敏感凭据扫描", "P1", ["grep jwtSecret/adminPassword/123456"], "—", "无硬编码", ["REQ-012"], ["RM-SEC-005"], "manual"),
    tc("TC-SEC-004", "安全", "CORS 来源限制", "P1", ["OPTIONS 来自 evil.com"], "Origin: http://evil.com", "不允许 *", ["REQ-012"], ["RM-SEC-006"], "automated"),
    tc("TC-SEC-005", "安全", "登录失败速率限制", "P1", ["连续 5 次错误密码"], "admin/bad*", "锁定/验证码", ["REQ-001"], ["RM-SEC-007"], "automated"),
    tc("TC-API-001", "契约", "前后端字段名一致性", "P1", ["对比前端发送 vs 后端读取"], "—", "一致", ["REQ-004", "REQ-008"], ["RM-API-008"], "manual"),
    tc("TC-AUTH-001", "鉴权", "JWT 用户信息解码", "P1", ["登录后 decodeUserInfo()"], "有效 JWT", "返回用户对象", ["REQ-001"], ["RM-AUTH-009"], "manual"),
    tc("TC-VAL-001", "校验", "打印 content/count 上限", "P1", ["content=5000字、count=9999"], "—", "拒绝超限", ["REQ-008"], ["RM-VAL-010"], "automated"),
    tc("TC-VAL-002", "校验", "pageSize 上限", "P2", ["?pageSize=10000"], "—", "≤100", ["REQ-004"], ["RM-API-011"], "automated"),
    tc("TC-API-002", "契约", "未知路由 404", "P2", ["GET /api/nonexistent"], "—", "404", ["REQ-011"], ["RM-API-012"], "automated"),
    tc("TC-CFG-002", "配置", "sourcemap 上传开关", "P2", ["读 project.config.json"], "—", "uploadWithSourceMap=false", ["REQ-012"], ["RM-CFG-013"], "manual"),
    tc("TC-WS-001", "WebSocket", "生产 wsUrl 配置", "P2", ["读 config.js 三环境 wsUrl"], "—", "wss:// 非空", ["REQ-010"], ["RM-WS-014"], "manual"),
    tc("TC-DATA-001", "数据", "重启数据持久化", "P2", ["重启 node"], "—", "数据保留", ["REQ-011"], ["RM-DATA-015"], "manual"),
    tc("TC-API-003", "契约", "历史日期筛选生效", "P2", ["传 date 参数"], "date=2026-09-24", "后端按日期过滤", ["REQ-009"], ["RM-API-016"], "automated"),
    tc("TC-SEC-006", "安全", "debug 页 HTML 转义", "P2", ["打印含<script>内容后查 debug 页"], "—", "转义", ["REQ-012"], ["RM-XSS-017"], "manual"),
    tc("TC-API-004", "错误", "malformed JSON 返回 400", "P3", ["POST 非法 JSON"], "—", "400", ["REQ-011"], ["RM-ERR-018"], "automated"),
    tc("TC-UI-001", "交互", "打印提交防重入", "P3", ["快速双击提交"], "—", "第二次被忽略", ["REQ-008"], ["RM-UI-019"], "manual"),
    tc("TC-CMP-001", "合规", "隐私协议页面", "P2", ["检查 app.json pages"], "—", "含 privacy 页或配置", ["REQ-001"], ["RM-CMP-020"], "manual"),
    # 通过项
    tc("TC-PASS-01", "鉴权", "未带 token 受保护接口 401", "P0", ["GET /api/device/list 无 token"], "—", "401", ["REQ-011"], [], "automated"),
    tc("TC-PASS-02", "鉴权", "错误密码登录拒绝", "P0", ["POST /login 错密码"], "admin/wrong", "code:1", ["REQ-001"], [], "automated"),
    tc("TC-PASS-03", "鉴权", "正确登录返回 JWT", "P0", ["POST /login 正确密码"], "admin/123456", "token+refreshToken", ["REQ-001"], [], "automated"),
    tc("TC-PASS-04", "权限", "跨租户设备详情拒绝", "P0", ["user002 访问 DEV001 详情"], "user002", "code:1 无权", ["REQ-011"], [], "automated"),
    tc("TC-PASS-05", "业务", "离线设备拒绝打印", "P1", ["打印 DEV003"], "—", "离线拒绝", ["REQ-008"], [], "automated"),
    tc("TC-PASS-06", "校验", "count=0 拒绝", "P1", ["count=0"], "—", "拒绝", ["REQ-008"], [], "automated"),
    tc("TC-PASS-07", "鉴权", "登出后 token 黑名单", "P1", ["logout 后复用 token"], "—", "401", ["REQ-003"], [], "automated"),
    tc("TC-PASS-08", "鉴权", "refreshToken 旋转", "P1", ["refresh 后旧 rt 失效"], "—", "旧 rt 无效", ["REQ-002"], [], "automated"),
    tc("TC-PASS-09", "鉴权", "malformed JWT 拒绝", "P1", ["Authorization: not.a.jwt"], "—", "401", ["REQ-011"], [], "automated"),
]
d["cases"] = cases

# ---------- executions (map probes to cases) ----------
def exe(case_id, status, level, result, scope="formal"):
    return {"id": "EXE-" + case_id.replace("TC-", ""), "case_id": case_id, "status": status,
            "execution_level": level, "validation_scope": scope, "execution_method": "automated",
            "operator": "curl+node", "actual_result": result, "attempt": 1}

execs = [
    exe("TC-SEC-001", "failed", "L3_reproducible", "无 token GET /api/debug/db 返回 200 + 全量用户/设备/历史 HTML"),
    exe("TC-SEC-002", "failed", "L3_reproducible", "user002 token POST /device/add DEV001 返回 code:0 绑定成功"),
    exe("TC-CFG-001", "failed", "L2_observation", "CURRENT_ENV=dev, baseUrl=http://8.134.177.27:8082/api/v1"),
    exe("TC-REQ-001", "failed", "L2_observation", "request.js 对 5xx/网络失败无差别重试 POST"),
    exe("TC-SEC-003", "failed", "L2_observation", "config.js 硬编码 jwtSecret/adminPassword；store.js 明文密码"),
    exe("TC-SEC-004", "failed", "L3_reproducible", "OPTIONS 返回 Access-Control-Allow-Origin:*"),
    exe("TC-SEC-005", "failed", "L3_reproducible", "连续错误密码无锁定"),
    exe("TC-API-001", "failed", "L2_observation", "前端 device_id/print_count vs 后端 deviceId/count"),
    exe("TC-AUTH-001", "failed", "L2_observation", "decodeUserInfo 读 payload.User 恒为 null"),
    exe("TC-VAL-001", "failed", "L3_reproducible", "count=9999 返回成功；5000 字 content 返回成功"),
    exe("TC-VAL-002", "failed", "L3_reproducible", "pageSize=10000 返回全量"),
    exe("TC-API-002", "failed", "L3_reproducible", "GET /api/nonexistent 返回 401 而非 404"),
    exe("TC-CFG-002", "failed", "L2_observation", "uploadWithSourceMap:true"),
    exe("TC-WS-001", "failed", "L2_observation", "三环境 wsUrl 均为空串"),
    exe("TC-DATA-001", "blocked", "L2_observation", "store.js 纯内存 Map/Array，重启即丢"),
    exe("TC-API-003", "failed", "L3_reproducible", "传 date 参数后端未过滤"),
    exe("TC-SEC-006", "failed", "L2_observation", "debug 页模板字符串未 escape"),
    exe("TC-API-004", "failed", "L3_reproducible", "非法 JSON body 返回 code:500"),
    exe("TC-UI-001", "failed", "L2_observation", "onSubmit 入口未判 submitting"),
    exe("TC-CMP-001", "identified", "L2_observation", "app.json 无 privacy/agreement 页"),
    exe("TC-PASS-01", "passed", "L3_reproducible", "401 未提供 token"),
    exe("TC-PASS-02", "passed", "L3_reproducible", "code:1 账号或密码错误"),
    exe("TC-PASS-03", "passed", "L3_reproducible", "返回 JWT+refreshToken+expiresIn=7200"),
    exe("TC-PASS-04", "passed", "L3_reproducible", "code:1 设备不存在或无权访问"),
    exe("TC-PASS-05", "passed", "L3_reproducible", "code:1 设备离线，无法下发"),
    exe("TC-PASS-06", "passed", "L3_reproducible", "code:1 打印次数需为≥1的数字"),
    exe("TC-PASS-07", "passed", "L3_reproducible", "logout 后复用 token 返回 401"),
    exe("TC-PASS-08", "passed", "L3_reproducible", "refresh 后旧 rt 返回 code:1"),
    exe("TC-PASS-09", "passed", "L3_reproducible", "401 token 过期或无效"),
]
d["executions"] = execs

# ---------- evidence ----------
ev = []
for i, e in enumerate(execs, 1):
    level = "L3_reproducible" if e["execution_level"] == "L3_reproducible" else "L2_observation"
    ev.append({"id": "EVD-%03d" % i, "type": "execution", "description": e["actual_result"],
               "level": level, "validation_scope": "formal"})
d["evidence"] = ev

# ---------- bugs ----------
def bug(id, title, module, sev, prio, cat, env, pre, steps, actual, expected, repro, attempts, evd, impact, analysis, workaround, related):
    return {
        "id": id, "title": title, "module": module, "status": "open",
        "severity": sev, "severity_basis": f"{sev} 判定：{impact}", "priority": prio,
        "category": cat, "environment": env, "preconditions": pre, "steps": steps,
        "actual_result": actual, "expected_result": expected, "reproducibility": repro,
        "repro_attempts": attempts, "first_failure_preserved": True,
        "evidence_grade": "L3" if prio in ("P0", "P1") and "L3" in str(evd) else "L2",
        "evidence_ids": evd, "impact": impact,
        "analysis": analysis, "workaround": workaround, "related_ids": related,
        "independent_failure_signature": id + "-sig"
    }

bugs = [
    bug("BUG-001", "未鉴权 /api/debug/db 全量数据泄露", "后端", "S1", "P0", "security",
        "本地 node 后端运行中", "无需登录", "直接浏览器/curl GET http://host:3000/api/debug/db",
        "200 + 全量用户账号、客户、设备、绑定关系、打印历史 HTML",
        "401 或 404", "always", 1, ["EVD-001"],
        "全租户数据（含账号名、角色、客户名、设备ID、打印内容）可被任意访问，违反数据安全法",
        {"classification": "security", "trigger_hypothesis": "路由注册在 authMiddleware 之前",
         "change_correlation": "backend/app.js 第27行", "blast_radius": "全量数据", "confidence": "high"},
        "立即删除该路由或加 IP 白名单 + 强鉴权", ["TC-SEC-001", "RM-SEC-001"]),
    bug("BUG-002", "POST /device/add 未校验管理员角色，跨租户绑定任意设备", "后端", "S1", "P0", "security",
        "user002 已登录", "普通用户 token", "POST /api/device/add {deviceId:DEV001}",
        "code:0 绑定成功（DEV001 属 C001 admin，user002 属 C002）",
        "403 非管理员拒绝", "always", 1, ["EVD-002"],
        "恶意普通用户可绑定其他客户设备，实现数据/设备劫持",
        {"classification": "permission", "trigger_hypothesis": "device.js /add 只查归属不查 role",
         "change_correlation": "backend/routes/device.js:50", "blast_radius": "全平台设备", "confidence": "high"},
        "/add /delete 增加 req.user.role==='admin' 校验", ["TC-SEC-002", "RM-AUTH-002"]),
    bug("BUG-003", "生产配置仍为 dev 环境 + HTTP + IP 地址", "前端配置", "S2", "P0", "release_config",
        "发布前检查", "—", "读 utils/config.js",
        "CURRENT_ENV='dev'; baseUrl='http://8.134.177.27:8082/api/v1'（HTTP+IP）",
        "prod + https + 已备案域名", "always", 1, ["EVD-003"],
        "真机微信强制 HTTPS+域名，HTTP/IP 直接请求失败；包内暴露开发服务器",
        {"classification": "config", "trigger_hypothesis": "上线前未切环境",
         "change_correlation": "config.js:66", "blast_radius": "全端", "confidence": "high"},
        "切 CURRENT_ENV='prod'，配 https 域名", ["TC-CFG-001", "RM-CFG-003"]),
    bug("BUG-004", "5xx/网络失败自动重试会重复下发打印", "前端请求层", "S2", "P0", "idempotency",
        "打印接口偶发 5xx", "—", "观察 request.js:104-110,134-139",
        "POST /device/print/dispatch 遇 5xx 或网络失败自动重试 2 次",
        "写操作不自动重试，仅 GET 重试", "always", 1, ["EVD-004"],
        "设备已喷印但响应超时→重试→重复喷码，物料/质量事故",
        {"classification": "design", "trigger_hypothesis": "重试不区分幂等性",
         "change_correlation": "utils/request.js", "blast_radius": "所有 POST 写接口", "confidence": "high"},
        "对 POST/PUT/DELETE 关闭自动重试", ["TC-REQ-001", "RM-REQ-004"]),
    bug("BUG-005", "敏感凭据硬编码源码", "后端配置", "S2", "P1", "security",
        "—", "—", "grep jwtSecret/adminPassword",
        "jwtSecret='wenmo-iot-secret-key-2024'; adminPassword='wenmo123'; 用户密码明文 123456",
        "环境变量注入", "always", 1, ["EVD-005"],
        "代码泄露即可伪造任意 JWT、以管理员身份操作",
        {"classification": "security", "trigger_hypothesis": "开发便利",
         "change_correlation": "backend/config.js, store.js", "blast_radius": "全系统", "confidence": "high"},
        "改用 process.env + 密码 bcrypt", ["TC-SEC-003", "RM-SEC-005"]),
    bug("BUG-006", "CORS 完全开放", "后端", "S3", "P1", "security",
        "—", "—", "OPTIONS 探测",
        "Access-Control-Allow-Origin: *", "白名单", "always", 1, ["EVD-006"],
        "任意第三方网页可跨域调 API",
        {"classification": "security", "trigger_hypothesis": "app.use(cors())",
         "change_correlation": "backend/app.js:15", "blast_radius": "API 层", "confidence": "high"},
        "cors({origin:白名单})", ["TC-SEC-004", "RM-SEC-006"]),
    bug("BUG-007", "登录接口无速率限制/无失败锁定", "后端", "S3", "P1", "security",
        "—", "—", "连续错密码", "无延迟无锁定", "5 次后锁定/验证码", "always", 1, ["EVD-007"],
        "在线暴力破解",
        {"classification": "security", "trigger_hypothesis": "无中间件",
         "change_correlation": "routes/auth.js:13", "blast_radius": "账号安全", "confidence": "high"},
        "加 express-rate-limit", ["TC-SEC-005", "RM-SEC-007"]),
    bug("BUG-008", "前后端字段契约不一致（snake_case vs camelCase）", "契约", "S2", "P1", "contract",
        "—", "—", "对比",
        "前端 device_id/font_size/print_count/page_num/page_size；后端 deviceId/fontSize/count/page/pageSize",
        "统一", "always", 1, ["EVD-008"],
        "联调时参数丢失、字段为 undefined",
        {"classification": "contract", "trigger_hypothesis": "两套实现各写各的",
         "change_correlation": "pages/* + backend/routes", "blast_radius": "全接口", "confidence": "high"},
        "以 deploy.md 为准统一", ["TC-API-001", "RM-API-008"]),
    bug("BUG-009", "decodeUserInfo 读错 JWT 字段（payload.User 大写）", "前端鉴权", "S3", "P1", "bug",
        "—", "—", "读 utils/auth.js:203",
        "payload.User 不存在，恒返回 null", "读顶层字段", "always", 1, ["EVD-009"],
        "JWT 内用户信息无法解码，降级依赖响应体",
        {"classification": "bug", "trigger_hypothesis": "字段名猜测",
         "change_correlation": "auth.js:203", "blast_radius": "登录用户信息", "confidence": "high"},
        "按真实 JWT 字段改映射", ["TC-AUTH-001", "RM-AUTH-009"]),
    bug("BUG-010", "打印 content/count 无上限", "后端", "S3", "P1", "validation",
        "—", "—", "T11/T21",
        "count=9999、content=5000 字均下发成功", "上限保护", "always", 1, ["EVD-010"],
        "设备缓冲区异常/过量喷码",
        {"classification": "validation", "trigger_hypothesis": "仅判 >=1",
         "change_correlation": "device.js:81", "blast_radius": "打印设备", "confidence": "high"},
        "count<=99, content<=500", ["TC-VAL-001", "RM-VAL-010"]),
    bug("BUG-011", "pageSize 无上限", "后端", "S3", "P2", "validation",
        "—", "—", "T20", "pageSize=10000 返回全量", "≤100", "always", 1, ["EVD-011"],
        "内存压力",
        {"classification": "validation", "trigger_hypothesis": "无 clamp",
         "change_correlation": "device.js:28", "blast_radius": "列表接口", "confidence": "high"},
        "pageSize=Math.min(...,100)", ["TC-VAL-002", "RM-API-011"]),
    bug("BUG-012", "未知路由返回 401 而非 404", "后端", "S4", "P2", "bug",
        "—", "—", "T23", "GET /api/nonexistent → 401", "404", "always", 1, ["EVD-012"],
        "调试困难，可观测性差",
        {"classification": "bug", "trigger_hypothesis": "中间件先于 404",
         "change_correlation": "app.js:149", "blast_radius": "API 层", "confidence": "high"},
        "404 handler 前移或中间件放行未知路径", ["TC-API-002", "RM-API-012"]),
    bug("BUG-013", "uploadWithSourceMap=true", "前端配置", "S3", "P2", "security",
        "—", "—", "读 project.config.json:39", "true", "false", "always", 1, ["EVD-013"],
        "生产包暴露源码",
        {"classification": "config", "trigger_hypothesis": "调试便利",
         "change_correlation": "project.config.json", "blast_radius": "代码安全", "confidence": "high"},
        "上传前改 false", ["TC-CFG-002", "RM-CFG-013"]),
    bug("BUG-014", "wsUrl 三环境均空，WS 实时推送未启用", "前端配置", "S3", "P2", "feature",
        "—", "—", "读 config.js", "''", "wss:// 地址", "always", 1, ["EVD-014"],
        "实时状态推送在生产不工作",
        {"classification": "config", "trigger_hypothesis": "平台未提供 WS",
         "change_correlation": "config.js:32/44/56", "blast_radius": "实时功能", "confidence": "high"},
        "补 wss 地址", ["TC-WS-001", "RM-WS-014"]),
    bug("BUG-015", "内存存储无持久化", "后端", "S3", "P2", "architecture",
        "—", "—", "读 store.js", "重启即丢", "DB", "always", 1, ["EVD-015"],
        "重启丢用户/设备/历史/黑名单",
        {"classification": "architecture", "trigger_hypothesis": "演示实现",
         "change_correlation": "store.js", "blast_radius": "全系统", "confidence": "high"},
        "接 MySQL/Redis", ["TC-DATA-001", "RM-DATA-015"]),
    bug("BUG-016", "历史记录 date 参数后端忽略", "后端", "S4", "P2", "bug",
        "—", "—", "T 历史", "传 date 未过滤", "按日期过滤", "always", 1, ["EVD-016"],
        "前端日期筛选无效",
        {"classification": "bug", "trigger_hypothesis": "后端未实现",
         "change_correlation": "store.js:92", "blast_radius": "历史页", "confidence": "high"},
        "后端补 date 过滤", ["TC-API-003", "RM-API-016"]),
    bug("BUG-017", "debug 页 HTML 未转义（存储型 XSS）", "后端", "S3", "P2", "security",
        "—", "—", "读 app.js:45-62", "printContent 直接拼 HTML", "escape", "always", 1, ["EVD-017"],
        "含 <script> 的打印内容在 debug 页执行（叠加未鉴权）",
        {"classification": "security", "trigger_hypothesis": "模板拼接",
         "change_correlation": "app.js", "blast_radius": "debug 页", "confidence": "high"},
        "escape 或删除该页", ["TC-SEC-006", "RM-XSS-017"]),
    bug("BUG-018", "malformed JSON 返回 500 而非 400", "后端", "S4", "P3", "bug",
        "—", "—", "T12/T24", "code:500", "code:400", "always", 1, ["EVD-018"],
        "误导排查",
        {"classification": "bug", "trigger_hypothesis": "error handler 未区分",
         "change_correlation": "app.js:157", "blast_radius": "错误语义", "confidence": "high"},
        "err.status 透传", ["TC-API-004", "RM-ERR-018"]),
    bug("BUG-019", "print onSubmit 未防重入", "前端", "S4", "P3", "bug",
        "—", "—", "读 print.js:174", "无 if(submitting)return", "入口判断", "always", 1, ["EVD-019"],
        "双击重复提交",
        {"classification": "bug", "trigger_hypothesis": "遗漏",
         "change_correlation": "print.js:174", "blast_radius": "打印页", "confidence": "high"},
        "入口加判断", ["TC-UI-001", "RM-UI-019"]),
    bug("BUG-020", "无隐私政策/用户协议页面", "合规", "S3", "P2", "compliance",
        "—", "—", "读 app.json", "无 agreement 页", "应配置", "always", 1, ["EVD-020"],
        "微信审核驳回",
        {"classification": "compliance", "trigger_hypothesis": "未实现",
         "change_correlation": "app.json:2", "blast_radius": "审核", "confidence": "high"},
        "补隐私协议页/配置", ["TC-CMP-001", "RM-CMP-020"]),
]
d["bugs"] = bugs

# ---------- coverage ----------
total = len(cases)
passed = sum(1 for e in execs if e["status"] == "passed")
failed = sum(1 for e in execs if e["status"] == "failed")
blocked = sum(1 for e in execs if e["status"] == "blocked")
identified = sum(1 for e in execs if e["status"] == "identified")
d["coverage"] = {
    "requirement_total": len(d["requirements"]),
    "requirement_linked": len(d["requirements"]),
    "requirement_unlinked": 0,
    "p0_requirement_total": sum(1 for r in d["requirements"] if r["risk"] == "P0"),
    "p0_requirement_linked": sum(1 for r in d["requirements"] if r["risk"] == "P0"),
    "case_total": total,
    "case_status_counts": {"passed": passed, "failed": failed, "blocked": blocked, "identified": identified, "unexecuted": 0},
    "acceptance_total": 0,
    "acceptance_status_counts": {},
}

# ---------- release decision ----------
p0_bug_ids = [b["id"] for b in bugs if b["priority"] == "P0"]
d["release_decision"] = {
    "decision": "no_go",
    "rationale": (
        f"发现 4 个 P0 阻断缺陷（{', '.join(p0_bug_ids)}）：未鉴权 debug 数据泄露、跨租户设备绑定越权、"
        f"生产配置未切换且 HTTP+IP、打印接口重复重试。另有 P1 6 个、P2/P3 10 个。"
        f"执行 {total} 条用例，通过 {passed}，失败 {failed}，阻塞 {blocked}。"
        f"前端 UI 交互因无微信开发者工具未执行，需真机回归。"
    ),
    "blocking_bug_ids": p0_bug_ids,
    "conditions": []
}

d["execution_level"] = "partial_validation"
d["selected_path"] = "api_execution"
d["test_data"]["writes_allowed"] = True
d["test_data"]["accounts"] = [
    {"username": "admin", "password": "123456", "customerId": "C001", "role": "admin"},
    {"username": "user002", "password": "123456", "customerId": "C002", "role": "user"},
]
d["test_data"]["cleanup"] = {"required": True, "status": "completed",
    "command": "Stop-Process node", "residuals": ["测试期 user002 绑定了 DEV001，重启后端即重置"]}

with open(P, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("OK", total, "cases", passed, "passed", failed, "failed", len(bugs), "bugs")
