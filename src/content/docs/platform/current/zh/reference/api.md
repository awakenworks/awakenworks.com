---
title: "公共 HTTP API"
description: "Managed Agents、Awaken 扩展、协议 adapter 与运维路由族的唯一索引。"
evidence:
  - "crates/bin/awaken-cli/src/lib.rs"
  - "crates/server/awaken-run-ingress-http/src/durable_ops.rs"
---

需要找到公共 HTTP 契约的所有者时，使用本页。它是 `awaken` 服务唯一的 route-family
索引，不是第二份字段或 payload 参考。Process assembly 只挂载配置启用的产品面；列表中
存在某条路由，不代表每一种 deployment 都提供它。

## 找到需要的契约

| 要做什么 | 从哪里开始 | 完成标志 |
| --- | --- | --- |
| 使用官方 Managed Agents SDK | Managed Agents 路由族，然后看[兼容页](/zh/docs/agents/compatibility/) | SDK 收到文档定义的 resource 或 typed error |
| 连接应用协议 | 应用 adapter，然后看对应协议页 | wire result 与已提交 Session state 一致 |
| 自动化配置 Agent、provider、model、credential 或 resource | Control-plane 扩展，然后看[生成的 OpenAPI 契约](./management-openapi) | 预期 revision 已校验并显式发布 |
| 处理 readiness、drain、限额或 durable recovery | Process operations 与持久运行控制 | readiness 或已提交 Coordinator state 显示结果 |

已经知道路由时，继续到链接的权威页面查 request field、认证、状态转换和错误。不要从相邻
路由族推断这些细节。

公共 API 使用多种 media type：

- 大多数 request/response API 使用 JSON；
- live stream 使用 Server-Sent Events（`text/event-stream`）；
- Files 与 Skills 使用 multipart upload 和二进制 content；
- MCP 与 A2A 使用 JSON-RPC，并可配合 SSE。

Managed 兼容、beta header 与差异由
[Anthropic Managed Agents 兼容性](/zh/docs/agents/compatibility/)维护。协议 payload
细节由各协议页维护，本索引不重复这些 contract。

管理平面的精确字段与 schema 由[生成的 OpenAPI 契约](./management-openapi)提供；本 route-family
map 不得扩写成第二份手工字段参考。

## 静态路由所有权

| Owner | 公共路由族 | Contract |
| --- | --- | --- |
| Managed Agents adapter | `/v1/agents`、`/v1/sessions`、`/v1/environments`、`/v1/deployments`、`/v1/deployment_runs`、`/v1/vaults`、`/v1/memory_stores`、`/v1/files`、`/v1/skills`、`/v1/user_profiles`、`/v1/dreams`、`/v1/tunnels`、`/v1/models` | 在已记录 baseline 与约束内兼容官方 SDK wire |
| Awaken extension adapter | `/v1/awaken/*`、`/v1/durable/*` | Awaken 专属 Session steering、policy 与持久控制 |
| Control plane | `/v1/config/*`、`/v1/application-access-tokens`、`/v1/workspaces/{workspace}/*` | Authoring、catalog、credential、access 与 workspace addressing |
| 应用 adapter | `/v1/ai-sdk/*`、`/v1/ag-ui*`、`/v1/a2a*`、可配置 MCP 路径（默认 `/v1/mcp`） | 协议专属应用 wire |
| Process operations | `/metrics`、`/readyz`、`/admin/drain` | Metrics、readiness 与 graceful drain |

## Managed Agents 路由族

官方 SDK 拥有 request 与 response 类型。主要资源族如下：

| 资源族 | 基础与下级路径 |
| --- | --- |
| Agents | `/v1/agents`；`/{agent_id}` 下包含读取/更新/归档/禁用与版本。`disable` 是 Awaken 扩展。 |
| Sessions | `/v1/sessions`；`/{session_id}` 下包含读取/更新/删除/归档、events、threads、thread events/stream 与 resources。 |
| Environments | `/v1/environments`；生命周期以及 `/work` poll、lease、update、ack、heartbeat 与 stop 操作。 |
| Deployments | `/v1/deployments`、`/v1/deployment_runs`；deployment lifecycle 与 run control。 |
| Vaults | `/v1/vaults`；`/{vault_id}/credentials` 下包含 credential 与 `/mcp_oauth_validate`。 |
| Memory | `/v1/memory_stores`；store 下使用 `/memories` 与 `/memory_versions`。 |
| Files | `/v1/files`；metadata 与二进制 `/content`。 |
| Skills | `/v1/skills`；version 与二进制 `/content`。读取 version 中单个文件是 Awaken 扩展。 |
| 其他官方资源族 | `/v1/user_profiles`、`/v1/dreams`、带 certificates 的 `/v1/tunnels`，以及 `/v1/models`。 |

