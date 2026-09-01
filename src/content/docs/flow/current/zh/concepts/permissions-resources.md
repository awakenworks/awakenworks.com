---
title: "Authorization、readiness 与 Resource"
description: "为什么 identity、authorization、admission、readiness、selection、tool approval 与 credential custody 必须分开。"
---

Awaken Workforce 不使用一个含糊的“权限”开关。每道 gate 回答不同问题，也留下不同证据：

| Gate | 问题 |
| --- | --- |
| Identity | 哪个 principal 发出请求或执行工作？ |
| Authorization | 该 principal 能否在此 scope 执行该 action？ |
| Admission | 提交的声明是否有效且内部安全？ |
| Readiness | dependency、Resource、provider 和 worker 现在是否齐备？ |
| Selection | 哪个合格 Actor/provider/Resource 应服务这项工作？ |
| Approval | 这次具体 subject action 或 tool call 能否继续？ |
| Egress/lease | 到副作用边界时 live authority 是否仍有效？ |

HTTP authorization 集中经过 Workforce IAM layer 与 scoped role binding。Team membership
参与 selection 和 access policy，但不是隐式 grant。Visibility 也投影到同一授权路径；
public read 经过 scrub 且只读，不可见 scope 返回 404。

Tool permission 不等于 Resource permission。Runtime 可以允许 tool call，但拥有该
Resource action 的 Workforce service 仍会授权，并可能要求自己的 approval；宽泛 tool grant
因此不能绕过领域数据边界。

Content 让这个区分更具体：只有精确冻结 Resource grant 包含 `content` read 时，
Agent 才看到 `resource.content.get`；只有包含 `submit` mutation 时才看到
`resource.submit`。每次调用都重新派生 live activation/revision grant，解析到达的
精确 ResourceType 与 Project，再应用普通 Resource IAM。approval 拒绝或 pending
发生在 content normalization/storage 之前，因此不会留下部分 Resource write。

ResourceBinding 以 handle 让 Resource 在 scope 可用，ResourceLink 连接已声明 role。
Credential Resource 保存 opaque backing reference，托管 secret 值留在 vault 中，只在
受治理的 Connector/sandbox 边界 materialize。Readiness 会在使用前报告缺失 Resource
或 link，而不会依赖 ambient credential 或猜测默认值。

实际收益是：operator 可以区分 access、configuration、capacity、approval 或过期 live
authority，并修复正确问题，而无需削弱其他边界。
