---
title: "Design a workflow"
description: "Turn an acceptance boundary into one immutable Workflow and use child Issues for dynamic parallel work."
section: "Design"
subsection: "Design work"
order: 11
---

Start with the root Outcome's acceptance contract, then define only the stable
business states needed to reach it.

1. Give every Workflow, state, and transition a name, description, and icon.
   Choose one start state and mark terminal states with `completion: completed`
   or `canceled` and no outgoing transitions.
2. Declare at most one `executor` per state. Reference a Pack Agent through a
   Workflow requirement when the definition must be portable. Reviewer,
   approver, aggregator, and custom responsibility slots are not extra branches.
3. Declare typed Workflow inputs and requirements, state inputs and outputs, and
   terminal Workflow outputs. These contracts—not prose—carry data and define
   Outcome acceptance.
4. Route with ordered CEL predicates over structured context. The first match
   wins. Bound every cyclic graph with `max_iterations`.
5. For dynamic parallel work, let the Planner call `issue.decompose`. Do not
   model parallel branches as multiple Executors or a join policy. Each child is
   independently visible, assignable, retryable, cancelable, and auditable.
6. Preview and save the author declaration. Saving resolves symbolic Pack
   references, validates the one internal `ProcessSpec`, creates or reuses an
   immutable revision, and CAS-updates the Project override.

For an executor state, choose `spec_delivery: inline` only when its instruction
contains the Issue description; otherwise use `query`. Use `wip_limit` to cap
how many Issues can be active in that state—not to create branch concurrency.

After saving, commission a root Issue and inspect the pinned revision, Issue DAG,
WorkUnits, accepted outputs, and final Outcome projection. See the exact
[Workflow author contract](/docs/workforce/reference/workflow-config).
