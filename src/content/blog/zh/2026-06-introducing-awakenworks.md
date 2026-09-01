---
title: Agent 产品想长期运行，先把什么做好
description: 从一项可恢复的任务、一份已提交历史，以及产品体验与 Agent 执行之间的清楚边界开始。
date: 2026-06-21
tags: [发布, 技术栈]
author: AwakenWorks
lang: zh
---

让 Agent 回答一次，是一个有用的原型。下一步，是让工作不依赖某个浏览器标签页或 Worker
进程。用户离开以后可以回来，处理一次审批，并从原处继续，而不是让 Agent 重新开始。

AwakenWorks 从这里开始：让长时间运行的 Agent 工作可以恢复、可以检查，并始终由运营者
掌控。

## 先选一项必须恢复的任务

先选一项有明确完成条件的任务。例如，让 Agent 准备一次修改，在敏感工具调用前暂停，由
人批准，再交付结果和生成的文件。然后要求同一项任务在客户端断开或 Worker 重启后仍能
继续。

应用拥有自己的业务领域，Awaken 拥有持久 Agent 执行。应用仍然决定 Project、Mission、
评审和验收结果对用户意味着什么；Awaken 保存支撑这项工作的 Session、Run、已提交事件、
Files、权限、Worker 租约、Sandbox 策略与恢复路径。

## 用一个 Session 跑通

[Awaken Agents](/zh/agents) 是开放、可自托管的 Agent 执行服务。受支持协议、兼容 Agent、
隔离 Worker、持久 Session 与带审批的工具，共用一条位于你自己基础设施内的执行边界。

第一条路径按这个顺序完成：

1. 发布或选择 Agent 及其 Environment；
2. 通过受支持的客户端契约创建 Session；
3. 由 Worker 执行 Run，并提交事件、Files 与终态；
4. 实时连接或进程消失后，从已提交事实重连；
5. 检查执行记录，再由应用判断结果是否达到完成条件。

Awaken 不要求产品应用保存第二份 Transcript，也不要求它再造一套重试循环。

## 任务确实需要时，再扩展 Agent loop

[Awaken Agents 内部机制](/zh/docs/agents/runtime)包含 Rust 执行内核。
贡献者和需要深度嵌入的团队可以使用 typed tool、committed state、phase hook、tool gate 与
可插拔 executor 控制 Agent loop。它是一条扩展边界，不是第二个公开产品，也不是另一份
执行事实。

## 一个 Session 不够时，再增加跨团队 Workflow

当一项工作跨越多次 Run、多人和多个业务系统，产品还需要知道下一步由谁负责，以及哪个
外部结果才能真正结束工作。[Awaken Workforce](/zh/workforce) 用 revisioned Workflow、typed
Resource、授权、审批、Attention、审计与 lease-bound Worker 探索这一层。
有明确工作需求的团队可以申请聚焦的提前体验；第一项 Agents 任务并不依赖 Workforce。

## 跑一次中断与重连

Awaken 采用 Apache-2.0，可以自托管。完成[快速开始](/zh/docs/agents/get-started)，运行
一个 Session，中断客户端后重新连接，确认同一份已提交记录仍然存在。[关键架构](/zh/docs/agents/concepts/architecture/)
说明每一部分由谁负责，[兼容矩阵](/zh/docs/agents/compatibility/)列出受支持的客户端边界。
如果这正是你需要的执行基础，可以[查看源码并 Star Awaken](https://github.com/AwakenWorks/awaken)。
