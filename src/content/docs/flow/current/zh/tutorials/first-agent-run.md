---
title: "API 教程：手动推进 Workflow"
description: "保存 Workflow revision，并通过一条已声明 HTTP transition 手动推进 Issue。"
---

本教程带你通过 HTTP API 手动推进一条已声明 Workflow transition。它不执行 Agent；
先用它理解 orchestration 边界，再加入技术执行。

## 目标

创建两状态 Workflow，保存 Project revision，提交 Issue，再让 Issue 通过声明的 transition
推进。

## 前置条件

你需要一个已经通过 Project Bootstrap 安装必要平台 lifecycle 定义的 Project。
先完成[源码 Quickstart](/zh/docs/workforce/quickstart/)。其中的 `project bootstrap` 命令通过
唯一 Bootstrap API 安装所选 Pack 并创建初始 Project。下文使用响应中的 `project_id`；不要
直接 seed 数据库。

保持 Workforce server 运行在 `http://127.0.0.1:7979`。下文命令使用 Quickstart 中的
未认证本地评估模式。若使用其他 IAM 模式，应传入该部署要求的精确认证材料，
不要为了跑通教程而放宽 server 配置。

## 1. 保存 Workflow revision

```sh
curl -fsS -X POST http://127.0.0.1:7979/api/projects/PROJECT_ID/workflows/first-flow/revision \
  -H 'content-type: application/json' \
  -d '{
    "expected_override_version":0,
    "idempotency_key":"save-first-flow-1",
    "declaration":{
      "name":"First Workforce",
      "description":"验证一条已声明 transition。",
      "icon":"lucide:workflow",
      "start":"triage",
      "states":{
        "triage":{"name":"Triage","description":"完成前检查工作。","icon":"lucide:search","state_group":"in_progress","completion":"open","transitions":[{"key":"finish","name":"Finish","description":"接受验证结果。","icon":"lucide:check","to":"done","when":null}]},
        "done":{"name":"Done","description":"结果已接受。","icon":"lucide:circle-check","state_group":"done","completion":"completed","transitions":[]}
      }
    }
  }'
```

响应返回精确 Workflow revision、definition digest 与 Project override version。Save 只改变
该 Project 后续创建的对象；已存在的 Issue 不会被重定向。

## 2. 提交工作

```sh
curl -fsS -X POST http://127.0.0.1:7979/api/projects/PROJECT_ID/issues \
  -H 'content-type: application/json' \
  -d '{"title":"Prove the first workflow","description":"Advance only through the declared edge."}'
```

保留返回的 Issue `id`；它应从 `triage` 开始。

## 3. 沿声明的 edge 推进

```sh
curl -fsS -X POST http://127.0.0.1:7979/api/issues/ISSUE_ID/advance \
  -H 'content-type: application/json' \
  -d '{"event":"finish"}'
```

读取 `GET /api/issues/ISSUE_ID` 与 `/timeline`；Issue 应在 `done` 终结。未声明 event
会被拒绝，而不会被猜测。

## 验收

最后一个请求完成后，你应该看到：

1. 保存返回 Workflow revision 与 definition digest。
2. 新 Issue 从 `triage` 开始，并固定该精确 revision。
3. 发送 `finish` 后，Issue 进入终态 `done`。
4. timeline 记录已声明 transition，而不是绕过规则的状态修改。

如果还想检查边界，可以发送一个 Workflow 没有声明的 event name。请求应该失败，
但不应改变 Issue。

## 故障排查

如果表中步骤仍未解决问题，请先记录 Project ID、Workflow revision、Issue ID、request
route、HTTP status、error code 与 correlation ID。不要附带 token 或 request content。

| 现象 | 检查 | 怎么做 |
| --- | --- | --- |
| 保存 Workflow 返回冲突 | `expected_override_version` 与当前 Project override version | 读取当前版本，检查并发变更，再使用新 expected value 和新 idempotency key 重试。 |
| Issue 没有从 `triage` 开始 | Issue 固定的 Workflow revision 与已保存 declaration | 在预期 revision 生效后创建新 Issue；不要在存储层重定向旧 Issue。 |
| `finish` 被拒绝 | 当前 Issue state 和该 state 声明的 transition key | 使用固定 Workflow 允许的 transition，或发布一个仅供未来 Issue 使用的新 revision。 |

## 清理

用 `Ctrl-C` 停止 server。使用同一 data directory 重启后，Workflow 和 Issue 仍然可用，
可以留给下一篇指南继续使用。本教程没有提供单次练习的删除步骤；如果需要一次隔离、
可丢弃的运行，请在开始时使用新的明确 data directory。不要为重置一次练习而删除
数据库行或上层大目录。

## 本教程不会做什么

以上步骤不会产生 WorkUnit 或 Agent Run。真实 Agent 路径还需要 activated Agent revision、
受治理 model/provider/credential join、executor slot 与已接受的 Worker。维护者可以使用仓库
中的 executable E2E fixture 验证该集成边界；这些 fixture 不是通用生产方案。

## 下一步

- 通过面向使用者的路径[创建并跟进 Issue](/zh/docs/workforce/how-to/create-and-follow-an-issue/)。
- 尝试技术执行前，先[定义 Agent](/zh/docs/workforce/designing/define-an-agent/)，检查 publication 与 activation 边界。
- 在把 Awaken Run 解读为业务结果前，先理解[Workforce–Awaken 执行所有权](/zh/docs/workforce/concepts/agents-runs/)。
