---
title: "Needs you, attention, and approvals"
description: "Use the workspace Needs you view, decide the two approval surfaces that currently ship, and keep approvals separate from attention."
section: "Use"
subsection: "Decide and recover"
order: 40
---

Open Workspace **Needs you** when a person must decide what Agents cannot safely
complete on their own. Filter by Project and by approval, Issue Attention, or
Agent/platform readiness. Selecting a delivery item returns to the owning Issue;
selecting a platform blocker opens Agent Center. The page is a projection, not a
new task or notification lifecycle.

The UI reads the workspace Command Center. `GET /api/inbox` remains the bounded,
lower-level derived feed of **open attention signals** and
**pending subject approvals**. It is not a stored inbox entity and currently does
not include mentions, comments, subscriptions, or general notifications.

The three-product boundary remains explicit: Workforce owns the Issue,
Attention, and business approval; Agents owns execution readiness and tool-call
control; Objects owns the Resource facts and Actions whose state may resolve the
underlying cause.

## Subject approvals

Request with `POST /api/issues/{id}/approvals` and `{ "action": "..." }`.
Decide with `POST /api/approvals/{approval_id}/decide`:

```json
{ "approve": true, "approver": "user:alice" }
```

The lifecycle is `pending → approved | denied | expired`. A terminal approval
cannot be decided again. The optional `approver` query hint and `project` scope keep
operator feeds bounded and relevant.

## Tool-call approvals

Governed tool calls use the separate `/api/tool-approvals` surface, keyed by
`tool_call_id`. A gate can return allow, deny, or require approval. In the last case
Workforce persists a pending approval and returns a pending result. Approval remains a
separate control state from the WorkUnit lifecycle. After approval, the same call
identity can be re-issued through the gate and executed.

Decide with:

```json
{ "approve": true }
```

at `POST /api/tool-approvals/{tool_call_id}/decision`. Denial and expiry fail
closed. Timeout never means allow.

## Artifact equality

Workflow hand-off can require `approved_by` on a named input. The approving output
must equal the current artifact value. This reference-equality check ships in typed
hand-off: a review of an older commit or object cannot authorize a newer one.

## Attention is different

Attention means the underlying cause must be fixed; approval means a specific
obligation needs a verdict. Acknowledging attention does not approve a tool, and
approving a tool does not resolve attention. See
[Attention and recovery](/docs/workforce/operating/attention-recovery).

## Verify in the UI

- **Needs you** shows only open items matching the selected Project and type;
- approval and Attention keep distinct labels and permitted actions;
- an empty result says that no human decision matches the filters—it does not
  claim that every Outcome is accepted;
- resolving the final blocking signal returns progress to the owning Issue rather
  than creating another work record.
