---
title: "判断现有 Anthropic Managed Agents 客户端能否接入 Awaken"
description: "判断现有客户端可以直接接入、需要适配明确约束，还是应改用 Awaken 原生 API。"
evidence:
  - "crates/server/awaken-protocol-managed/src/lib.rs"
---

请在修改现有 Anthropic Managed Agents 客户端前使用本页。先列出客户端所用的 SDK
版本和资源族，再从下面四种结果中选择一项。请求能够到达服务器，不等于整个客户端已经兼容。

## 先做兼容性判断

| 查到的结果 | 应采取的动作 |
| --- | --- |
| 资源族标为**兼容**，客户端所选 SDK 版本已在矩阵中覆盖，并使用必需 beta 与 Awaken 认证 | 修改连接配置，运行一个最小 Session，再验证应用实际使用的操作。 |
| 资源族标为**有约束兼容**，或注明 header 差异 | 迁移前落实该约束，并在客户端中保留明确的适配逻辑，不把它当作无差别替换。 |
| 应用需要 **Awaken 扩展** | 显式使用文档中的 Awaken 路由或字段，不把这条路径称为 Anthropic baseline 兼容。 |
| SDK 版本或 API 不在表内 | 视为尚未审阅；验证应用实际使用的资源族、改用已文档化的 Awaken 原生 API，或等待兼容性审阅。 |

当前验证记录覆盖 **`@anthropic-ai/sdk` 0.122.0** 与 **Python `anthropic` 1.2.0**，
两者在审阅范围内都暴露 127 个生成操作。TypeScript 矩阵还覆盖 0.121.0、0.117.1
和 0.105.0；Python 矩阵覆盖从 0.92.0 到 1.2.0 的全部已选变更点。这些是已测试版本，
不是依赖要求。请按自己的依赖治理选择版本，再用本页判断哪些行为确实经过测试。在 Awaken
revision `50d5035c68456c9106626f748cf4c169c2057beb`，operation manifest 把当前 SDK
的 127 个方法和 12 条已审阅但 SDK 未生成的文档路由映射到具名可执行场景。兼容范围只包括
本页具名的路径、方法、DTO、错误、helper 与约束。

## 连接官方 SDK

```ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: 'http://localhost:8080',
  apiKey: process.env.AWAKEN_API_KEY ?? 'local',
});

const session = await client.beta.sessions.create({
  agent: process.env.AWAKEN_AGENT_ID,
  environment_id: process.env.AWAKEN_ENVIRONMENT_ID,
});
await client.beta.sessions.events.send(session.id, {
  events: [{
    type: 'user.message',
    content: [{ type: 'text', text: 'Summarize RFC 8259.' }],
  }],
});
```

只修改 base URL 还不够，还要配置 Awaken 认证。官方 Managed 资源方法会加入所需 beta
selector；原始 HTTP 客户端需要自行发送。Awaken 接受 `x-api-key: <token>` 或
`Authorization: Bearer <token>`。

在迁移整个应用前：

1. 记录所选 SDK 版本，列出客户端调用的全部资源族。
2. 配置 `baseURL` 与 Awaken 认证，并确认 SDK 方法加入预期 beta selector。
3. 创建一个 Session，发送一个事件，并检查返回的 error envelope。
4. 落实应用会遇到的全部约束，再验证 retry 与 archive 路径。

## 如何使用设计引用

本页是兼容与差异声明的唯一公开权威页面。
[Managed Agents 协议页](/zh/docs/agents/protocols/managed-agents/)只解释该 wire
如何进入 runtime。下文每项有意义的约束都会链接到对应设计页，用于解释所有权、状态变化、
失败处理和部署责任。设计页回答“为什么这样工作”，兼容性判断仍以本页为准。

## SDK 验证矩阵

| 客户端 | 已审阅版本 | 在 Awaken 上运行的证据 | 结果边界 |
| --- | --- | --- | --- |
| TypeScript `@anthropic-ai/sdk` | 当前 0.122.0；变更点 0.121.0、0.117.1 与 0.105.0 | 精确 method、path、query、beta selector、请求与响应 shape、类型化错误、重试、分页、SSE、helper exports、真实进程生命周期和重启恢复 | 当前 0.122.0 有 127 个生成操作。0.122.0 移除 `resolveSkillVersion` 是上游源码变化，不是 Awaken shim。 |
| Python `anthropic` | 当前 1.2.0；从 0.92.0 到 1.1.0 的 12 个已选变更点 | 127 个当前操作均通过同步和异步客户端，另覆盖五个生成 helper 入口、类型化错误、middleware、credential provider、真实进程生命周期、重启恢复和 3,827 个由声明生成的响应 witness | `BetaSelfHostedWork.data` 有一项已审阅上游类型差异：Python 1.2.0 annotation 缺少 `healthcheck` 分支，但 wire 与真实 poller 都接受两个分支。 |
| 原始 HTTP | 当前具名路由族 | Rust wire schema、路由行为、负向准入、持久化与进程替换测试 | 调用方负责认证、`anthropic-version` 和资源族 beta selector；Awaken 扩展不属于 Anthropic baseline。 |

