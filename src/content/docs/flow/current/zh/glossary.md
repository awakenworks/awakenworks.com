---
title: "术语表"
description: "与代码对齐的 Awaken Workforce 工作、执行、Resource、治理和 Pack 术语。"
---

**Subject** — 共享的 durable work family；当前 kind 为 Issue、Cycle、Release。

**Issue** — 创建时固定精确 Workflow revision（或使用内置 lifecycle）的工作 Subject。

**Cycle** — 具有内置 `upcoming → active → closed` lifecycle 的 planning Subject。

**Workflow / WorkflowRevision** — 面向用户的一等工作定义及其不可变精确 revision。内部 `ProcessSpec` specification 表达 start state、state、transition、slot、requirement、produced hand-off 和可选 bound。

**Actor** — User、Agent 或 Team identity。Team 用于 participation/selection，不会自动授予 authorization。

**AgentDef** — 挂在 Agent Actor 上的当前 HTTP 定义：`role_prompt` 与可选 `model`。

**Assignment** — Subject state slot 与 Actor 之间的 active link。

**WorkUnit** — 一次执行 attempt；status 为 `queued`、`active`、`succeeded`、`failed` 或 `cancelled`。

**RuntimeLease** — 限定一个 worker 执行与 egress 的 live、会过期 authority。

**AttentionSignal** — 带注册 reason code 的机器可读运营 hold；status 为 `open`、`acknowledged` 或 `resolved`。

**Subject approval** — 针对 Issue action 的 approval；与 tool-call approval 分开。

**Inbox** — 当前 open attention 与 pending subject approval 的 projection；不包含 comment、mention 或 notification。

**ResourceType** — 带 revision 的 typed declaration，包含 property/action/event/lifecycle 等 facet。

**Resource** — 某个 ResourceType revision 的具名 instance。

**ResourceBinding** — 以 handle 在 scope 暴露 Resource 的 availability row。

**ResourceLink** — 从一个 Resource 到另一个 Resource 的 role-named relation。

**Managed credential** — Vault 中与 provider reference 关联的 secret；API 返回 metadata，不返回 secret value。

**Domain Pack** — 包含精确 ResourceType、Workflow、Automation 与 Agent 定义的签名不可变 V2 release；不包含 instance、credential 或运行状态。

**GitRef / `evidence_refs`** — 只有 Workflow/Resource model 显式声明时才成立的 coding-domain output 约定，不是 Workforce 内建类型。
