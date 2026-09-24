# -*- coding: utf-8 -*-
import json
P = r"C:\Users\Administrator\Desktop\ｗｅｎｍｏｋｅｊｉ\qa-results\miniprogram-regression\qa-run.json"
d = json.load(open(P, encoding="utf-8"))
d["risk_mechanisms"] = [
    {"id": "RM-SEC-001", "title": "debug 数据泄露", "failure_mode": "未鉴权访问", "business_impact": "数据泄露", "oracle": "404/401", "requirement_ids": ["REQ-005"], "case_ids": ["TC-02"], "priority": "P0", "status": "verified"},
    {"id": "RM-AUTH-002", "title": "跨租户越权", "failure_mode": "普通用户 add 他人设备", "business_impact": "设备劫持", "oracle": "403", "requirement_ids": ["REQ-003"], "case_ids": ["TC-03"], "priority": "P0", "status": "verified"},
    {"id": "RM-VAL-003", "title": "打印参数无上限", "failure_mode": "count/content 过大", "business_impact": "设备异常", "oracle": "拒绝超限", "requirement_ids": ["REQ-004"], "case_ids": ["TC-04","TC-06"], "priority": "P1", "status": "verified"},
]
json.dump(d, open(P, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("ok")
