---
title: "管理日常工作"
description: "优先在 Workforce 工作空间完成日常工作，进阶集成再进入 API 参考。"
---

默认从产品界面开始。Workspace 主导航是 Home、Chats、Work、Objects 与 Library；Project
交付包含 Overview、Outcomes、Canvases 与 Issues；高级配置包含 Planning、Workflows、
Automations 与 Build；Operations 包含 Runs 与 Agent Center。生成的 API 是自动化与集成契约，
不是解释用户任务的默认入口。

| 任务 | 从这里开始 |
| --- | --- |
| 委托并验收一个结果 | [委托并跟踪 Outcome](/zh/docs/workforce/how-to/manage-outcomes) |
| 进入工作空间与项目 | [源码快速开始](/zh/docs/workforce/quickstart) |
| 创建并跟进 Issue | [创建并跟踪 Issue](/zh/docs/workforce/how-to/create-and-follow-an-issue) |
| 跨 Project 处理需要人介入的事项 | 打开 Workspace **Work**，按决定类型筛选，再进入拥有该决定的 Issue 或 Agent Center |
| 查看一项 Issue 为何无法推进 | 打开 Issue 详情中的 diagnosis 与 scheduling 区域 |
| 自由对话后创建可问责工作 | 打开 Workspace **Chats**，选择目标 Project，审阅拟议命令，再进入 owner receipt 指向的对象 |
| 检查或操作业务数据 | 打开 Workspace **Objects**，选择对象类型，再查看数据、关系与 Pack 定义的 Action |
| 检查证据或恢复工作 | 使用 Issue worklog、attention action 与 run control |
| 创作并绑定 workflow | [设计工作流](/zh/docs/workforce/designing/design-a-workflow) |
| 定义 Agent | [定义 Agent](/zh/docs/workforce/designing/define-an-agent) |
| 配置 Agent execution 与 credential | [定义 Agent](/zh/docs/workforce/designing/define-an-agent)与[凭据监管](/zh/docs/workforce/concepts/credential-custody) |
| 建模并分发领域定义 | [开发 Domain Pack](/zh/docs/workforce/designing/develop-a-domain-pack) |
| 发布、导入并采用 Pack | [发布并安装 Domain Pack](/zh/docs/workforce/how-to/publish-a-pack) |
| 监控与 steering | [监控 WorkUnit](/zh/docs/workforce/operating/monitoring-runs) |
| 处理权限 | [Inbox 与 approvals](/zh/docs/workforce/operating/inbox-approvals) |
| 恢复无进展 | [关注与恢复](/zh/docs/workforce/operating/attention-recovery) |
| 规划一批工作 | [使用 Cycle](/zh/docs/workforce/how-to/cycles) |

进阶诊断时，依次查看 Issue scheduling projection、WorkUnit 与 event stream，再检查 frozen
execution snapshot 与 Resource join。通过界面同样调用的 approval、attention 或 WorkUnit
command 操作，绝不直接编辑 persistence。

当前 onboarding 边界需要明确：第一个 Project 使用 `awaken-flow project bootstrap` 创建。
该命令调用 integration 共用的唯一 Bootstrap API，不 seed persistence。Attention 通过运营指南
所列出的 Issue 与 control API 处理。
