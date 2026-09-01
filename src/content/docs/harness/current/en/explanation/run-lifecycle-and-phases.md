---
title: "Read and recover Run, Step, and ToolBatch state"
description: "Use committed Run state, the active Tool batch, and its pinned recovery policy to continue without guessing where execution stopped."
evidence:
  - "crates/runtime/awaken-runtime/src/engine/run_loop.rs"
  - "crates/runtime/awaken-runtime-contract/src/tool_batch.rs"
  - "crates/runtime/awaken-runtime/src/engine/dispatch.rs"
section: "Understand"
order: 14
---

Use this page when changing loop order, commit timing, Tool recovery, or resume
behavior. Read the latest committed facts first. Live output can arrive before a
commit and cannot tell recovery where execution stopped.

## Start with the state you need

| Question | Read | Meaning |
| --- | --- | --- |
| Is the execution active, waiting, or finished? | latest committed `RunState` | `Running`, `Awaiting`, or `Ended(EndCause)` |
| Did the model already request Tools? | Run-scoped `ActiveToolBatch` | exact calls, attempts, waits, and terminal results |
| What may resume an Awaiting Run? | committed `ResumeTicket` | one typed correlation and target |
| Was displayed text accepted as Thread truth? | committed messages and facts | a live `Delta` alone is not authority |

Do not infer these answers from a Worker process, stream connection, local
future, or UI status.

## Static structure

```mermaid
flowchart TB
  Run[Run state and EndCause] --> Step[Repeated Step]
  Step --> Model[One inference]
  Model --> Batch[Zero or one ToolBatch]
  Batch --> Calls[One or more durable Tool calls]
  Calls --> State[ActiveToolBatch in typed Run state]
  Step --> Commit[ThreadCommit boundary]
  State --> Commit
  Ticket[ResumeTicket] --> Commit
  Commit --> Facts[Committed messages · state · lifecycle facts]
  Model -. best-effort live Delta .-> Stream[Live stream]
  Facts --> Recovery[Recovery input]
```

A Run is the resumable execution identity. A Step is one inference and the
complete Tool batch produced by that response. `ActiveToolBatch` is typed
Run-scoped state in the ordinary commit log, not another database.

## Run state machine

```mermaid
stateDiagram-v2
  [*] --> Running: RunActivation
  Running --> Running: committed Step or ToolBatch progress
  Running --> Awaiting: commit ResumeTicket
  Awaiting --> Running: validated ResumeCommand
  Running --> Ended: commit EndCause
  Awaiting --> Ended: cancel, stop, or failure
  Ended --> [*]
```

`RunActivation` is input, not a durable `Created` state. If execution never
crosses its first commit, there is no committed Created fact to recover. `Ended`
is absorbing and carries one cause: natural completion, step limit,
cancellation, stop, typed failure, or an indeterminate external outcome.

## One Step and its commit points

```mermaid
sequenceDiagram
  participant Runtime
  participant Hooks
  participant Model
  participant Batch as ActiveToolBatch
  participant Gate
  participant Tool
  participant Commit
  Runtime->>Hooks: StepStart and BeforeInference
  Hooks-->>Runtime: staged state and request-only context
  Runtime->>Model: inference request
  Model-->>Runtime: text or complete Tool-call batch
  alt text only
    Runtime->>Hooks: AfterInference and StepEnd
    Runtime->>Commit: continue or commit EndCause
  else Tool calls
    Runtime->>Batch: create all calls as Requested
    Runtime->>Commit: persist model Tool-use blocks and batch
    loop each ordinary call
      Runtime->>Gate: permission and Plugin gates
      Runtime->>Batch: mark Executing or Awaiting
      Runtime->>Commit: persist before external effect or wait
      Runtime->>Tool: execute when allowed
      Tool-->>Runtime: output or error
      Runtime->>Hooks: AfterTool
      Runtime->>Batch: stage terminal result and reactions
      Runtime->>Commit: persist call progress
    end
    Runtime->>Batch: finalize when every call is terminal
    Runtime->>Commit: publish ordered Tool results
  end
```

Ordinary Tool calls currently execute in order. Terminal-only child delegation
may run concurrently under its narrower proof; see [Multi-Agent
collaboration](/docs/agents/runtime/explanation/multi-agent-patterns/). In both cases,
the next inference sees the batch only after every call is terminal.

## Tool-call state machine

```mermaid
stateDiagram-v2
  [*] --> Requested: full batch committed
  Requested --> Executing: first executor attempt committed
  Executing --> Executing: retry under pinned policy
  Requested --> Awaiting: gate or external input
  Executing --> Awaiting: delegated or scheduled wait
  Awaiting --> Executing: matching typed resume
  Requested --> Completed: immediate block or supplied result
  Executing --> Completed: ToolOutput committed
  Awaiting --> Completed: denied or externally completed
  Requested --> Indeterminate: Run ends before completion
  Executing --> Indeterminate: outcome cannot be classified safely
  Awaiting --> Indeterminate: owning Run ends
  Completed --> Finalized: all calls terminal
  Indeterminate --> Finalized: all calls terminal
```

`Requested` proves that the call is durable and no executor attempt has been
recorded. `Executing { attempt }` means an external effect may have started.
`Awaiting` owns a typed wait and correlation. `Completed` and `Indeterminate`
are terminal call states. Finalization is a batch publication barrier, not a
separate Run terminus.

## Recovery decision table

| Committed frontier | Runtime action | External action |
| --- | --- | --- |
| `Running`, no open ToolBatch | continue the next Step | none |
| call at `Requested` | run gates, commit `Executing`, then enter the executor | none |
| call at `Executing` | apply the pinned `ToolRecoveryPolicy`: replay, reconnect, or mark indeterminate | none unless reconciliation is required |
| call at `Awaiting` | accept only a command matching the committed ticket and wait kind | provide the requested typed approval or input |
| some calls terminal, batch still open | recover remaining calls; retain terminal calls | none |
| `Ended` | return or redeliver the terminus; never reopen the Run | none |

Recovery starts with an open `ActiveToolBatch` before it asks the model again.
It never silently turns `Executing` back into `Requested`, and it never exposes a
half-finished batch to inference.

## Commit and stream boundaries

`ThreadCommit` carries the legal `RunDisposition` together with new messages,
typed state, and events through one validated write. An Awaiting disposition
contains its ticket; Running and Ended dispositions cannot carry one. The
commit coordinator checks identity and expected version before accepting it.

A stream checkpoint is a best-effort optimization for a retryable inference
interruption. It may hold partial text or Tool arguments, is deleted when
recovery finishes, and is not Thread truth. Failure to write it degrades to no
partial recovery; it does not fail the Run.

## When external reconciliation is required

Only `Indeterminate` means Runtime cannot safely classify an external effect.
Use the batch's stable operation id to query the downstream system, then resolve
the business effect through that system's idempotency or transaction contract.
Do not rerun the Tool merely because no result was observed locally.

The guarantee is continuation from committed facts. It is not universal
exactly-once execution for arbitrary third-party side effects. All other retry,
resume, batch publication, and terminal redelivery behavior is automatic and
needs no generic troubleshooting section.
