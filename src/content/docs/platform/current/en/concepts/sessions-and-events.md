---
title: "What is an Agent Session? Session, Thread, Run, and event roles"
description: "An Agent Session is the durable application identity for continuing one Agent conversation across turns, reconnects, and process restarts."
evidence:
  - "crates/server/awaken-session-application/src/creation.rs"
  - "crates/contract/awaken-session-contract/src/resource.rs"
  - "crates/server/awaken-session-application/src/application.rs"
section: "Understand"
subsection: "System model"
order: 12
lastReviewed: 2026-09-03
---

An **Agent Session** is the durable application identity for continuing one
Agent conversation across turns, reconnects, or process restarts. Keep its
identifier and send new input to that Session. Do not rebuild durable history
from browser state or a partially received stream.

## Choose the durable identity first

| Concept | What it owns | What it is not |
| --- | --- | --- |
| Session | the application conversation identity, selected Agent and Environment, resolved resources, and protocol lifecycle | one model request or another execution ledger |
| Thread | append-only committed messages, state changes, tool results, and Run history | mutable Session configuration |
| Run | one activation on the Thread, including running, awaiting, and terminal state | the long-lived conversation identity |
| Event stream | a low-latency projection of Session and committed Runtime facts | not another store and not the recovery authority |

A Session status can summarize the application-facing state. The Run state in
committed Thread facts decides whether execution has actually ended or is
waiting for input.

## Static structure

```mermaid
flowchart TB
    App["Application<br/>retains Session id"] --> Edge["Protocol adapter<br/>auth · idempotency · projection"]

    subgraph SessionAggregate["Session aggregate"]
      Binding["Agent · Environment · metadata"]
      Resources["ResolvedSessionResources"]
      Lifecycle["Session lifecycle"]
    end

    subgraph RuntimeTruth["Runtime truth"]
      Thread["Thread"] --> Run["Run"] --> Facts[(committed facts)]
    end

    Edge --> SessionAggregate
    Edge --> Thread
    SessionAggregate -. "frozen inputs" .-> Run
    Facts --> Edge
    Edge --> Stream["event stream / replay"]
```

The Session repository keeps application facts that do not belong in the
transcript. The Thread keeps execution facts needed for replay and recovery.
Neither copies the other's state.

## Resources are resolved before the Session runs

Agent defaults and explicit Session attachments use the same input-binding
contract. Session creation resolves them into one secret-free
`ResolvedSessionResources` value before opening an execution environment.

```mermaid
flowchart LR
    Defaults["Agent input defaults"] --> Resolver["SessionInputResolver"]
    Attachments["explicit Session attachments"] --> Resolver
    Skills["selected Skill versions"] --> Resolver
    Resolver --> Manifest["resolved, secret-free manifest"]
    Manifest --> Session["Session aggregate"]
    Session --> Worker["exact Worker realization"]
```

The manifest pins the configuration each resource type can honestly freeze.
Files use an immutable File identity. Repository and Memory inputs retain their
selected configuration versions without pretending that mutable content is a
Git commit or byte snapshot. Skills retain an exact version and bundle hash.

Current ownership, authorization, credential validity, and lifecycle can still
deny use. A frozen identity is reproducible input selection, not permanent
permission.

## Dynamic behavior

```mermaid
sequenceDiagram
    participant A as Application
    participant S as Session service
    participant R as Runtime / Worker
    participant F as Commit authority

    A->>S: create Session with Agent and attachments
    S->>S: resolve and persist the effective inputs
    A->>S: send user input with idempotency identity
    S->>R: activate one Run on the Session Thread
    R->>F: commit messages, state, tool results, await, or terminal result
    F-->>S: committed Thread facts
    S-->>A: project events
    alt exact external input is required
      R->>F: commit Awaiting and ResumeTicket
      A->>S: submit confirmation or tool result
      S->>R: resume the same Run
    end
    R->>F: commit terminal Run state
    F-->>A: project the terminal Session status
```

The live stream is useful for rendering progress. Committed Thread facts are
used for replay, reconnect, and decisions that must survive a restart. If a
stream disconnects, the application reconnects with the same Session identity;
the system projects committed history again. That normal reconnect does not
require repair.

If Session creation has persisted its aggregate but dispatch projection is
temporarily unavailable, the lifecycle reconciler retries that projection. It
does not ask the client to create a second Session.

## Keep neighboring rules with their owners

This page owns the Session, Thread, Run, and event mental model. Exact event
DTOs, batch limits, and Managed Agents differences belong to the
[compatibility matrix](/docs/agents/compatibility/). Exact MCP attachment
states and transport behavior belong to [MCP protocol](/docs/agents/protocols/mcp/).
Claim takeover, commit ambiguity, and indeterminate effects belong to
[Production reliability](./production-reliability).

For application wiring, continue with
[Connect one published Agent](/docs/agents/how-to/connect-a-published-agent/).
