# -*- coding: utf-8 -*-
import json
P = r"C:\Users\Administrator\Desktop\ｗｅｎｍｏｋｅｊｉ\qa-results\miniprogram-qa\qa-run.json"
d = json.load(open(P, encoding="utf-8"))

# fix input.artifacts
d["input"]["artifacts"] = [
    {"id": "SRC-%03d" % i, "type": "source", "locator": s["path"],
     "access_status": "read", "completeness_checked": True,
     "item_count": 1, "reviewed_item_count": 1}
    for i, s in enumerate(d["input"]["sources"], 1)
]

# fix unverified
d["unverified"] = [
    {"id": "UNV-001", "area": "小程序 UI 交互（登录/列表/详情/打印/历史 6 页的真机点击、表单输入、跳转）",
     "reason": "无微信开发者工具与微信 App 真机环境", "impact": "前端按钮/表单/跳转/样式仅静态走查，未验证真实渲染与交互；不影响后端安全与契约结论"},
    {"id": "UNV-002", "area": "真实公司后端 8.134.177.27:8082 联调",
     "reason": "未授权访问生产/开发服务器", "impact": "字段契约一致性需联调确认（BUG-008）"},
    {"id": "UNV-003", "area": "真机兼容性（iOS/Android 多机型、微信版本）",
     "reason": "无真机", "impact": "样式/性能/API 兼容性未覆盖"},
    {"id": "UNV-004", "area": "微信平台审核合规（类目/隐私协议/内容）",
     "reason": "需提交审核", "impact": "BUG-020 为代码层结论，审核结果以微信为准"},
    {"id": "UNV-005", "area": "WebSocket 真实 wss 连接",
     "reason": "wsUrl 为空，无真实 WS 服务", "impact": "WS 重连/心跳/订阅逻辑仅静态审查"},
    {"id": "UNV-006", "area": "性能/并发/压测",
     "reason": "未做负载测试", "impact": "弱网/并发/消息风暴未验证"},
]

json.dump(d, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("patched")
