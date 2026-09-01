---
title: "Troubleshooting"
description: "Act on a surfaced Workforce failure that cannot converge without configuration or workflow correction."
section: "Operate"
subsection: "Operations"
order: 30
---

Start from the exact API error or Attention remedy; do not diagnose from a
summary. Queued work, a pending approval, a live lease, or a temporarily blocked
dependency is not by itself a fault. Workforce polls queued work, bounds eligible
local execution, and re-evaluates dependency recovery without a manual repair
command.

If the actions below do not resolve the failure, record the Workforce version,
topology, route, HTTP status and error code, Project/Issue/WorkUnit/Run IDs, and
correlation ID. Remove tokens, credentials, message content, and secret-bearing
URLs before sharing the evidence.

| Symptom | Inspect | Likely action |
| --- | --- | --- |
| Process exits before `/healthz` becomes available | stderr and the exact configuration field named in the startup error | Correct the named seal-key, database, or schema condition; use the [deployment topology guide](/docs/workforce/operating/deployment-topologies/) rather than changing stores directly. |
| Dispatch returns `execution_gated` and its detail names a missing Agent revision, model route, provider, credential, or Resource | The returned detail and the Project's execution-readiness response | Complete the missing governed join, then retry the same public command. Do not bypass admission with a database write. |
| Issue shows an open Attention signal with a concrete `reason_code` and `remedy` | The signal and the current authoritative resource or configuration state | Follow [Attention recovery](/docs/workforce/operating/attention-recovery/); resolve the signal only after the named condition is repaired. |
| A transition request returns `no_transition` | Current Issue state, submitted event, and the pinned Workflow revision | Submit an event declared from that state, or save a reviewed Workflow revision for future Issues. Do not infer or patch an edge. |

Use `/healthz` for liveness, `/metrics` for Prometheus counters, and
`/api/openapi.json` for the exact route contract of the running binary.
