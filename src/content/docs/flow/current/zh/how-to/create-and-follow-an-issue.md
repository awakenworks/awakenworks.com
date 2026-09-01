---
title: "创建并跟踪 Issue"
description: "从工作空间创建一个 Issue，按需绑定精确 Workflow，并在工作台中跟踪状态、诊断与证据。"
---

Issue 是 Workforce 中可问责的工作记录。应从 Project 发出创建命令，而不是直接写持久化；之后
继续使用同一个 Issue 详情页跟踪 Workflow 状态、调度诊断、WorkUnit、审批和已接受证据。

## 目标

最终得到一个可见 Issue，并能从 Workforce 工作空间检查它的标题、可选 Workflow binding、
当前状态、下一动作和 worklog。

## 前置条件

- 正在运行的 Workforce 部署与 Web 工作空间；
- 已完成 bootstrap 且就绪的 Project；
- 如果 Issue 不使用默认流程，需要已经安装的 Workflow revision。

通过[源码 Quickstart](/zh/docs/workforce/quickstart/)使用受支持的 Bootstrap service 创建第一个
就绪 Project。

## 1. 创建 Issue

打开 Project 的 **Issues** 页面并选择 **New issue**。输入明确标题，并按需补充描述。
如果选择 Workflow，请等 UI 显示其精确 revision 与 configuration token 后再提交。

选择 **Create issue**。产品用一个命令同时创建 Issue 和所选 Workflow binding，不会建立
客户端影子记录。

## 2. 找到并打开 Issue

使用 Issue 搜索框，或者 list、board、tree 视图。打开 Issue 详情页。页首显示问责 identity
与当前状态；**Next action** 和 **Diagnosis** 说明什么可以继续、什么正在阻塞。

## 3. 跟踪工作与证据

使用 Issue 页上的 Workflow progress、worklog、relationships、approval 与 Agent
conversation。WorkUnit 活动和已接受输出继续属于这个 Issue；摘要视图不会取代它的命令权威。

## 验证

- Workforce 显示 **Issue created** 确认；
- Issue 出现在搜索或所选 Project 视图中；
- 详情页显示相同标题与精确 Workflow binding；
- Next action、Diagnosis 和 worklog 能够加载，且没有客户端影子状态。

预览版本的可执行 UI 验收套件覆盖普通创建、精确 Workflow binding、搜索、分页和加载
期间的 fail-closed 行为。

## 故障排查

如果表中步骤仍未解决问题，请先记录 Project ID、所选 Workflow revision、已返回的 Issue
ID、HTTP status、error code 与 correlation ID。不要附带 token、credential 或 Issue 内容。

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| 创建返回配置错误 | Project readiness 与 Workflow revision | 修复 Project 配置或选择已安装 revision；不要用数据库写入绕过命令。 |
| Issue 详情不可用 | Project scope 与 Issue identity | 返回 Project Issue 列表，重新搜索并重试权威详情读取。 |

## 下一步

- [委托并跟踪 Outcome](/zh/docs/workforce/how-to/manage-outcomes/)。
- [使用 Cycle 规划工作](/zh/docs/workforce/how-to/cycles/)。
- [在不重写 Issue 状态的情况下解决 Attention](/zh/docs/workforce/operating/attention-recovery/)。
