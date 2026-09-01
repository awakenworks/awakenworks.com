---
title: "为 Awaken Workforce 设计"
description: "把 Agent、Workflow 与 Domain Pack 设计成独立、可组合、带精确 revision 的契约。"
---

设计者定义工作如何运行，但不硬编码某个模型、凭据或部署。三个作者面可以组合，却不会
打包进同一份文档：

| 作者面 | 声明内容 | 当前 API/格式 |
| --- | --- | --- |
| Agent | Discoverability、一种 direct 或 Workflow implementation，以及声明的 Resource/Skill/MCP/workspace access | `/api/projects/{project}/agents/{definition}/revision` |
| Workflow | 不可变 revision；内部 specification 声明 state、slot、requirement、handoff、transition 与 bound | `/api/projects/{project}/workflows/{definition}/revision` |
| 领域对象 | ResourceType facet 与内联 Lua | `PackDescriptor contract_version: 2` 或 Resource API |

## 按此顺序设计

1. 阅读[对象模型](/zh/docs/objects/concepts/object-model)和[authorization、readiness 与
   Resource](/zh/docs/objects/concepts/permissions-resources)。
2. [定义 Agent](/zh/docs/workforce/designing/define-an-agent)：将 identity/prompt 与
   authorization、model routing、credential、worker capacity 分开。
3. [设计 Workflow](/zh/docs/workforce/designing/design-a-workflow)：根据已声明
   event/structured output 路由，明确 requirement 和 recovery path。
4. [开发 Domain Pack](/zh/docs/workforce/designing/develop-a-domain-pack)：建模领域 noun 与
   operation；采用 type 后再创建、绑定 instance。
5. 像测试 happy path 一样认真测试无效输入和缺失 dependency。

优秀 Workforce 设计不依赖 accidental ambient state，因此可移植。Pack 不包含 Agent 或
Workflow specification 不包含 credential，Agent definition 也不会授予访问；scope authority 和
policy 在使用时组合它们，并保持 provenance 与失败证据可见。

创作时请同时打开 [workflow 配置](/zh/docs/workforce/reference/workflow-config)、[structured
hand-off](/zh/docs/workforce/reference/output-contracts)和生成的 [HTTP route](/zh/docs/workforce/reference/routes)。
