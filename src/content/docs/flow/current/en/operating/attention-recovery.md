---
title: "Attention and recovery"
description: "Use the typed attention registry and resolve work in place without rewriting its business state."
section: "Use"
subsection: "Decide and recover"
order: 41
---

Awaken Workforce makes non-progress explicit. An attention signal is durable, typed,
and shown in the derived inbox; it is a **scheduling overlay**, not a workflow
state. The Subject keeps its business state underneath, so resolving the signal
removes the hold without a budget-reset re-entry.

## Signal lifecycle

Signals move through `open → acknowledged → resolved`. Acknowledgement means “seen,”
not “fixed”: both `open` and `acknowledged` continue to hold scheduling. Only
`resolved` clears the overlay.

Use:

- `GET /api/inbox?project={project}&limit={n}` for attention plus approvals;
- `GET /api/attention-signals` for the attention queue;
- `GET /api/issues/{id}/attention` for one Issue;
- `POST /api/attention/{signal_id}/status` with
  `{ "status": "acknowledged" }` or `{ "status": "resolved" }`.

## Exact reason codes

The code registry is exhaustive; an undeclared string is rejected with `422`.

| Class | Codes |
| --- | --- |
| Execution/configuration | `execution_failed`, `execution_configuration_invalid`, `acp_launch_failed`, `script_runtime_failed` |
| Bounded termination | `max_attempts_exhausted`, `run_deadline_exceeded`, `handshake_timeout`, `stall_timeout` |
| External availability | `service_unreachable`, `provider_unavailable`, `mcp_unreachable` |
| Workflow/dependency | `awaiting_dependencies`, `blocked_on_review`, `prerequisite_canceled`, `output_contract_violated` |
| Shared resources | `credential_exhausted`, `no_capable_worker` |

The API enriches every signal with the registry's operator-facing label, remedy,
and behavior. Use that remedy rather than guessing from a transcript.

## Behavior classes

- `converges_to_attention`: a deterministic or exhausted condition requires a human.
- `self_healing`: a transient condition is retried and names the code it escalates to.
- `violation`: a declared contract breach follows its policy.
- `shared_resource`: one aggregate signal is keyed by the failed credential or worker
  resource; Workforce refuses to create one copy per Issue.

Resolve a shared-resource signal only after verifying that the named resource is
healthy; the same resolution clears its scheduling overlay for affected work.

## Recovery procedure

1. Read `reason_code`, `label`, `remedy`, and the Issue's unchanged scheduling state.
2. Fix the named cause—for example restore the provider route, credential, worker,
   MCP server, or workflow definition.
3. Acknowledge while investigating if useful; do not re-dispatch yet.
4. Resolve only after the cause is actually gone.
5. Re-dispatch or use the audited WorkUnit controls if execution must run again.

To abandon the work, use the Issue or WorkUnit cancel endpoint. Cancellation is a
real terminal decision; resolving attention is not.
