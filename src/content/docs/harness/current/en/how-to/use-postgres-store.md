---
title: "Persist Awaken Agents execution state in PostgreSQL"
description: "Separate schema migration from execution startup and verify one transactional commit authority."
evidence:
  - "crates/stores/awaken-store-postgres/src/lib.rs"
section: "Understand"
subsection: "State & Storage"
order: 57
---

Use PostgreSQL when Runtime state must survive restarts and more than one process
may commit to the same authority. Decide first whether the Runtime process may
execute DDL. For a controlled deployment, migrate once and make every Runtime
instance verify the installed schema without changing it.

## Choose the startup path

| Deployment | Migration phase | Runtime startup |
| --- | --- | --- |
| local development or one-process embedding | `connect` or `with_pool` applies migrations | the same call hydrates the read projection |
| controlled deployment | `migrate` runs before Runtime starts | `connect_existing` verifies migrations, then hydrates |
| controlled deployment with an application pool | run `migrate` once | `with_existing_pool` verifies and hydrates the supplied pool |

```mermaid
flowchart LR
    D[Deployment migration job] -->|migrate| DB[(PostgreSQL runtime schema)]
    R1[Runtime process A] -->|connect_existing| DB
    R2[Runtime process B] -->|connect_existing| DB
    DB --> P1[Local read projection A]
    DB --> P2[Local read projection B]
```

## Add the adapter

```toml
[dependencies]
awaken-store-postgres = { git = "https://github.com/AwakenWorks/awaken" }
```

For local development:

```rust
use awaken_store_postgres::PostgresCommitCoordinator;

let store = PostgresCommitCoordinator::connect(
    "postgres://user:pass@localhost:5432/mydb",
    10,
).await?;
```

For a deployment with a separate migration job:

```rust
use awaken_store_postgres::PostgresCommitCoordinator;

PostgresCommitCoordinator::migrate(database_url, 2).await?;

// Run this in each Runtime process after the migration job succeeds.
let store = PostgresCommitCoordinator::connect_existing(
    database_url,
    10,
).await?;
```

Use `with_pool` and `with_existing_pool` for the corresponding paths when the
application owns an `sqlx::PgPool`.

## Know what commits together

```mermaid
sequenceDiagram
    participant Runtime
    participant Store as PostgresCommitCoordinator
    participant DB as PostgreSQL
    participant View as Local projection

    Runtime->>Store: commit(ThreadCommit)
    Store->>DB: begin transaction
    Store->>DB: lock Thread version
    Store->>DB: append messages, state, events, Run, and ticket change
    Store->>DB: advance Thread version and commit
    alt SQL commit succeeds
        Store->>View: advance this process's projection
        Store-->>Runtime: CommitRecord
    else validation, version, or SQL failure
        Store-->>Runtime: error; transaction is not visible
    end
```

The tables use the fixed `runtime_` prefix. The commit log is authoritative;
`runtime_run_record` is the latest-Run cache. The schema includes commit,
message, state-command, event, waiting-ticket, Thread-version, operation-receipt,
and PostgreSQL commit-sequence objects.

Startup rebuilds the synchronous execution projection from a repeatable-read
snapshot. It refuses to hydrate when the combined count of commit, message,
state-command, event, and waiting rows exceeds 1,000,000. Compact or export a
snapshot before restarting an authority of that size.

Each process advances its local projection only for its own successful commits.
Active-active reconciliation and recovery use the adapter's authoritative
PostgreSQL reads. Do not treat one process's synchronous projection as a live
subscription to commits made by another process.

## Verify the deployment

Run the migration phase, start two Runtime instances with `connect_existing`,
then commit and recover different Threads through both instances. Confirm the
schema ledger before inspecting business rows.

```sql
SELECT sequence, thread_id, run_id
FROM runtime_commit
ORDER BY sequence;

SELECT thread_id, version
FROM runtime_thread_version
ORDER BY thread_id;
```

## Act only on surfaced failures

| Surfaced result | What remains unresolved | External action |
| --- | --- | --- |
| `StoreError::Connect` | the pool cannot reach or authenticate to PostgreSQL | verify the URL, TLS/authentication settings, network path, and server readiness |
| `StoreError::Migrate` from `migrate` | the deployment job could not install the exact bundles | grant the migration identity the required DDL rights and rerun the migration job |
| `StoreError::Migrate` from `connect_existing` | installed migration receipts do not match the expected bundles | stop startup and deploy the matching migration bundle; do not let the Runtime process rewrite the ledger |
| `StoreError::Hydrate` with the safe startup limit | the synchronous projection would exceed its bounded startup size | compact or export a snapshot before restart |
| commit version conflict | another accepted transition changed the same Thread first | reload the authoritative recovery snapshot and let the caller retry the logical operation |

Successful transaction rollback, schema verification, and projection hydration
are normal system behavior and need no separate repair procedure.

## Related

- [Choose Awaken Agents execution state and storage](/docs/agents/runtime/state-and-storage/)
- [Persist Awaken Agents execution state in files](/docs/agents/runtime/how-to/use-file-store/)
- [State and Snapshot Model](/docs/agents/runtime/explanation/state-and-snapshot-model/)
