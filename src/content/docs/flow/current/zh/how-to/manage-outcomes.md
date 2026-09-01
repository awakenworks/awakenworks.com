---
title: "委托并跟踪 Outcome"
description: "委托一个可问责结果，跟踪子工作，并核验已接受输出与 Resource 证据。"
---

当你需要一个被验收的业务结果，即使 Agent 需要发现并协调多项工作才能交付，也应使用
Outcome。

## 目标

最终得到一个 Outcome，并能把已接受交付物追溯到根 Issue、子工作，以及精确值或
Resource 证据。

## 前置条件

- Workforce 工作空间中有一个就绪 Project；
- 有一个适合根 Issue 的已安装 Workflow；
- 验收边界已经说明结果及其必需交付物。

## 在 Console 中从哪里查看

- Workspace **Home** 委托结果，并显示它属于 Needs you、In progress 还是 Blocked。
- Project **Outcomes** 按 open、accepted 或 canceled 状态列出已委托结果。
- **Outcome Review** 将正式交付物与 supporting Issue、技术执行细节分开；只有 Workflow
  已进入 review 且交付物齐备时，才开放业务 transition。

Workforce 拥有这些工作与验收视图。Agents 拥有 WorkUnit 使用的 Session、Run、Worker、
Sandbox 与执行历史；Objects 拥有作为交付物的精确 Resource snapshot 和外部事实。评审界面
组合这些记录，但不会复制它们的权威。

## 1. 委托并跟踪结果

1. 打开 workspace **Home**，选择 **Commission an outcome**。
2. 描述结果和验收边界，预览持久 Issue 后再委托。Workforce 创建一个带精确 Workflow 绑定的根 Issue。
3. 从 Home 或 Project **Outcomes** 跟踪 Outcome 卡片。阶段和进度由根 Issue 与递归可达的子 Issue 投影而来，不是第二套状态。
4. 工作受阻时打开 Issue 图。依赖根可以并行执行，后继等待；前置取消会要求处理 Attention。
5. 全部子 Issue 完成后，根 Issue 应变为 ready，而非 completed；根 Agent 仍需整合已接受输出和精确 Resource。
6. 打开 **Outcome Review** 并检查 `acceptance_deliverables`：`pending` 表示没有根 Issue 已接受的 fulfillment；
   `fulfilled` 表示证据已存在但根 Issue 仍 open；`accepted` 表示 completed 根 Issue
   已验收该精确值或 Resource snapshot。
7. 确认 `acceptance_summary.complete`，并且每项承诺交付都存在后，再通过
   review / 人工验收 transition。canceled Outcome 不是已验收结果。

## 验证

- Outcome 解析到一个根 Issue，而不是第二份工作记录；
- progress 与递归可达的子 Issue 一致；
- 每个必需 deliverable 都是 `accepted`，而不只是 `fulfilled`；
- 人工验收前 `acceptance_summary.complete` 为 true。
- Outcome Review 仍把 supporting work 标成证据，而不是正式验收边界。

## 在不改变含义的前提下重试分解

完全相同的分解请求会返回同一批子 Issue。提议图发生变化时，Workforce 会拒绝冲突重试，
而不是改写执行证据。将变化后的图作为一个明确的新命令提交。重新打开或恢复必须使用
Issue 的治理命令，不要直接修改关系或持久层。

高级集成可以读取 `GET /api/projects/{project}/outcomes` 或
`GET /api/outcomes/{id}`。这些只读端点从既有的 Issue、Workflow、关系、输出与 Resource
权威重新构建视图，不提供另一条 Outcome 命令或修复路径。

## 下一步

- [创建并跟踪 Issue](/zh/docs/workforce/how-to/create-and-follow-an-issue/)；
- [解决 Attention](/zh/docs/workforce/operating/attention-recovery/)；
- [查看 Workforce API 路由](/zh/docs/workforce/reference/routes/)。
