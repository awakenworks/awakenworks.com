---
title: "Know when a failed Run needs intervention"
description: "Separate failures Awaken resolves from external effects and explicit quarantines that still require a decision."
evidence:
  - "crates/contract/awaken-agent-contract/src/stream/checkpoint.rs"
  - "crates/contract/awaken-agent-contract/src/thread/commit/operation.rs"
  - "crates/runtime/awaken-runtime-contract/src/tool_batch.rs"
  - "crates/server/awaken-run-ingress/src/worker.rs"
  - "crates/server/awaken-run-ingress/src/pool.rs"
  - "crates/server/awaken-run-ingress-http/src/durable_ops.rs"
section: "Understand"
subsection: "Governance and reliability"
order: 21
---

Most process, network, wake, and lease failures do not need manual repair.
Awaken reclaims durable work and reconstructs it from committed facts. Start
investigating only when the application exposes a terminal result, a typed
dependency error persists, an external side effect is indeterminate, or a Run
was explicitly quarantined.

## First decide whether any action is needed

| Observable result | What Awaken does | When to act |
| --- | --- | --- |
| A Worker or wake signal disappears, with no terminal error | Another eligible Worker can claim the durable dispatch; periodic draining covers a lost wake signal. | Do not repair or duplicate the Run while it is still making progress. |
| A commit response is lost | The same `operation_id` and payload return the original receipt. | Retry only the identical operation; changed bytes are a new intent. |
| An old Worker returns after takeover | The current claim epoch rejects its renew, commit, and settle. | No action unless the current owner also reports a persistent dependency error. |
| A model stream is interrupted | Runtime uses a useful checkpoint or restarts the current inference from committed Thread facts. | Reconnect to committed history; do not reconstruct state from partial deltas. |
| The retry budget is exhausted | The drainer commits `Ended(Indeterminate)` through the normal fenced terminal path and settles the dispatch. | Decide the business outcome after observing that terminal state; do not search for an automatic dead letter. |
| A tool may have changed an external system but no result was committed | `ToolRecoveryPolicy` can replay an idempotent call, reconnect to a recoverable call, or preserve `Indeterminate`. | Reconcile the original business operation before any new execution. |

If none of the last column applies, there is nothing to troubleshoot. Awaken Agents
persists the dispatch first, lets one Worker lease claim it, commits progress
through execution checkpoints, and accepts final facts only under the current
claim fence. A retry can continue work; it cannot make an unknown external
effect successful.

## Static structure: the queue delivers; the Thread store owns truth

```mermaid
flowchart TB
    Submit["Submit / Resume / Cancel"]

    subgraph Delivery["Durable delivery"]
      direction LR
      Queue[("Dispatch queue<br/>pending · leased · explicit quarantine")]
      Inbox[("Pending input<br/>message_id · correlation · revision")]
      Outbox[("Cross-thread outbox")]
      Wake["WakeSignal<br/>Local · PgNotify · NATS"]
    end

    subgraph Authority["Committed authority"]
      direction LR
      Thread[("Thread facts<br/>messages · RunState · typed state")]
      Receipt[("Commit receipts<br/>operation id · version · hash")]
      Checkpoint[("ToolBatch / ResumeTicket<br/>optional stream checkpoint")]
    end

    subgraph Fleet["Worker fleet"]
      direction LR
      Registry["Worker registry<br/>identity · incarnation · generation"]
      Claim["Claim<br/>owner · lease · epoch"]
      Worker["Worker Executor"]
    end

    Submit --> Queue
    Submit --> Inbox
    Outbox --> Inbox
    Queue -.-> Wake
    Wake -. "hint" .-> Worker
    Registry --> Claim
    Queue --> Claim --> Worker
    Worker -->|"CommitOperation"| Receipt --> Thread
    Thread --> Checkpoint
    Worker -->|"settle with epoch"| Queue

    classDef delivery fill:#25203b,stroke:#9b7cf6,color:#f6f3ed;
    classDef authority fill:#17322d,stroke:#55b89d,color:#f6f3ed;
    classDef worker fill:#17303a,stroke:#55aeca,color:#f6f3ed;
    class Queue,Inbox,Outbox,Wake delivery;
    class Thread,Receipt,Checkpoint authority;
    class Registry,Claim,Worker worker;
```

Wake is only a hint: loss adds latency and duplication causes another drain, but
neither changes correctness. Recovery reads `RunState`, `ResumeTicket`,
`ActiveToolBatch`, and Thread version instead of treating queue status as Agent
truth.

## Dynamic behavior: failure, takeover, and stale-writer fencing

```mermaid
sequenceDiagram
    participant C as Control / Dispatch
    participant P as Persistent stores
    participant A as Worker A
    participant B as Worker B
    participant R as Awaken Agents recovery

    C->>P: persist RunDispatch(snapshot, requirements)
    A->>P: claim(owner A, lease, epoch 7)
    P-->>A: activation + pending + assignment
    loop while healthy
        A->>P: renew lease
        A->>P: CommitOperation(op, expected version, payload hash)
        P-->>A: CommitReceipt
    end

    Note right of A: process or network failure
    P->>P: lease expires, retry budget advances
    alt attempts remain
        B->>P: reclaim(owner B, epoch 8)
        P-->>B: recovered activation + committed recovery view
        B->>R: inspect RunState / ticket / ToolBatch / checkpoint
        R-->>B: resume, recover tool batch, or return terminal
        B->>P: CommitOperation under epoch 8
        P-->>B: applied
    else retry budget exhausted
        B->>P: claim exhausted dispatch under epoch 8
        B->>P: commit Ended(Indeterminate) and settle Done
        P-->>B: applied
    end

    A->>P: late commit under epoch 7
    P-->>A: fenced
    B->>P: settle Done / Awaiting with epoch 8
```

