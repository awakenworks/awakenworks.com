---
title: "让一个 provider 模型可运行"
description: "选择认证路径，验证 connection，选出 ready 模型，并随 Agent 一起发布。"
evidence:
  - "crates/control/awaken-admin-config-api/src/router/provider_connections.rs"
  - "web/src/surfaces/provider-connection-panel.tsx"
---

这份指南用于让一个模型真正可以被新 Agent 调用。

## 目标

完成时，Provider Connection 应为 `ready`，`/v1/config/executable-models` 中应出现
`ready` 候选，并且新 Session 能从已发布 Agent 启动。

## 前置条件

- Awaken AllInOne 或 Control role 已运行；
- 调用方能在目标 Workspace 写入配置；
- 一份受支持的 API key、OAuth helper 或已有 credential reference；
- 自动化路径需要 `curl`。

## 1. 判断要建立哪种连接

输入任何凭据前，先确认 Awaken 应该怎样认证：

| 你已有的条件 | 提交内容 | 可以继续的条件 |
| --- | --- | --- |
| provider API key | 只写字段 `secret` | 认证与模型发现成功 |
| 受支持的 OAuth 流程 | `oauth_helper` | helper 返回可用的 credential reference |
| 部署环境已经保管的凭据 | `credential_source_id` | 引用的凭据可以打开并通过测试 |
| 自定义 endpoint | descriptor 支持的 dialect 与必填配置 | endpoint 至少返回一个模型 |

如果服务器没有安装该连接的 discovery adapter，先停下来补齐这项能力。不要手工分别创建
Provider、endpoint、credential 和 model 对象。

## Provider Connection 会改变什么

Provider Connection 是 provider credential 与 endpoint 的唯一写入命令。它先测试认证与
模型发现，再一起保存 Provider、endpoint、credential reference 和发现的 offerings。底层
对象仍各自承担执行职责；调用方只使用这一个命令，不必协调四次写入。

## 2. 检查受支持 provider descriptor

服务器拥有 provider kind、dialect、认证方式、默认值与必填配置字段：

```console
curl http://127.0.0.1:8080/v1/config/provider-descriptors
```

部署脚本和文档必须使用返回的 descriptor，不得再硬编码第二份 provider registry。

当前内置 descriptor 覆盖 Anthropic、OpenAI、OpenRouter、DeepSeek、Kimi、Google AI
Studio 和 Vertex AI。每条 descriptor 都告诉 Console 应显示哪些认证方式、API 格式、字段、
默认 endpoint、官方文档入口和模型发现行为。供应商列表变化时，仍以服务器返回值为准。

## 3. 验证并保存一条 connection

Console 路径是**模型与供应商 → 供应商连接 → 选择供应商和认证方式**。选择**新 API Key**
后，页面会显示只写输入框和该供应商的官方 Key 文档入口。如果 Awaken 已保管这个供应商的
active credential，则选择**复用已有凭证**。Vertex AI 使用 `gcloud` OAuth helper。

点击**验证并导入模型**。Awaken 会读取供应商模型目录；只有检查成功后，才保存 connection、
credential reference 和导入的模型。卡片会显示导入数量，Catalog 会把这些模型标记为
provider sync。同一个命令也通过 HTTP 提供。下面的 Anthropic 示例使用只写 API key：

```console
export PROVIDER_API_KEY=your-provider-key
export IDEMPOTENCY_KEY="provider-connection-$(date +%s)"

curl -sS -X POST http://127.0.0.1:8080/v1/config/provider-connections \
  -H 'content-type: application/json' \
  --data-binary @- <<JSON
{
  "idempotency_key": "${IDEMPOTENCY_KEY}",
  "workspace_id": "wrkspc_default",
  "provider_id": "anthropic",
  "display_name": "Anthropic",
  "credential_name": "Anthropic primary",
  "dialect": "anthropic_messages",
  "configuration": {},
  "timeout_secs": 60,
  "secret": "${PROVIDER_API_KEY}"
}
JSON
```

