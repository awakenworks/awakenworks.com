---
title: "Monitor WorkUnits and leases"
description: "Use the current API to distinguish queue state, execution events, control state, scheduling overlays, and worker health."
section: "Use"
subsection: "Follow work"
order: 31
---

The current repository has no `/runs` or `/compute` UI. Monitor through the API
and metrics, keeping five different kinds of truth separate.

| Question | Surface |
| --- | --- |
| What attempts belong to this Issue? | `GET /api/issues/{id}/work-units` |
| What is this WorkUnit's lifecycle status? | `GET /api/work-units/{id}` |
| What happened? | `GET /api/work-units/{id}/events` or `/events/stream` |
| What phase/output/cost folds from events? | `GET /api/work-units/{id}/state` |
| Why can the Issue not dispatch? | `GET /api/issues/{id}/scheduling` |
| Which workers are registered? | `GET /api/scopes/{scope}/workers` |
| What needs a human? | `GET /api/inbox` and `/api/tool-approvals` |
| Is the service alive? | `GET /healthz`; scrape `/metrics` |

## Lifecycle

A WorkUnit status is exactly `queued`, `active`, `succeeded`, `failed`, or
`cancelled`. `queued` has not acquired a lease. `active` has been claimed; live
authority is the separate lease. Approval, pause, and interrupt appear in events and
folded control state, not as additional statuses.

## Scheduling

An Issue's scheduling projection can be `backlog`, `ready`, `running`,
`blocked_by_dependency`, `attention`, `waiting_on_resource`, or `closed`. This is
where “why is it waiting?” belongs. `wip_limit` is enforced at enqueue. Missing
Agent/model/provider/credential resolution fails dispatch before queue insertion.

## Leases and bounded failure

The worker opens and heartbeats a runtime lease. A reaper covers three distinct
failure legs: no lease after claim (`handshake_timeout`), dead/expired lease
(`run_deadline_exceeded`), and a heartbeating run past the stall ceiling
(`stall_timeout`). These converge instead of leaving an ambiguous active row.

## Live control

Use the WorkUnit subresources `/message`, `/pause`, `/resume`, `/interrupt`,
`/redirect`, and `/cancel`. Controls are authored events with operator provenance.
Only cancel terminalizes the WorkUnit; terminal runs refuse further control.