需要公开这张矩阵，因为“SDK 兼容”可能在多个位置失效。即使路由存在，生成方法、helper、
重试规则、stream decoder 或响应 DTO 仍可能不同。本表说明测试了哪种客户端和行为；下方资源
矩阵则回答应用可以使用哪些 API 资源族。

上游契约请以 Anthropic 的 [Managed Agents 总览](https://platform.claude.com/docs/en/managed-agents/overview)、
[Session operations](https://platform.claude.com/docs/en/managed-agents/session-operations)，以及官方
[TypeScript](https://github.com/anthropics/anthropic-sdk-typescript) 和
[Python](https://github.com/anthropics/anthropic-sdk-python) SDK 仓库为准。本页记录 Awaken
经过测试的投影与差异，不替代这些上游来源。

## Beta header 决策表

服务器会解析逗号分隔和重复的 `anthropic-beta` header。缺少必需 beta 时返回 Managed
`invalid_request_error`。

| 资源族 | 必需 beta 值 | 与 Managed beta 的关系 |
| --- | --- | --- |
| Agents、Sessions、Environments、Deployments、Deployment Runs、Vaults | `managed-agents-2026-04-01` | 必需 |
| Dreams | `dreaming-2026-04-21` | 需要专属 beta；不要求 Managed beta |
| Memory Stores、Memories、Memory Versions | 当前 SDK 使用 `agent-memory-2026-07-22`；旧客户端也可单独使用 `managed-agents-2026-04-01` | 必须只发送一个 selector；两者同时发送会被拒绝 |
| 当前 SDK Beta 与 GA namespace 中的 Files | 无 | 当前 0.122.0 与 Python 1.2.0 的 Beta 方法保留 `beta=true`，但不再发送旧 Files selector；旧客户端仍可发送 `files-api-2025-04-14`。 |
| 当前 SDK Beta 与 GA namespace 中的 Skills 与 Skill Versions | 无 | 当前 0.122.0 与 Python 1.2.0 的 Beta 方法保留 `beta=true`，但不再发送旧 Skills selector；旧客户端仍可发送 `skills-2025-10-02`。 |
| User Profiles | SDK 0.122.0 发送 `user-profiles-2026-08-18`；仍接受旧的 `user-profiles-2026-03-24` | 需要专属 beta；不要求 Managed beta |
| Tunnels 与 Certificates | `mcp-tunnels-2026-06-22` | 需要专属 beta；不要求 Managed beta |
| SDK 0.122.0 中的 GA Files、Skills 与 Models | 无 | 没有 beta gate；GA 与 beta 根路径复用同一资源权威 |
| 当前 SDK 未生成的 Skill version 单文件路由 | `skills-2025-10-02` | 仅 `GET /v1/skills/{id}/versions/{version}/files/{path}?beta=true` 要求该 selector |

Dreams SDK 方法会自动加入 dreaming beta。Awaken 接受该生成请求，不再要求
`/v1/dreams` 同时携带 Managed beta。

## 兼容矩阵

| 官方 SDK 产品面 | Awaken 状态 | 边界 |
| --- | --- | --- |
| Agents 与 Agent Versions | 兼容 | 创建、列出、读取、更新、归档与版本列表使用官方 Managed 路由和 DTO。 |
| Sessions、Events、Threads 与 Session Resources | 有约束兼容 | CRUD/归档、事件历史、事件写入、thread history 与 SSE 路由均已实现；参见[Session 与事件](/zh/docs/agents/concepts/sessions-and-events/)及下文约束。 |
| Environments 与 Work | 兼容 | Environment 生命周期和 deferred-work lease/ack/heartbeat/stop 路由已实现；物理 Sandbox 创建时机属于 Awaken 执行设计，参见[Brain、Hand 与 Session Environment](/zh/docs/agents/concepts/brain-and-hand/)。 |
| Deployments 与 Deployment Runs | 兼容 | 官方 lifecycle 与 run 路由已实现。 |
| Vaults 与 Credentials | 兼容 | 官方 lifecycle、archive 与 `mcp_oauth_validate` 路由已实现；secret 保管与最后一跳物化遵循 [Awaken 凭据保管设计](/zh/docs/agents/concepts/credential-custody/)。 |
| Memory Stores、Memories 与 Memory Versions | 有 header 约束的兼容 | 路径使用 `/memories`；Memory beta 按上表排他。 |
| Files | 兼容 GA projection 过渡 | SDK 0.122.0 GA 与只带 query 的 Beta multipart upload、metadata、content download、list 与 delete 已实现；旧 Files selector 仍选择已审阅的旧投影。 |
| Skills 与 Skill Versions | 兼容 GA projection 过渡 | SDK 0.122.0 GA 与只带 query 的 Beta create、version upload、metadata、list 与 delete 已实现；旧 Skills selector 仍可使用，SDK 未生成的单文件路由继续显式门控。 |
| User Profiles | 兼容已审阅的 beta 过渡 | CRUD/list 与 enrollment URL 会在各自 beta selector 下接受 0.122.0 的 `access_type` 词汇和旧版 `relationship` 词汇。 |
| Dreams | Dreams beta 下兼容 | `dreaming-2026-04-21` 下的 create、retrieve、list、archive 与 cancel 已实现。 |
| Tunnels 与 Certificates | 兼容 | Tunnels beta 下的 tunnel lifecycle 与 certificate operation 已实现。 |
| Models | 兼容 | SDK 0.122.0 GA 与 beta 的 list/retrieve 已实现；可用性取决于 Awaken 已配置 catalog。 |

“兼容”只适用于具名 wire contract。模型可用性、凭据、Sandbox capacity 与 backend
placement 属于 Awaken 配置，即使 request 合法也可能明确失败。

## 已知差异与约束

| 场景 | 当前行为 | 公开设计所有者 |
| --- | --- | --- |
| SDK 认证与 beta 准入 | 只修改 `baseURL` 不够；还需要 Awaken 认证与资源族对应的 beta selector。 | [Managed Agents 协议](/zh/docs/agents/protocols/managed-agents/) |
| Session create 中的 `vault_ids` | 支持，并冻结进无密钥的 Session baseline。 | [凭据保管](/zh/docs/agents/concepts/credential-custody/)与[Session 与事件](/zh/docs/agents/concepts/sessions-and-events/) |
| Session update 中的 `vault_ids` | 返回 `400`；不会修改现有 Session 已冻结的凭据 baseline。 | [凭据保管](/zh/docs/agents/concepts/credential-custody/)与[Session 与事件](/zh/docs/agents/concepts/sessions-and-events/) |
| Vault secret 存储与交付 | Wire 兼容，但实际安装的开源自托管、云端托管或企业保管组合决定材料权威与最后一跳持有者；兼容不等于使用 Anthropic 托管密钥基础设施。 | [凭据保管与最后一跳物化](/zh/docs/agents/concepts/credential-custody/) |
| Session `initial_events` 数量 | `0..50`；非空 `initial_events` 不能与 idempotency key 同时使用。 | [Session 与事件](/zh/docs/agents/concepts/sessions-and-events/) |
| Session `initial_events` 中的 `system.message` | 拒绝；Deployment initial events 使用独立 batch policy，可允许它。 | [Session 与事件](/zh/docs/agents/concepts/sessions-and-events/) |
| Session `initial_events` 中的 `user.define_outcome` | 最多一个；`max_iterations` 必须为 `1..20`。 | [Session 与事件](/zh/docs/agents/concepts/sessions-and-events/) |
| Deployment `initial_events` | 必须为 `1..50`；接受紧跟对应 user message 的末尾 `system.message`，outcome `max_iterations` 仍为 `1..20`。 | [Session 与事件](/zh/docs/agents/concepts/sessions-and-events/) |
| `agent.thinking` 投影 | Awaken 从已提交的推理进展投影 SDK 定义的无内容 marker，但永不暴露 provider reasoning text；history 与 replay 保持稳定 event identity。 | [Session 与事件](/zh/docs/agents/concepts/sessions-and-events/) |
| Session 创建与 Sandbox 创建 | 二者不是同一时刻。接受的 `on_tool_use` policy 可以让只做 Native 推理的 Session 在第一次 Hand tool 前不创建 Sandbox；本地 filesystem 需求会强制提前实现，非 Native 的延迟创建会被拒绝。 | [Brain、Hand 与 Session Environment](/zh/docs/agents/concepts/brain-and-hand/) |
| Skill 发现与正文加载 | 允许文件工具的 Session 使用 Anthropic 兼容的 Prompt 目录元数据与 `SKILL.md` 文件加载，不暴露语义 Skill 工具；禁用全部文件工具的 Native Session 使用 `list_skills` 与 `Skill`。每个 Session 只固定一种投影。 | [使用 Skills 子系统](/zh/docs/agents/runtime/how-to/use-skills-subsystem/) |
| Files 与 Skills 的 Beta-to-GA 投影 | 当前 SDK Beta 方法发送 `beta=true`，不再发送旧 dated selector，因此 Awaken 返回 post-GA shape。已审阅旧 selector 仍选择旧投影；SDK 未生成的 Skill 单文件路由继续显式门控。 | [Managed Agents 协议](/zh/docs/agents/protocols/managed-agents/) |
| User Profiles beta 过渡 | SDK 0.122.0 发送 `user-profiles-2026-08-18` 并使用 `access_type`；旧的 `user-profiles-2026-03-24` selector 与 `relationship` 词汇仍供已审阅的旧版客户端使用。 | [Managed Agents 协议](/zh/docs/agents/protocols/managed-agents/) |
| 表格之外的 Anthropic API | 不作兼容承诺；只使用已文档化 Awaken 路由。 | [API 参考](/zh/docs/agents/reference/api/) |

## Awaken 扩展

扩展与兼容面共用同一批受治理对象，但不属于 Anthropic baseline。大多数使用独立路由族：

| 扩展 | 公共表面 | 公开设计所有者 |
| --- | --- | --- |
| Live Inbox 与完整 resource manifest 替换 | `/v1/awaken/sessions/*` | [Live Inbox](/zh/docs/agents/protocols/live-inbox/)与[Session 与事件](/zh/docs/agents/concepts/sessions-and-events/) |
| 持久 run 控制、恢复、pause/resume 与 dead letter | `/v1/durable/*` | [生产可靠性](/zh/docs/agents/concepts/production-reliability/) |
| Provider、model、credential、Agent authoring 与 webhook subscription 配置 | `/v1/config/*` | [模型发布](/zh/docs/agents/reference/provider-model-config/)与[凭据保管](/zh/docs/agents/concepts/credential-custody/) |
| Sandbox execution 与 dream policy | `/v1/awaken/*` | [Brain、Hand 与 Session Environment](/zh/docs/agents/concepts/brain-and-hand/) |
| AI SDK、AG-UI、A2A 与 MCP adapter | 各自文档化协议路径 | [协议接入矩阵](/zh/docs/agents/protocols/connect/) |
| Application access token 与 workspace path projection | `/v1/application-access-tokens`、`/v1/workspaces/*` | [治理](/zh/docs/agents/concepts/governance/) |

少量扩展有意位于兼容形状旁边或内部，因此严格客户端必须显式处理：

| 扩展 | 位置 | 公开设计所有者 |
| --- | --- | --- |
| 禁用 Agent | `POST /v1/agents/{id}/disable` | [配置到执行](/zh/docs/agents/concepts/configuration-to-execution/) |
| 在 Session Sandbox 中启动 MCP server | Agent MCP server variant `type: "sandbox_stdio"` | [MCP](/zh/docs/agents/protocols/mcp/)与[Brain/Hand](/zh/docs/agents/concepts/brain-and-hand/) |
| 注入 Awaken transcript | `SessionCreateParams.x_awaken.transcript_prefix` | [Session 与事件](/zh/docs/agents/concepts/sessions-and-events/) |
| 选择 ACP backend profile | `ModelConfig.id` 中的 `executor=acp:<id>` qualifier | [通过 API 选择模型与 ACP runtime](/zh/docs/agents/how-to/select-models-and-acp-runtimes/) |
| 把上传文件绑定到 Awaken 资源 | File metadata 字段 `purpose`、`session_id`、`logical_path`，以及 `purpose` list filter | [Session 与事件](/zh/docs/agents/concepts/sessions-and-events/) |
| 读取 Skill version 中的单个文件 | `GET /v1/skills/{id}/versions/{version}/files/{path}` | [API 参考](/zh/docs/agents/reference/api/) |

这些字段和路由都是扩展；只需要 baseline 行为的客户端不应发送或依赖它们。公共路由族的
唯一索引是 [API 参考](/zh/docs/agents/reference/api/)。

## 执行扩展：Native、ACP 与 A2A

兼容 wire 不固定执行 backend。不可变的已发布 model binding 会选择：

- Native 进程内 backend；
- Claude Code、Codex、Gemini、OpenCode 或 Hermes 等受支持 ACP CLI backend；
- 远程 A2A endpoint。

ACP runtime 选择与 Sandbox placement（`local`、`namespace`、`docker`、`podman`
或 `k8s`）是两个独立维度。不同 ACP 实现的精确模型选择、credential delivery 与
session persistence 并不相同。API selector 与发布边界见
[通过 API 选择模型与 ACP runtime](/zh/docs/agents/how-to/select-models-and-acp-runtimes/)，
逐 runtime 差异见 [ACP runtime 矩阵](/zh/docs/agents/protocols/acp/)。
