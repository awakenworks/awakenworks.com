---
title: "Choose Fact for truth and Delta for live progress"
description: "Consume Awaken's neutral AgentEvent without treating a live fragment or audit record as recoverable Thread truth."
evidence:
  - "crates/contract/awaken-agent-contract/src/event/agent.rs"
  - "crates/contract/awaken-agent-contract/src/event/fold.rs"
  - "crates/contract/awaken-agent-contract/src/event/classify.rs"
section: "Reference"
order: 66
---

Use `Fact` when the application needs a complete event derived from committed
Thread state. Use `Delta` only to render progress while a model or Tool is still
producing content. Reconnect and recovery must read committed messages and
`RunState`, not replay the fragments a client happened to receive.

```rust
pub enum AgentEvent {
    Fact(Fact),
    Delta(Delta),
}
```

## Static ownership

```mermaid
flowchart LR
  Live[Live model and Tool stream] --> Delta[AgentEvent::Delta]
  Commit[Committed messages and RunState] --> Fold[Shared fold]
  Fold --> Fact[AgentEvent::Fact]
  Delta --> Transcoder[Protocol Transcoder]
  Fact --> Transcoder
  Transcoder --> Wire[Protocol wire]
  Delta --> Classify[classify]
  Fact --> Classify[classify]
  Classify --> Audit[Durable audit projection]
```

The fold is the only producer of complete `Fact` values. The live stream is the
only producer of `Delta` values. A protocol implements one `Transcoder`: `fact`
is exhaustive, while `delta` may ignore fragment types the protocol does not
render.

## Event vocabulary

| Tier | Variants | Consumer rule |
|---|---|---|
| `Fact` | `RunStarted`, `AssistantMessage`, `AssistantThinking`, `ToolCall`, `ToolResult`, `Awaiting`, `Continuation`, `RunFinished`, `RunFailed` | handle every variant and use it as a complete projection |
| `Delta` | `TextDelta`, `ReasoningDelta`, `ToolCallDelta` | render supported fragments; tolerate loss and duplication at the transport boundary |

`ToolCallDelta.args_delta` is always a suffix fragment. The provider adapter
normalizes cumulative provider formats before emitting it. A complete Tool input
appears later in `Fact::ToolCall.input`.

## From live progress to a committed fact

```mermaid
sequenceDiagram
  participant Provider
  participant Runtime
  participant Live as Live subscribers
  participant Commit as ThreadCommit
  participant Fold
  participant Adapter as Protocol Transcoder

  Provider-->>Runtime: text, reasoning, or Tool-argument fragment
  Runtime-->>Adapter: AgentEvent::Delta (best effort)
  Adapter-->>Live: protocol preview event
  Runtime->>Commit: messages and RunState
  Commit-->>Runtime: accepted committed frontier
  Runtime->>Fold: committed messages and state
  Fold-->>Adapter: complete AgentEvent::Fact values
  Adapter-->>Live: protocol events
  Note over Commit,Fold: reconnect folds committed truth again
```

## Terminal mapping

| Committed `RunState` | Derived `Fact` |
|---|---|
| `Awaiting` | `Awaiting { pending_tool_use_id }` |
| `Ended(MaxSteps)` | `RunFinished { exhausted: true }` |
| `Ended(Error(failure))` | `RunFailed { code: failure.code(), message: failure.message() }` |
| `Ended(Indeterminate)` | `RunFailed { code: "indeterminate", ... }` |
| every other `Ended` cause | `RunFinished { exhausted: false }` |

`Indeterminate` is never projected as success. A caller that needs to continue
after a disconnect reads committed Thread facts; no event-stream repair step is
required.

## Audit is a projection, not truth

`classify` is the single routing decision. Deltas are live-only. `RunStarted` is
both live and auditable. Content facts are reconstructed from canonical messages
and are not copied into the audit log. Awaiting, continuation, finish, and failure
facts may be routed to audit.

Audit records support observation and read-side views. They do not replace the
message log, reconstruct a Run, or form a second public event API.

## Related

- [Thread Model](/docs/agents/runtime/reference/thread-model/)
- [Run, Step, and ToolBatch state](/docs/agents/runtime/explanation/run-lifecycle-and-phases/)
- [Cancellation](/docs/agents/runtime/reference/cancellation/)