不要从该表推断统一 CRUD 规则。不同资源族的方法、archive/delete 语义、beta 值、
multipart body 与 response media type 都不同。请使用已测试版本的官方 SDK，并查阅
[兼容矩阵](/zh/docs/agents/compatibility/#compatibility-matrix)。

## Awaken Session 与 policy 扩展

| 方法与路径 | 用途 |
| --- | --- |
| `GET/POST /v1/awaken/sessions/{id}/live-inbox` | 读取或加入运行中待处理消息。 |
| `PUT /v1/awaken/sessions/{id}/live-inbox/order` | 带 version check 地重排队列。 |
| `PUT/DELETE /v1/awaken/sessions/{id}/live-inbox/{message}` | 替换或撤回一条待处理消息。 |
| `PUT /v1/awaken/sessions/{id}/resources` | 替换完整 Session resource manifest。 |
| `/v1/awaken/sandbox-execution-policies*` | 创建并发布不可变 Sandbox policy version。 |
| `GET/POST /v1/awaken/environments/{id}/sandbox-execution-policy` | 读取或绑定 Environment policy。 |
| `GET/PUT /v1/awaken/memory-stores/{id}/dream-policy` | 读取或设置周期性 Dream policy。 |

行为契约见 [Live Inbox](/zh/docs/agents/protocols/live-inbox/) 与
[Sandbox tier](/zh/docs/agents/how-to/configure-sandbox-tiers/)。

## 持久运行时操作

这些操作由 Coordinator 拥有；durable ingress 不可用时会 fail closed。所有路由都位于
`/v1/durable/threads/{thread}` 下：

```text
POST  /submit_background
POST  /cancel
POST  /pause
POST  /resume
POST  /wake
POST  /deliver
POST  /supersede
GET   /superseded
GET   /dispatches
GET   /messages
POST  /reconcile
POST  /quarantine-retry-exhausted
GET   /dead-letters
POST  /dead-letters/{run_id}/requeue
POST  /dead-letters/purge
```

控制序列是持久的：submit 先记录工作再执行；claim/epoch fencing 控制 commit；pause、
cancel、supersede 与 recovery 更新 Coordinator-owned state。Retry budget 耗尽时，系统通常
会提交 `Ended(Indeterminate)` 并自动 settle。只有显式请求
`quarantine-retry-exhausted` 后才会出现 dead letter；requeue 与 purge 也必须显式发生。
Transport failure 不会授权 unfenced replay。

普通 retry exhaustion 后不需要 dead-letter 修复。只有原业务意图仍需再次尝试时，才检查
已提交 terminal。Quarantine、requeue 与 purge 是经过审阅的控制命令，不是日常 cleanup
sequence。

显式 quarantine 时，必须传入已经审阅的 `max_attempts=<正整数>` query。缺失或无法解析时，
server 会把它当作 `0`，因此省略参数并不是安全的运维默认值；`now_ms` 可省略，此时使用
server 时间。Response 返回 `{"quarantined": n}`。修复前先列出隔离项，原因修正后只 requeue
指定 Run；如果该 Run 不属于所请求 Thread 的 quarantine，接口返回 `409`。Purge 会删除该
Thread 的全部 dead-lettered dispatch 及其 pending input，不是重试或日常清理的前置步骤。

## Control-plane 扩展

`/v1/config/*` 是内嵌 Console 使用的 authoring 与 catalog 产品面，包括 Agent
draft/validate/publish、provider、model、inference profile、credential、resource、
MCP/A2A 配置与 Awaken webhook subscription。Webhook subscription CRUD 是
`/v1/config/webhook-subscriptions[/{id}]`；它是 Awaken 扩展。Console 路径、一次性
密钥、投递状态与接收端验收方法参见[向你的后端发送签名生命周期事件](../how-to/manage-webhooks)。

Application access token 使用 `/v1/application-access-tokens[/{id}]`。Workspace
path addressing 把同一条公共路由投影到 `/v1/workspaces/{workspace}/{rest}` 下，
不会创建第二份 domain store。

## 协议 adapter

| Adapter | 入口路由 | 详细 contract |
| --- | --- | --- |
| AI SDK | `/v1/ai-sdk/chat`、thread/Agent run 路由、thread message history | [AI SDK](/zh/docs/agents/protocols/ai-sdk/) |
| AG-UI | `/v1/ag-ui`、`/v1/ag-ui/agents/{id}`、thread message history | [AG-UI](/zh/docs/agents/protocols/ag-ui/) |
| A2A | `/v1/a2a*` JSON-RPC、REST convenience route、task 与 Agent Card route | [A2A](/zh/docs/agents/protocols/a2a/) |
| MCP | 可配置路径，默认 `/v1/mcp`；支持 `POST`、`GET` 与 `DELETE` | [MCP](/zh/docs/agents/protocols/mcp/) |

所有 adapter 都汇入同一份已发布 Agent 与 thread-keyed Session 基底，同时保留各自的
wire framing 与 error contract；客户端不应假定全进程只有一种 JSON envelope。

## 运维

```text
GET   /metrics       Prometheus metrics
GET   /readyz        ready 时 200；draining 时 503
POST  /admin/drain   停止接收新工作，让已有 stream 完成
```

这些路由位于 `/v1` 之外，不使用 Anthropic beta header。请在 deployment 边界保护
drain endpoint。

## 相关

- [用 SSE 暴露 HTTP](/zh/docs/agents/how-to/expose-http-sse/)：assembly 与 streaming 行为
- [Console 与 API 所有权](/zh/docs/agents/reference/admin-console/)：配置生命周期
- [Managed Agents 兼容性](/zh/docs/agents/compatibility/)：精确 wire 支持与差异
