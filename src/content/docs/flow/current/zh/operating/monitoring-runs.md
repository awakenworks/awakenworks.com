---
title: "监控 WorkUnit 与 lease"
description: "通过当前 API 区分 queue state、execution event、control state、scheduling overlay 与 worker health。"
---

当前仓库没有 `/runs` 或 `/compute` UI。请通过 API 与 metrics 监控，并把五类真相分开。

| 问题 | Surface |
| --- | --- |
| 此 Issue 有哪些尝试？ | `GET /api/issues/{id}/work-units` |
| WorkUnit 生命周期 status？ | `GET /api/work-units/{id}` |
| 发生了什么？ | `GET /api/work-units/{id}/events` 或 `/events/stream` |
| Event 折叠出的 phase/output/cost？ | `GET /api/work-units/{id}/state` |
| Issue 为什么不能 dispatch？ | `GET /api/issues/{id}/scheduling` |
| 注册了哪些 worker？ | `GET /api/scopes/{scope}/workers` |
| 什么需要人工处理？ | `GET /api/inbox` 与 `/api/tool-approvals` |
| 服务是否存活？ | `GET /healthz`；采集 `/metrics` |

## 生命周期

WorkUnit status 恰好是 `queued`、`active`、`succeeded`、`failed`、`cancelled`。
`queued` 尚未取得 lease；`active` 已被 claim，live authority 由独立 lease 表达。
Approval、pause、interrupt 出现在 event 与折叠 control state 中，不是额外 status。

## Scheduling

Issue scheduling projection 可以是 `backlog`、`ready`、`running`、
`blocked_by_dependency`、`attention`、`waiting_on_resource`、`closed`；“为何等待”应在
这里表达。`wip_limit` 在 enqueue 时执行；Agent/model/provider/credential 无法解析会在
插入 queue 前让 dispatch 失败。

## Lease 与有界失败

Worker 打开并 heartbeat runtime lease。Reaper 分别覆盖：claim 后未开 lease
（`handshake_timeout`）、lease 失效/过期（`run_deadline_exceeded`）、持续 heartbeat 但
超过 stall ceiling（`stall_timeout`）。它们会收敛，而不会留下含糊 active row。

## 实时控制

使用 WorkUnit 子资源 `/message`、`/pause`、`/resume`、`/interrupt`、`/redirect`、
`/cancel`。控制是带 operator provenance 的 authored event。只有 cancel 终结 WorkUnit；
终态 run 拒绝后续控制。
