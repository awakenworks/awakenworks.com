---
title: "Workflow 的组成"
description: "State、责任、类型化端口、transition、handoff、Issue 分解与执行边界。"
---

Workflow 作者声明包含可发现性元数据、`start`、`states` map，以及可选的 Workflow
`inputs`、`requires`、`outputs` 和 `max_iterations`。每个 state 声明 `state_group`、
`completion`、transition，以及可选的 instruction、delivery、Agent session/tool profile、
responsibility slot、类型化输入/输出与 `wip_limit`。

## 责任与并行工作

一个 state 最多一个可问责 `executor`。slot 可以指向 Actor / Team selector，或
`workflow.requires.<role>` 中的 Agent role。非 executor slot 可记录 reviewer、approver、
aggregator 或 custom responsibility。

需要并行或运行时才可发现的分支时，Executor 将 Issue 分解为子 Issue。依赖拥有 fan-in：
最后一个子 Issue 完成使父 Issue ready，父级下一 WorkUnit 再显式消费已接受的子输出。
不存在 `join_policy` 或按 slot 编号的隐藏分支。

## 类型化数据与 transition

State input 只指向一个权威来源：Workflow input/requirement 或之前的 state output。
State output 是类型化值或精确 Resource realization。Workflow output 投影声明的终态输出，
形成根 Outcome 验收契约。CEL transition predicate 读取结构化上下文，首个匹配生效；有环图
必须声明 `max_iterations`。

每个 executor state 声明 `spec_delivery`：`inline` 在 instruction 中包含 Issue brief，
`query` 则通过受治理 Issue 读取面提供。WIP limit 阻止 dispatch；运行时 lease、claim、retry
和 recovery 属于 Awaken，不是 Workflow 字段。
