---
title: "Parts of a workflow"
description: "States, responsibilities, typed ports, transitions, hand-offs, Issue decomposition, and execution bounds."
section: "Understand"
subsection: "Work model"
order: 23
---

A Workflow author declaration contains discoverability metadata, `start`, a
`states` map, and optional workflow `inputs`, `requires`, `outputs`, and
`max_iterations`. Each state declares `state_group`, `completion`, transitions,
and optional instruction, delivery, Agent session/tool profile, responsibility
slots, typed inputs/outputs, and `wip_limit`.

## Responsibility and parallel work

A state has at most one accountable `executor`. A slot either targets an Actor / Team
selector or an Agent role from `workflow.requires.<role>`. Non-executor slots may
record reviewer, approver, aggregator, or custom responsibility.

When work needs parallel or runtime-discovered branches, the Executor decomposes
the Issue into child Issues. Dependencies own fan-in: finishing the last child
makes the parent ready, and the next parent WorkUnit explicitly consumes accepted
child outputs. No `join_policy` or slot-indexed branch exists.

## Typed data and transitions

State inputs name one canonical source: a Workflow input/requirement or an earlier
state output. State outputs are typed values or exact Resource realizations.
Workflow outputs project declared terminal state outputs and form the root
Outcome acceptance contract. CEL transition predicates read structured context;
the first match wins. Cyclic graphs require `max_iterations`.

Every executor state declares `spec_delivery`: `inline` includes the Issue brief in
the instruction; `query` makes it available through the governed Issue read
surface. WIP limits gate dispatch. Runtime lease, claim, retry, and recovery remain
Awaken responsibilities, not Workflow fields.