Worker identity combines a logical `worker_id`, a boot-specific
`incarnation_id`, and registry-assigned `generation`. The dispatch `epoch` is the
current claim's fencing token. An old Worker cannot renew its replacement's
lease, append new facts, or make a stale settle look successful.

## Why commits are safely retryable

A cross-node commit is not a bare `ThreadCommit`:

```text
CommitOperation {
  operation_id: { run_id, ordinal },
  expected_thread_version,
  payload_hash,
  commit
}
```

- Retrying the same operation id and payload returns the original receipt.
- Reusing an operation id with a different payload fails closed.
- A stale recovery prefix cannot append after Thread version advances.
- An old owner is fenced before authoritative storage when the claim epoch changes.

This prevents duplicate **committed facts** when an HTTP response is lost. It
does not make arbitrary external side effects exactly once.

## Tool side-effect recovery boundaries

| Failure window | Committed evidence | Recovery action |
|---|---|---|
| before executor entry | ToolBatch `Requested` | pass the gate, then execute for the first time |
| executor entered | `Executing { attempt }` + `ToolRecoveryPolicy` | replay, reconnect, or `Indeterminate` |
| one result returned | `Completed` / result state | reuse it; do not make it a new call |
| full batch completed | `Finalized` + ordered tool-result messages | next inference may consume it |
| Awaiting | matching `ResumeTicket` | accept only a matching correlation/snapshot |

A Remote Hand can also suppress duplicate execution with a stable operation id
and its own idempotency ledger. For a third-party system without idempotency,
choose `NeverReplay` or add a business idempotency key/transaction in the tool
adapter. The accurate promise is:

> Delivery may be at least once. Committed facts and idempotency-aware effects
> can be deduplicated. Unknown external outcomes remain `Indeterminate` instead
> of being guessed successful.

## The stream-recovery boundary

At a retryable model-stream interruption, runtime may put partial text and tool
arguments in `StreamCheckpointStore`. A new process can continue the text, reuse
fully parsed tool calls, or restart the current inference when no useful partial
exists.

This checkpoint is a best-effort, short-lived recovery optimization:

- it covers one in-flight inference Step;
- write failure does not fail the Run;
- it is deleted when recovery concludes;
- committed transcript remains owned by `ThreadCommit`.

It therefore does not mean every token is durable or that every crash preserves
all in-progress generation.

## Retry budgets and explicit quarantine

A repeatedly crashing dispatch consumes its retry budget. Once the budget is
exhausted, the next drainer claims that dispatch, commits
`Ended(Indeterminate)`, notifies terminal observers, and settles it as `Done`.
This is the automatic path. It does not create a dead letter.

Dead letters exist only for an explicit maintenance decision that removes
already exhausted work from automatic terminal resolution. Do not quarantine as
a routine response to retries. Use it only when you intentionally want to stop
automatic terminalization. The [Public HTTP API](../reference/api) is the single
owner of the exact quarantine, inspection, requeue, and purge routes, including
their parameters and destructive boundaries.

Cancellation also persists intent first. Cancelling a running dispatch advances
the epoch and releases the old lease, fencing subsequent commits by that owner.
A new claimant commits terminal `Cancelled` before delivery state is removed.

## Cross-Thread delivery

`send_message` is backed by a durable outbox and idempotent inbox append:

```mermaid
sequenceDiagram
    participant S as Source Thread
    participant O as Outbox
    participant I as Target pending input
    participant W as Target Worker

    S->>O: stage(message_id, target, payload)
    O->>I: append idempotently
    I-->>O: inserted or duplicate
    O->>O: delete staged row
    W->>I: consume under target claim
```

If relay crashes after append but before delete, the next relay appends again
and the same `message_id` makes it a no-op. The exactly-once effect here refers
only to this controlled store transaction/idempotency combination, not arbitrary
business systems.

## Verification boundary

The repository drives memory, SQLite, and Postgres through shared dispatch
conformance tests; Postgres claims with `FOR UPDATE SKIP LOCKED`. It also contains
crash-before-settle, committed-resume, Worker fencing, Remote Hand
idempotency/indeterminate, and Sandbox recovery scenarios.

Those tests prove named storage, protocol, and fault paths. They do not prove LLM
semantics, and they do not replace deployment acceptance against the real
provider, database, network, Sandbox backend, and downstream idempotency model.

Continue with [Run, Step, and tool batches](/docs/agents/runtime/explanation/run-lifecycle-and-phases/),
[Brain and Hand](/docs/agents/concepts/brain-and-hand/), and
[Sessions and events](/docs/agents/concepts/sessions-and-events/).
