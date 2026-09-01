---
title: "Workflow 作者契约"
description: "当前 WorkflowAuthorDeclaration 请求格式，以及它如何降级为内部 ProcessSpec。"
---

保存 Project 本地 revision：

```http
POST /api/projects/{project}/workflows/{definition}/revision
```

请求必须包含 `expected_override_version`、`idempotency_key` 和 `declaration`；未知字段拒绝。

```json
{
  "expected_override_version": 0,
  "idempotency_key": "save-review-flow-1",
  "declaration": {
    "name": "Review flow",
    "description": "Accept one reviewed result",
    "icon": "lucide:badge-check",
    "start": "done",
    "states": {
      "done": {
        "name": "Done",
        "description": "The declared result is accepted",
        "icon": "lucide:circle-check",
        "state_group": "done",
        "completion": "completed",
        "transitions": []
      }
    }
  }
}
```

## 静态格式

| 范围 | 必需 | 可选 |
| --- | --- | --- |
| declaration | `name`、`description`、`icon`、`start`、`states` | `inputs`、`requires`、`outputs`、`max_iterations` |
| state | `name`、`description`、`icon`、`state_group`、`completion`、`transitions` | `instruction`、`spec_delivery`、`agent_session`、`environment`、`agent_tool_profile`、`slots`、`inputs`、`outputs`、`wip_limit` |
| transition | `key`、`name`、`description`、`icon`、`to`、`when` | 无 |

`state_group` 可为 `backlog`、`todo`、`in_progress`、`review`、`waiting`、`done`
或 `canceled`；`completion` 可为 `open`、`completed` 或 `canceled`。

State slot 或为 `{ "responsibility": "executor", "agent":
"workflow.requires.ROLE" }`，或为 responsibility 加 Actor/Team `selector`。最多允许一个
Executor。动态并行使用子 Issue 分解；`join_policy` 不是字段。

State input 引用 `workflow.inputs.*`、`workflow.requires.*` 或
`states.*.outputs.*`。output 声明类型化值或 Resource realization；Workflow output 投影
`states.*.outputs.*` 并形成终态验收契约。符号化 `AuthorRef` 在 Pack/Project 上下文解析，
保存后的运行 revision 使用精确引用。

## Environment requirement 与选择

Environment requirement 包含 description 和 Environment `AuthorRef`：

```json
{
  "requires": {
    "build_environment": {
      "description": "Network- and package-constrained build execution",
      "environment": "build-linux"
    }
  },
  "states": {
    "build": {
      "environment": "build_environment"
    }
  }
}
```

保存 Workflow revision 时，该引用会解析为一个精确 Environment revision。Issue binding
时，同一 requirement key 选择
`{ "kind": "environment", "activation_id": "build-linux-active" }`。activation 缺失、
disabled、漂移或指向不同 revision 时，dispatch 会 fail closed。参见
[Environment](/zh/docs/workforce/concepts/environments/)。

响应返回不可变 revision 与 Project override 结果；已有 Issue 保留固定 revision。仅清除
Project 默认值时，调用 `POST /api/projects/{project}/workflows/{definition}/override/clear`
并提交 `expected_override_version`。
