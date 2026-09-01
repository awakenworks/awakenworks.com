---
title: "设计 Workflow"
description: "把验收边界写成一个不可变 Workflow，并用子 Issue 表达动态并行工作。"
---

先定义根 Outcome 的验收契约，再描述达到它所需的稳定业务状态。

1. 为 Workflow、state 与 transition 提供 name、description 和 icon。选择一个 start；终态使用
   `completion: completed` 或 `canceled`，且没有出边。
2. 每个 state 最多声明一个 `executor`。需要可移植定义时，通过 Workflow requirement 引用
   Pack Agent。reviewer、approver、aggregator 与 custom responsibility slot 不是额外分支。
3. 声明类型化 Workflow input/requirement、state input/output 与终态 Workflow output。
   这些契约而不是 prose 负责数据传递和 Outcome 验收。
4. 用结构化上下文上的有序 CEL predicate 路由，首个匹配生效；有环图必须用
   `max_iterations` 设界。
5. 动态并行工作由 Planner 调用 `issue.decompose`。不要把并行分支表达成多个 Executor 或
   join policy；每个子 Issue 都可独立查看、分配、重试、取消和审计。
6. preview 并保存作者声明。保存会解析符号化 Pack 引用、验证唯一内部 `ProcessSpec`、创建或
   复用不可变 revision，并用 CAS 更新 Project override。

Executor state 仅在 instruction 包含 Issue description 时使用 `spec_delivery: inline`，否则
使用 `query`。`wip_limit` 限制该 state 中同时活跃的 Issue 数量，不用于创建分支并发。

保存后，委托一个根 Issue，并检查固定 revision、Issue DAG、WorkUnit、已接受输出与最终
Outcome 投影。精确格式见 [Workflow 作者契约](/zh/docs/workforce/reference/workflow-config)。
