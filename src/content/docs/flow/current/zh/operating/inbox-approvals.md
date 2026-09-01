---
title: "Needs you、Attention 与审批"
description: "使用 workspace Needs you 视图，处理当前已交付的两种 approval surface，并与 Attention 保持分离。"
---

当人必须决定 Agent 无法安全完成的事项时，打开 Workspace **Needs you**。可以按 Project，
以及 approval、Issue Attention 或 Agent/平台 readiness 筛选。选择交付事项会返回拥有它的
Issue；选择平台 blocker 会打开 Agent Center。这个页面是 projection，不是新的任务或通知生命周期。

UI 读取 workspace Command Center。`GET /api/inbox` 仍是更底层、有界、派生的**开放 attention signal**与**pending subject
approval** feed。它不是持久化 inbox entity，当前也不包含 mention、comment、subscription
或通用 notification。

三个产品边界保持明确：Workforce 拥有 Issue、Attention 与业务 approval；Agents 拥有执行
readiness 与 tool-call control；Objects 拥有可以消除根因的 Resource fact 与 Action。

## Subject approvals

向 `POST /api/issues/{id}/approvals` 提交 `{ "action": "..." }` 请求；再向
`POST /api/approvals/{approval_id}/decide` 提交：

```json
{ "approve": true, "approver": "user:alice" }
```

生命周期为 `pending → approved | denied | expired`。终态 approval 不可再次决定。
可选 `approver` query hint 与 `project` scope 让 operator feed 保持有界、相关。

## Tool-call approvals

受治理 tool call 使用独立 `/api/tool-approvals` surface，以 `tool_call_id` 为 key。Gate
返回 allow、deny 或 require approval；最后一种会持久化 pending approval 并返回 pending
result。Approval 是独立于 WorkUnit lifecycle 的 control state。Approval 后，同一 call
identity 可再次通过 gate 并执行。

向 `POST /api/tool-approvals/{tool_call_id}/decision` 提交：

```json
{ "approve": true }
```

Denial 与 expiry 失败即关闭；timeout 绝不代表 allow。

## Artifact equality

Workflow handoff 可在 named input 上要求 `approved_by`；approval output 必须与当前
artifact value 相等。该引用相等检查已在 typed handoff 中交付：旧 commit/object 的 review
不能授权新版本。

## Attention 不同

Attention 表示必须修复根因；approval 表示具体 obligation 需要 verdict。Acknowledge
attention 不会批准工具，approve tool 也不会 resolve attention。见
[关注与恢复](/zh/docs/workforce/operating/attention-recovery)。

## 在 UI 中验证

- **Needs you** 只显示符合所选 Project 与类型的开放事项；
- approval 与 Attention 使用不同标签和允许动作；
- 空结果只表示没有符合筛选条件的人工决定，不代表所有 Outcome 已经验收；
- 最后一项阻塞 signal 被解决后，进展回到拥有它的 Issue，而不是创建另一份工作记录。
