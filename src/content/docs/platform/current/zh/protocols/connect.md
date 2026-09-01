---
title: "为一次连接选择协议"
description: "先判断谁发起连接，再使用该路径对应的 endpoint、配置入口与完成信号。"
evidence:
  - "crates/bin/awaken-cli/src/lib.rs"
  - "web/e2e/ui-inventory.spec.ts"
---

先按方向选择，再看协议名称：

- 应用或后端进入 Awaken，选择 **Client → Awaken Agents**；
- 远端 Agent 进入 Awaken，选择 **A2A server**；
- Awaken Agents 调用远端 Agent 或 tool service，选择 **Awaken Agents → remote**；
- Worker 把执行交给外部 brain process，选择 **ACP**；
- 操作员调整 active Session 的排队输入，选择 **Live Inbox**；
- 后端接收 Awaken 发出的生命周期通知，选择 **Webhooks**。

如果方向变了，就停下来重新选择，因为认证、配置与完成信号也会随之改变。

| 协议 | 方向 | Endpoint 或配置 | Console 入口 | 完成标准 |
|---|---|---|---|---|
| Managed Agents | Client → Awaken Agents | `/v1/agents`、`/v1/sessions` | Agents、Sessions | API 创建的 Session 以相同 id、Agent、status、metadata 出现在 UI |
| AI SDK | Client → Awaken Agents | `POST /v1/ai-sdk/chat` | Sessions | UI Message Stream 完成，并可读取已提交 message history |
| AG-UI | Client → Awaken Agents | `POST /v1/ag-ui` | Sessions | AG-UI event 正常流出，同一次执行可检查 |
| A2A server | Remote Agent → Awaken Agents | `/.well-known/agent-card.json`、`/v1/a2a/*` | A2A 联邦 | 远端 client 发现本地 card 并取得 task id |
| A2A delegate | Awaken Agents → Remote Agent | published Agent `model.id="a2a:<absolute-url>"` | A2A 联邦；Agent 模型 | publication 在委托前固定 remote card |
| MCP server | MCP client → Awaken Agents | `GET`、`POST`、`DELETE /v1/mcp` | API 与协议 → MCP Server 帮助 | 专用 bearer 初始化 session；`tools/list` 只包含显式管理工具导出 |
| MCP provider | Awaken Agents → MCP server | Agent `mcp_servers` binding | Agent → 构建 → Skills & MCP；运行时凭证 | Session trace 显示命名空间 tool id 与 policy 结果 |
| ACP | Worker → external Brain process | Published `backend_ref`：`acp:claude`、`acp:codex`、`acp:gemini`、`acp:opencode` 或 `acp:hermes` | Agent 模型；运行环境；会话详情 | Session 显示精确 `awaken.runtime`、model route、credential mode 与 Sandbox policy |
| Live Inbox | Operator → active Session | `/v1/awaken/sessions/{id}/live-inbox` | 会话详情 | 输入在 Agent 消费前完成排队或调整 |
| Webhooks | Awaken Agents → 你的后端 | `/v1/config/webhook-subscriptions` | 连接 → Webhooks | 接收端校验签名、按 event id 去重、读取引用的 resource 并返回 `2xx` |

## 选定一行之后

1. 从[协议索引](/zh/docs/agents/protocols/)打开对应指南。
2. 配置矩阵中列出的 endpoint 或 published Agent 字段。
3. 按该表面的规则配置认证。
4. 发送一个之后容易辨认的请求。
5. 同时检查线路响应，以及 Console 中同一个 Session 或 event 记录。

## 共同前置条件

1. 发布有效 Agent，并确保 model/provider 或 ACP Environment 可解析。
2. 凭据保存在 Credentials/Vault 中并绑定引用；不要把 secret 写入 Agent prompt，或展示在
   录屏中的 MCP 配置里。
3. 按表面选择认证方式：启用 embedded/cloud IAM 时，management API 需要 scoped token；
   MCP export 始终需要独立 bearer；本地 AI SDK、AG-UI、A2A 与 Session ingress 默认开放，
   对公网暴露前必须放到带认证的 gateway 后方。
4. 同时验收两侧：protocol response **以及**共享 Session/event 记录。

出站 Webhook 参见[向你的后端发送签名生命周期事件](/zh/docs/agents/how-to/manage-webhooks/)。
接收端使用一次性签名密钥校验每次投递；创建 subscription 时使用的 management token 不会
发送给接收端。

## 当前产品边界

- A2A Console 页面同时展示本地入站 route，并执行出站 remote-card discovery；它是协议视图，
  不是持久化 server-registration CRUD 目录。
- Runtime executor 默认使用官方 ACP JSON-RPC codec；换行 codec 仅用于 fixture/test。
  ACP runtime 与 Sandbox tier 是独立选择，详见 [runtime 矩阵](/zh/docs/agents/protocols/acp/)。
- MCP 是双向能力。“Awaken 作为 server”和“Awaken 消费 tool”是两套独立配置，应分别测试。
- Dashboard、Eval、Datasets、Audit 在当前 build 中仍是 gated Console route；backend capability
  启用前，不应作为产品效果宣传。

Payload 与完整 route 参见 [公共 HTTP API](/zh/docs/agents/reference/api/)。
