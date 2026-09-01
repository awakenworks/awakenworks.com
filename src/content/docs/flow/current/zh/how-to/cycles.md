---
title: "使用 Cycle 规划工作"
description: "通过当前 planning API 创建、激活、检查和关闭 Cycle。"
---

Cycle 是具有内置生命周期 `upcoming → active → closed` 的 planning Subject。它负责
组织一批工作，但不会重新定义各 Issue 是否就绪。

## 目标

把选定 Issue 组织到一个 Cycle 中，激活该规划边界，检查 membership 与 roadmap 投影，
然后显式关闭它。

## 前置条件

- 一个就绪 Project；
- 该 Project 中至少有一个现有 Issue；
- 能够创建 Cycle 与 Issue relation 的 API 权限。

## 1. 创建、激活并关闭 Cycle

1. 向 `POST /api/projects/{project}/cycles` 至少提交 `{ "title": "..." }`。
2. 向 `/api/issues/{issue_id}/relations` 提交
   `{ "to": "CYCLE_ID", "kind": "plan_membership" }`，把 Issue 加入 Cycle。
3. 调用 `POST /api/cycles/{id}/activate` 激活 Cycle。把 Issue 加入一个已经 active 的
   Cycle 会发出 `plan.activated`；项目预置 intake rule 随后可将其从 `backlog` 推进到
   `todo`。
4. 读取 `/api/cycles/{id}/memberships` 和项目的
   `/api/projects/{project}/roadmap`。
5. 调用 `POST /api/cycles/{id}/close` 关闭 Cycle。

## 验证

- Cycle 从 `upcoming` 变为 `active`，最后成为 `closed`；
- `/api/cycles/{id}/memberships` 包含预期 Issue relation；
- Project roadmap 显示相同 Cycle 与成员；
- Issue readiness 仍由 Issue scheduling 负责，而不是第二套 Cycle 状态；
- 关闭 Cycle 不会关闭仍开放的 Issue。继续或恢复工作时，使用各 Issue 自己的命令。

## 故障排查

如果表中步骤仍未解决问题，请先记录 Project、Issue 与 Cycle ID、request route、HTTP
status、error code 与 correlation ID。不要附带 token 或 Issue 内容。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| Relation 请求返回 `invalid_plan_membership` | 请求路径、目标 ID 与两个 Subject 的类型 | 从 Issue 路径发送命令，并把 Cycle ID 作为 `to`；不要反转关系。 |

当前代码不提供旧文档中的 Cycle 页面、Cycle 定时下发、批量 pause/start 或自动结转。
如果需要这些策略，请显式实现，不能假定系统已经完成。

## 下一步

- [创建并跟踪 Issue](/zh/docs/workforce/how-to/create-and-follow-an-issue/)；
- [监控 WorkUnit](/zh/docs/workforce/operating/monitoring-runs/)；
- [使用生成式 API 路由参考](/zh/docs/workforce/reference/routes/)。