`secret`、`oauth_helper` 与 `credential_source_id` 必须且只能提供一个。请求结果不确定时，
使用同一个 idempotency key 重试；不要通过新建 credential 来重试。响应包含 Provider、
endpoint、credential metadata 和 catalog sync 结果，但不会回显 secret material。

## 4. 检查 connection 与模型 readiness

```console
curl 'http://127.0.0.1:8080/v1/config/provider-connections?workspace_id=wrkspc_default'
curl 'http://127.0.0.1:8080/v1/config/executable-models?workspace_id=wrkspc_default'
```

Connection state 与 executable-model readiness 都是服务器拥有的 projection：

> 当前 `/v1/config/executable-models` 只报告 Native executor readiness。选择 ACP runtime
> 时，publish 会再校验精确 ACP capability。selector 与该边界见
> [通过 API 选择模型与 ACP runtime](./select-models-and-acp-runtimes)。

| 结果 | 含义 | 处理 |
| --- | --- | --- |
| Connection `ready` | 存在 active credential 与至少一个 active discovered model | 选择 executable readiness 同样为 `ready` 的模型 |
| Connection `connected` | endpoint 与 credential 存在，但没有可用 offering | 重新 discovery 或修复 provider access |
| Connection `stale` | freshness window 内没有再次看到 active model | 发布前重新验证 connection |
| Connection `needs_attention` | 已无 active credential | 通过同一 connection path 轮换或替换 credential |
| Model `credential_unavailable` | offering 存在，但没有可固定的可用 credential | 修复 credential availability |
| Model `offering_unavailable` 或 `runtime_unavailable` | catalog 或执行能力无法物化模型 | 选择 ready candidate 或补齐 Runtime capability |

前端不得从分离的 catalog 与 credential list 自行推断 readiness。

## 5. 发布 Agent

在 Agent quickstart 或配置编辑器中选择标记为 `ready` 的模型，审阅 draft 并发布。发布会把
provider、endpoint、credential id/revision、route 与 fallback order 解析并冻结进 execution
snapshot。后续 catalog 或 credential 变化不会静默改变运行中的 Session。

## 验证

- provider connection 报告 `ready`；
- Console 显示**凭证已验证，模型已导入**及导入数量；
- 导入后的 Catalog 行以**供应商同步**标明来源；
- `/v1/config/executable-models` 至少包含一个 `ready` candidate；
- 点击**测试**后，真实 Session 返回可见响应；
- 选定 Agent 校验并发布成功；
- 新 Session 使用新 publication，已有 Session 保留原 snapshot。

## 故障排查

如果表中步骤仍未解决问题，请先记录 Workspace、Provider Connection ID、idempotency key、
provider kind、dialect、connection state、executable-model state、upstream HTTP status
与 correlation ID，再联系支持。不要附带 provider secret 或 OAuth material。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| `connection_auth_invalid` | 请求提供零个或多个认证方式 | 只发送一个受支持方式 |
| `connection_test_unavailable` | 未安装 discovery adapter | 启用 provider discovery capability；不要手工保存未验证 endpoint |
| provider 拒绝 credential | connection response 与 upstream status | 轮换 credential，保留同一 connection identity，再次验证 |
| 模型已导入但都不可执行 | executable-model readiness | 修复明确指出的 credential、offering 或 Runtime dependency |
| publication 随后 fail closed | 冻结候选已归档或 revision 不匹配 | 修复 connection 后重新发布；禁止注入环境中的 Worker credential |

## 下一步

- [配置并发布 Agent 行为](./configure-agent-behavior)；
- [通过 API 选择模型与 ACP runtime](./select-models-and-acp-runtimes)；
- [运行官方 SDK 快速开始](../get-started)；
- 理解[模型发布与凭据边界](../reference/provider-model-config)；
- 用生成的[管理 OpenAPI 契约](../reference/management-openapi)获取精确 request schema。
