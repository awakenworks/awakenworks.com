---
title: "结构化输出与 handoff"
description: "类型化 Workflow input、state output、下游 source 与终态验收投影。"
---

WorkUnit 发出结构化输出；Workforce 按 state 声明的 `outputs` map 验证并保存已接受 state output。
每个 port 或为类型化值（`type`、可选对象 `properties` / 数组 `items`、可选封闭
`variants`），或为精确 Resource `attest` / `construct` realization。

下游 state 声明 `inputs`，每项只有一个 `from` source：

- `workflow.inputs.<port>` 或 `workflow.requires.<role>`；
- `states.<state>.outputs.<port>`。

`required: true` 在值存在前阻止 dispatch。`approved_by` 指向已接受 state-output，并要求
与获批 artifact 相等，旧 approval 不能授权新 revision。

顶层 Workflow `outputs` 投影精确 `states.*.outputs.*` port，形成 Outcome 验收契约。拼接
子输出或仅观察全部子 Issue 完成都不代表验收；父级 Executor 必须读取子 Issue 终态输出、
整合后产出自己声明的根输出。

Outcome read model 只求值一次该契约，并暴露：

- `acceptance_deliverables[]`：`output_id`、精确 Workflow output `contract`、可选
  `fulfillment`（`value` 或精确 Resource `snapshots`）与 `acceptance_state`；
- `acceptance_summary`：`total`、`fulfilled` 与 `complete`。

派生状态表是封闭的：open + 缺失为 `pending`；open + 存在为 `fulfilled`；
completed + 存在为 `accepted`；canceled 无论是否存在 fulfillment 都为
`canceled`。completed + 缺失是 integrity failure。只有根 Workflow `from` 指定的
已接受 state-output envelope 能 fulfill 契约；latest Run result 或子 output 不能代替。

封闭 `variants` 支持发布期 transition coverage。Shape enforcement 属于类型化 port、
Resource schema/realization 与 transition validator；不存在并行 `produces`、state 级下游
`requires` 或通用 `output_contract` 格式。

见 [Workflow 作者契约](/zh/docs/workforce/reference/workflow-config)。
