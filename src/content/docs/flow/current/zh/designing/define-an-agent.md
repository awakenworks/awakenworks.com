---
title: "定义 Agent"
description: "创建 Agent Actor、保存不可变的 Project revision，并激活其已实现的执行目标。"
---

Agent 由稳定的 Actor identity 与一份精确的 Project-local Agent revision 组成；activation
再把该 revision 绑定到可执行目标。

## 1. 创建 Actor

```json
{ "target": "agent", "handle": "reviewer", "display_name": "Rust Reviewer" }
```

把此请求提交到 `/api/actors`，并保留返回的 `id`。

## 2. 保存不可变 Agent revision

```json
{
  "expected_override_version": 0,
  "idempotency_key": "reviewer-revision-1",
  "declaration": {
    "name": "Rust Reviewer",
    "description": "Reviews Rust changes and cites concrete evidence.",
    "icon": "lucide:bot",
    "implementation": {
      "kind": "direct",
      "config": {
        "instructions": "Review the assigned change and return the declared output.",
        "model_parameter": "runtime_model"
      }
    }
  }
}
```

提交到 `/api/projects/{project}/agents/{definition}/revision`。Declaration 只能有一种
implementation：带 `AgentConfigTemplate` 的 `direct`，或带 Workflow 符号引用的
`workflow`；admission 会把符号引用解析为精确 revision。Declaration 还可声明 Resource
access、Skill、MCP Connector requirement 与 workspace operation。保存时会先验证并
lower 这些引用，再持久化不可变 revision。

`expected_override_version` 提供乐观并发控制，`idempotency_key` 用来识别重试保存。

## 3. 激活 revision

Direct Agent 需要向
`/api/projects/{project}/agents/{definition}/activations/{activation_id}` 提交不含 secret
的 execution selection：

```json
{
  "expected_version": 0,
  "actor_id": "AGENT_ACTOR_ID",
  "execution": {
    "mode": "provider_model",
    "provider_identity_ref": "openai",
    "model_ref": "configured-model",
    "backend_ref": "native"
  }
}
```

所选 provider、model 与 backend 必须能在 activation 时解析。若 Agent revision 声明了
MCP Connector requirement，则在同一边界通过可选 `mcp_connectors` map 提供具体
Connector Resource id。

Workflow-backed Agent 改用
`"implementation": { "kind": "workflow", "workflow": "..." }`，activation 只提交
`expected_version` 与 `actor_id`。它从 Workflow state 继承执行配置，因此直接
`execution` 与 MCP Connector selection 会被拒绝。
