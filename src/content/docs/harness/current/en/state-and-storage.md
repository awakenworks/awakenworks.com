---
title: "Choose Awaken Agents execution state and storage"
description: "Choose a state lifetime and persistence adapter while keeping one commit authority."
evidence:
  - "crates/contract/awaken-agent-contract/src/agent/state.rs"
  - "crates/contract/awaken-agent-contract/src/thread/commit/coordinator.rs"
section: "Understand"
subsection: "State & Storage"
order: 55
---

Start with the failure you need to survive. Keep scratch data in memory. Put a
value in Thread state when a later Run on the same Thread needs it. Choose a file
adapter for one process and PostgreSQL when several processes need one durable
commit authority.

| Need | Choose | Boundary to keep |
| --- | --- | --- |
| tests or one process lifetime | in-memory coordinator | restart loses state |
| restart recovery on one host | `FsCommitCoordinator` | one process owns the directory |
| several Runtime processes or database operations | `PostgresCommitCoordinator` | migrations and startup hydration are explicit deployment steps |
| business data shared across Threads | application-owned store exposed through a Resource and Tool | it is not Runtime Thread state |
| durable messages between Threads | run-ingress Outbox | do not copy messages through state keys |

## Keep one authority

```mermaid
flowchart TB
    P[Tool, hook, or runtime mechanism] -->|stage Command| C[ThreadCommit]
    C --> W[CommitCoordinator]
    W --> F[(Committed Thread facts)]
    F --> V[CommittedThreadView]
    F --> R[CheckpointReader]
    V --> S[Store rebuilt for one Thread]
    R --> E[Committed events]

    A[Application business state] --> X[Application Resource]
    X --> T[Tool boundary]
    T --> P
    O[Cross-Thread message] --> B[Run-ingress Outbox]
```

`ThreadCommit` is the write boundary for messages, state commands, Run
disposition, waiting-ticket changes, and audit drafts. `CommittedThreadView`
reconstructs the execution view. `CheckpointReader` adds durable event reads.
The live `Store` is a projection, not another writer.

The Awaken Agents execution core does not own tenant records, profiles, customer databases, queues, or
HTTP resources. An embedding application supplies those capabilities and exposes
only the operations an Agent may use through Resources and Tools.

## What one commit does

```mermaid
sequenceDiagram
    participant Producer as Tool or runtime mechanism
    participant Runtime
    participant Commit as CommitCoordinator
    participant Facts as Durable facts
    participant Reader as Thread view

    Producer->>Runtime: result and staged state commands
    Runtime->>Runtime: validate one lifecycle transition and state batch
    Runtime->>Commit: commit(ThreadCommit)
    alt commit accepted
        Commit->>Facts: append one ordered transition
        Facts-->>Reader: replay or hydrate
        Reader-->>Runtime: committed messages, state, Run, and ticket
    else commit rejected
        Commit-->>Runtime: error and no partial transition becomes visible
    end
```

Live token deltas and progress notifications are best-effort observations. They
do not determine whether a tool ran, state changed, or a Run ended.

## Make the deployment choice

For a file-backed embedding, continue with [Use File Store](/docs/agents/runtime/how-to/use-file-store/).
For PostgreSQL, including a separate migration phase, continue with
[Use Postgres Store](/docs/agents/runtime/how-to/use-postgres-store/). For exact key
interfaces, use [Choose a State Key](/docs/agents/runtime/reference/state-keys/).

Awaken Agents adds deployment-wide queues, leases, public Sessions, recovery
workers, and protocol replay. Those services compose Runtime ports; they do not
replace the committed Thread fact authority described here.
