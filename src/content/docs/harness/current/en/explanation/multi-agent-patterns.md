---
title: "Choose one multi-Agent collaboration boundary"
description: "Use child delegation, independent Runs, or durable cross-Thread delivery according to the lifetime of the work."
evidence:
  - "crates/runtime/awaken-runtime-contract/src/delegation.rs"
  - "crates/runtime/awaken-runtime-contract/src/tool_batch.rs"
  - "crates/runtime/awaken-runtime/src/engine/delegation.rs"
section: "Understand"
order: 20
---

Do not begin with Agent roles. Begin with the lifetime of the work and the result
the caller needs. Awaken Agents has three collaboration boundaries; they reuse ordinary
Runs and do not create a second execution engine.

## Choose the mechanism

| Work to coordinate | Use | The caller receives |
| --- | --- | --- |
| one bounded subtask whose result belongs in the current model turn | `agent_run` through `RunDelegationService` | one Tool result on the parent Run |
| work that runs, awaits, or ends independently | separate ordinary Runs composed by a host, Agents service, or Workforce | committed results joined by the composer |
| an asynchronous message to another Thread | durable `send_message` and outbox delivery | input for the target Thread's next safe boundary |

Use [Awaken Workforce](/docs/workforce/) when the dependency is business work with
responsibility, review, or acceptance beyond one Agent execution.

## Static ownership

```mermaid
flowchart TB
  Parent[Parent publication and Run] --> Call[agent_run Tool call]
  Call --> Service[RunDelegationService]
  Service --> Registry[RunDelegations]
  Registry --> ChildA[Ordinary child Run A]
  Registry --> ChildB[Ordinary child Run B]
  Call --> Batch[ActiveToolBatch]
  ChildA --> Inbox[PendingChildRunResults]
  ChildB --> Inbox
  Inbox --> Batch
  Batch --> Result[Ordered parent Tool result]
  Placement[Placement policy] -. shared environment or fresh Sandbox .-> ChildA
  Placement -. shared environment or fresh Sandbox .-> ChildB
```

The three durable state cells have different owners:

| State | Owns | Does not own |
| --- | --- | --- |
| `RunDelegations` | stable relationship identity, lineage, limits, and cancellation intent | the parent Tool result |
| `ActiveToolBatch` | the parent call's Requested, Executing, Awaiting, and terminal state | child relationship history |
| `PendingChildRunResults` | idempotent delivery after child completion and before parent consumption | another child store or executor |

A child has its own Agent publication and Run identity. Placement decides whether
it shares the Session environment or receives a fresh Sandbox; Sandbox choice
does not define Agent identity.

## One delegated result

```mermaid
sequenceDiagram
  participant Parent as Parent Run
  participant Runtime
  participant Relation as RunDelegations
  participant Commit as ThreadCommit
  participant Child as Child Run or A2A adapter
  participant Inbox as PendingChildRunResults
  Parent->>Runtime: agent_run target and input
  Runtime->>Relation: derive stable DelegationId and child_run_id
  Runtime->>Relation: check roster, lineage, and budgets
  Runtime->>Commit: commit relationship and Executing call
  Runtime->>Child: start or reconnect same child identity
  alt child awaits
    Child-->>Runtime: Awaiting continuation
    Runtime->>Commit: commit parent ticket and delegation wait
    Parent->>Runtime: typed resume input
    Runtime->>Runtime: validate committed ticket
    Runtime->>Child: resume same child Run
  else child ends
    Child-->>Runtime: terminal result and usage
    Runtime->>Inbox: record once by DelegationId
    Runtime->>Commit: commit delivery envelope
    Runtime->>Inbox: consume with parent Tool result
    Runtime->>Commit: finalize ToolBatch publication
    Commit-->>Parent: model-visible result
  end
```

Repeated start or recovery addresses the same `DelegationId` and child Run. It
must not create another child. When the parent ends, the terminal commit records
cancellation intent for open relationships. Delivery may retry after commit; a
late result cannot reopen a closed relationship.

## Parallel calls have a narrower contract

```mermaid
flowchart LR
  Calls[One model response with several child calls] --> Check{One service owns all calls and every call proves terminal completion}
  Check -->|yes| Commit[Commit all relationships and Executing states]
  Commit --> Parallel[Run child calls concurrently]
  Parallel --> Join[Join terminal results]
  Join --> Publish[Publish in original call order]
  Check -->|no| Sequential[Use ordinary call handling]
```

Runtime uses concurrent delegation only when every call in the model batch is
owned by the same `RunDelegationService` and each target returns
`supports_parallel_completion`. If a supposedly terminal-only child awaits, the
batch becomes `Indeterminate`; Runtime does not compress several independent
correlations into one ticket.

Long-running children that may await independently should be separate Runs.
Their composer owns the join; the execution core does not add a generic background-work
state or a shared chat buffer.

## Normal recovery behavior

- A retryable child failure reconnects under the same child identity.
- A terminal delegation error becomes a model-visible Tool error; the parent may
  choose another action.
- Duplicate child delivery is idempotent when identity and result match; a
  conflicting result fails closed.
- Parent termination seals unfinished Tool calls and prevents late delivery from
  reopening them.

These paths are automatic and need no generic troubleshooting section. External
repair is relevant only when the selected local or A2A adapter reports a concrete
configuration or connectivity error that remains after its own retry policy.

For implementation, use [Delegate with
`agent_run`](/docs/agents/runtime/how-to/invoke-sub-agent-from-tool/). For the containing
state machine, read [Run lifecycle](/docs/agents/runtime/explanation/run-lifecycle-and-phases/).
