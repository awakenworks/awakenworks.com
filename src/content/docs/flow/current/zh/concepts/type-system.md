---
title: "作为运营契约的类型"
description: "Awaken Workforce 在哪些位置使用 closed enum、schema、reference、revision 与 reason code 让工作可检查。"
---

Awaken Workforce 使用类型把控制决策移出 prompt 和命名约定。只有当一项
检查的输入、结果、权力和受影响 revision 都能被机器验证时，它才能安全地自动推进工作。
“Typed”并不表示所有 output 都有一套通用 JSON Schema，而表示每个边界验证它真正拥有的结构。

## 类型在哪里承载权威

| 边界 | 示例 |
| --- | --- |
| 工作生命周期 | `state_group`、`completion`、已声明 transition 与 CEL guard |
| Assignment | Slot responsibility，以及 `actor` 或 `by_team` selector |
| Hand-off | 类型化 state `outputs`、下游 state `inputs.from`、终态 Workflow `outputs` |
| Execution | Closed WorkUnit status、event/state trace、lease identity/version |
| Operations | 已注册 attention reason code、显式 signal/approval status |
| Resource catalog | Category、data class、facet schema、typed value、revision reference |
| Script | Engine/lane、已声明 input/output schema、sandbox admission |
| Access | Principal、action、scope、role binding、visibility projection |

这种结构让失败有明确位置：无效 Workflow specification 在 admission 失败；无法解析的 slot 或
Resource hold readiness；被拒 action 在 authorization 失败；高风险具体 call 可等待
approval；attempt 耗尽或执行不可达会产生 attention 证据。这些 gate 相互关联，但不是
一个可互换的“权限”结果。

## 作者规则

只声明当前契约支持的内容。不要从 `review` 之类 state name 推断行为，不要虚构
`output_contract`，也不要把名为 `git_ref` 的字段当作 Workforce 内建类型。具名值放入
类型化值放入 state `outputs`，精确对象身份放入 Resource realization port，领域校验放入
Resource schema/script 或显式 verification checkpoint。

实际收益是可解释性：人可以检查系统决策时使用的同一份 state、reference、reason 与
revision。继续阅读[对象模型](/zh/docs/objects/concepts/object-model)和[authorization、
readiness 与 Resource](/zh/docs/objects/concepts/permissions-resources)。
