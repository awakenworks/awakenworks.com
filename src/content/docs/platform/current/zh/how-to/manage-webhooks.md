---
title: "向你的后端发送签名生命周期事件"
description: "在 Console 创建出站 Webhook，保存只显示一次的签名密钥，校验投递，并区分重试与人工暂停。"
evidence:
  - "web/src/surfaces/webhooks.tsx"
  - "web/e2e/webhooks.spec.ts"
  - "crates/server/awaken-webhook-managed/src/control_plane.rs"
  - "crates/server/awaken-webhook/src/dispatch.rs"
  - "crates/server/awaken-webhook/src/signing.rs"
---

## 目标

把选定的 Agent 与 Session 生命周期事件从 Awaken 发送到你控制的后端。接收端能够校验
签名、忽略重复 event id、按需读取事件引用的对象，并返回 `2xx`，即表示接入完成。

Webhook 是 Awaken 向外发送通知的路径。应用需要实时接收 Agent 输出时，应使用 Session
事件流。后端需要在不轮询的情况下响应生命周期变化时，再使用 Webhook。

## 前置条件

你需要：

- 一个公网可解析的 HTTPS 接收端。生产配置会拒绝 HTTP、回环、私有、link-local 与
  metadata 地址；
- 一个用于保存 `whsec_` 签名密钥的安全位置；
- 管理 Workspace 配置的权限；
- 接收端所需的准确 Webhook 事件名。Webhook 与 Session SSE 使用不同的事件名，例如
  Webhook 使用 `session.status_idled`，而不是 `session.status_idle`。

[Managed Agents Webhook 指南](https://platform.claude.com/docs/en/managed-agents/webhooks)
定义兼容的事件 envelope、签名 header 与事件目录。Awaken 定义创建 subscription 的
Console 与管理接口。

## 1. 打开出站连接

在 Console 打开 **连接 > Webhooks**，确认页面显示 **Awaken 到你的后端**。如果另一套
系统需要调用 Agent，请返回[协议接入矩阵](/zh/docs/agents/protocols/connect/)并选择入站
应用协议。

## 2. 创建端点

输入公网 HTTPS URL。用逗号或换行加入准确的 Webhook 事件名；留空则接收当前 Awaken
部署发出的所有生命周期事件。选择 **创建端点**。

Console 使用下面这个 Workspace-scoped Awaken 扩展。它不是 Anthropic Webhook CRUD
接口：

```http
PUT /v1/config/webhook-subscriptions/wh_your_stable_id
Content-Type: application/json

{
  "url": "https://events.example.com/awaken",
  "event_types": ["session.status_idled", "session.status_terminated"]
}
```

首次创建成功时，response 包含 `secret`。后续读取和更新都不会返回该字段。

## 3. 离开页面前保存密钥

复制一次性提示中的 `whsec_` 值，并在接收端的 secret manager 中保存为
`ANTHROPIC_WEBHOOK_SIGNING_KEY`。关闭提示或刷新 Console 后，UI 不再显示明文，Awaken
也无法再次返回同一个 secret。

如果密钥丢失，请删除 subscription 并重新创建。更新 URL、事件过滤条件或启用状态不会
轮换密钥，也不会再次返回密钥。

## 4. 处理正文前校验签名

读取未经修改的请求正文。在解析或执行任何动作之前，使用已保存的密钥校验
`webhook-id`、`webhook-timestamp` 与 `webhook-signature`，并拒绝过期 timestamp。

校验通过后：

1. 使用顶层 event `id` 去重，该值也出现在 `webhook-id` 中；
2. 根据 `data.type` 分派处理；
3. 如果不是删除事件，使用 `data.id` 读取对象的当前状态；
4. 只有接收端接受事件后才返回任意 `2xx`。

不要根据投递顺序推导状态。重试使用同一个 event id，不同生命周期事件也可能换序到达。
重新读取对象才能得到当前已提交状态。

## 5. 在 Console 查看投递状态

Webhooks 列表会分开显示人工配置与投递证据：

| Console 状态 | 含义 | 处理方式 |
| --- | --- | --- |
| 正常 | 端点已启用，且没有连续投递失败 | 无需处理 |
| 投递重试中 | 端点仍启用，但最近一次投递失败 | 检查接收端可用性、status code 与签名处理 |
| 已暂停 | 操作员停用了端点，且没有记录投递失败 | 需要恢复通知时再启用 |
| 失败后已停用 | 投递失败达到自动停用阈值 | 先修复接收端，再启用端点 |

重新启用只影响之后产生的事件。subscription 停用期间产生的事件不会补发。如果后端必须
观察每一次状态转换，应通过 API list 或 retrieve 源对象进行对账。

## 验证

产生一次与过滤条件完全匹配的生命周期变化，并核对以下事实：

1. 接收端获得 JSON event 与三个签名 header；
2. 使用一次性密钥进行签名与 timestamp 校验能够通过；
3. 重复 event id 不会再次改变下游状态；
4. 接收端读取事件引用的对象，并记录预期结果；
5. Console 保持“正常”，或在一次成功重试后恢复为“正常”；
6. 刷新 Console 后无法看到签名密钥。

## 故障处理

| 结果 | 检查原因 | 处理方式 |
| --- | --- | --- |
| 创建返回 `400 invalid_request_error` | URL scheme、解析后的地址，或 `event_types` 格式 | 使用公网 HTTPS endpoint，并传入非空字符串数组 |
| 接收端始终判定签名无效 | 校验前正文被修改、密钥错误、timestamp 过期或 header 名错误 | 使用该 subscription 的密钥，对原始字节与三个 `webhook-*` header 进行校验 |
| 没有收到事件 | filter 不是 Webhook 事件名、端点已暂停，或事件发生在订阅之前 | 修正 filter 并启用端点，然后产生一个新事件 |
| 状态为“投递重试中” | transport error 或可重试的非 `2xx` response | 检查接收端，并在接受事件后返回 `2xx` |
| 状态为“失败后已停用” | 连续投递失败达到阈值 | 先修复接收端，再选择“启用”；缺失事件不会重放 |
| 没有保存 secret | 明文被设计为不可恢复 | 删除端点并创建替代端点 |

## 下一步

- 使用 [Managed Agents](/zh/docs/agents/protocols/managed-agents/)读取生命周期事件引用的
  resource。
- 使用 [Session 事件](/zh/docs/agents/concepts/sessions-and-events/)接收实时 Agent 输出与
  已提交历史。
- 使用[公共 API 索引](/zh/docs/agents/reference/api/)与生成的
  [management OpenAPI 契约](/zh/docs/agents/reference/management-openapi/)自动化配置。
