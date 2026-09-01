---
title: "Awaken Workforce 概念"
description: "Issue、Workflow、类型化 Resource、自动化与执行背后的代码实证模型。"
---

## 如何阅读本节

概念页解释面向用户的模型。它们刻意回避内部 ADR 细节，聚焦于操作者与构建者需要理解的内容。

请从[核心概念与关系](/zh/docs/workforce/concepts/core-concepts/)开始，再理解已实现对象和使它们可靠
的契约。

## 价值链:描述 → 建模 → 派生

下面每一页都贯穿着同一条线索。Awaken Workforce 把领域知识变成一层**类型化底座**,你在其上构建的流程、自动化与治理,都是它的推论——而非逐个 workflow 单独接线的功能。

1. **描述领域。** 领域含义存在于 [domain pack](/zh/docs/workforce/concepts/domain-packs) —— 关于你世界里有哪些对象、操作与事件的声明式集合。内核本身领域中立;由 pack 注入语义。*(接近自然语言的纯声明式编写是编写体验的方向;今天 pack 是声明式 YAML 加脚本。)*
2. **编译成对象模型。** 系统将每个「东西」建模为一个类型化的 [`ResourceType`](/zh/docs/objects/concepts/object-model) —— 属性(含 computed getter)、动作(`open_pr`)、事件与生命周期钩子。Agent 面对的是**带操作的类型化对象**,而非一袋扁平工具。
3. **派生工作流与自动化。** [Workflows](/zh/docs/workforce/concepts/workflows) 根据结构化输出路由，[Reactions](/zh/docs/workforce/concepts/reactions) 由类型化事件触发——绝不读取自由文本。“完成”需要已声明的终态 transition 和已配置的 verification，而不只是模型的意见。

一个模型,多处复用:同一个类型化世界驱动工作流、自动化、授权与审计 —— 这正是 [类型系统](/zh/docs/objects/concepts/type-system) 能把每一项承诺称作*推论*的原因:核验一次、处处成立。

## 四组概念

| 分组 | 建议阅读顺序 |
| --- | --- |
| 基础 | [核心概念与关系](/zh/docs/workforce/concepts/core-concepts/) → [基于 Issue 的 Workflow](/zh/docs/workforce/concepts/issue-based-workflows/) → [对象模型](/zh/docs/objects/concepts/object-model/) |
| 工作模型 | [Issue](/zh/docs/workforce/concepts/issues/) → [Intake](/zh/docs/workforce/concepts/intake-lifecycle/) → [Workflow](/zh/docs/workforce/concepts/workflows/) → [组成部分](/zh/docs/workforce/concepts/workflow-parts/) → [Reaction](/zh/docs/workforce/concepts/reactions/) |
| 资源与治理 | [Resource 模型](/zh/docs/objects/concepts/resource-model/) → [授权与 readiness](/zh/docs/objects/concepts/permissions-resources/) → [Credential](/zh/docs/workforce/concepts/credential-custody/) → [Connector](/zh/docs/objects/concepts/connectors/) → [Environment](/zh/docs/workforce/concepts/environments/) → [Domain Pack](/zh/docs/workforce/concepts/domain-packs/) |
| 执行边界 | [Agent、WorkUnit 与 Awaken Run](/zh/docs/workforce/concepts/agents-runs/) |

[类型系统](/zh/docs/objects/concepts/type-system/)是跨领域解释，不是第二份对象清单。精确字段与
枚举属于[参考](/zh/docs/workforce/reference/)和生成的 OpenAPI 契约。
