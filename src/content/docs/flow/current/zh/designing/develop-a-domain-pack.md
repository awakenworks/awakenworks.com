---
title: "开发 Domain Pack"
description: "在编写唯一 PackDescriptor 前，确定组合边界、精确 component owner 与依赖方向。"
---

只使用一个 `PackDescriptor contract_version: 2`，不要创建第二套 manifest 模型。先选择 Pack
组合 tier 与稳定责任：

- Foundation 定义可复用 ResourceType 与 capability contract。
- Integration 拥有外部系统适配，且只向下依赖。
- Domain 组合可复用业务 ResourceType、Workflow、Automation、Agent 与 Environment。
- Solution 提供一个端到端安装和有界用户选择；不能依赖另一个 Solution。

每个定义留在权威 owner：ResourceType 拥有对象 schema 与行为；Workflow 拥有可问责状态和
类型化 handoff；Automation 拥有 `on → when → then`；Agent 拥有可执行组合和声明式 Resource
access；Environment 拥有可移植执行配置。Resource 实例、credential、model route、activation
与运行状态不是可移植 component。

Draft 验证必须按需通过严格 descriptor shape、精确依赖闭包、tier 方向、五个 owner admission、
原子安装、Bootstrap plan 与已配置交互证据。发布是独立且需 review 的 transition；import
是完整的，而 adoption 选择显式 roots。

唯一动手入口：[编写并验证 Pack](/zh/docs/workforce/how-to/author-a-domain-pack)。
