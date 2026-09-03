---
title: "What is an AI Agent Runtime?"
description: "Learn what an AI Agent runtime executes, which state it commits, and how it differs from the application infrastructure around it."
evidence:
  - "crates/runtime/awaken-runtime/src/runtime.rs"
  - "crates/runtime/awaken-runtime-contract/src/snapshot.rs"
section: "Understand"
subsection: "System model"
order: 9
lastReviewed: 2026-09-03
---

An **AI Agent runtime** is the execution layer that runs an Agent's model-and-tool
loop, applies permission decisions, evolves typed state, and commits the facts
produced by each step. It consumes an executable Agent definition and a Run
context; it is not, by itself, the complete user-facing Agent application.

## The runtime boundary

| The runtime owns | A surrounding Agent application platform owns |
| --- | --- |
| model invocation and streamed output | published Agent identity and revisions |
| tool selection, permission gates, and tool results | durable Session identity and client-facing events |
| typed state transitions during execution | dispatch, Worker placement, and Sandbox lifecycle |
| atomic step commits through a commit port | authentication, protocol APIs, recovery operations, and administration |

This separation matters because a local loop can execute successfully without
solving publication, reconnect, recovery, isolation, or operations. Conversely,
the platform should not reimplement the Agent loop for every API protocol.

## Static structure

```mermaid
flowchart LR
    Definition["Executable Agent definition"] --> Runtime["Agent Runtime"]
    Context["Run context<br/>Thread · state · permissions"] --> Runtime
    Runtime --> Model["Model provider"]
    Runtime --> Tools["Tools / plugins"]
    Runtime --> Commit["Atomic commit port"]
    Commit --> Facts[("Committed Thread facts")]

    Platform["Agent application infrastructure"] --> Definition
    Platform --> Context
    Facts --> Platform
```

The runtime receives capabilities through narrow ports. Durable authorities stay
outside the loop, so a retry or a different Worker can reconstruct execution
from committed facts instead of from process memory.

## Dynamic behavior

```mermaid
sequenceDiagram
    participant P as Agent application infrastructure
    participant R as Agent runtime
    participant M as Model
    participant T as Tool
    participant C as Commit authority

    P->>R: activate Run(snapshot, Thread, state, capabilities)
    R->>M: request the next model step
    M-->>R: text and/or tool request
    alt tool requested
      R->>R: evaluate permission
      R->>T: execute allowed tool
      T-->>R: typed result
    end
    R->>C: commit messages, state, tool result, await, or terminal fact
    C-->>R: commit receipt
    R-->>P: committed progress or terminal outcome
```

A failure before a fact is committed does not become durable history. Recovery
starts from the last committed Thread facts and the applicable tool-recovery
policy. Exact claim, retry, and indeterminate-effect rules belong to
[Production reliability](./production-reliability), not to this definition.

## Awaken's implementation

**Awaken Runtime** is the Rust execution core inside **Awaken Agents**. It owns
the Agent loop, tools, typed state, permission checks, plugins, and staged atomic
commits. Awaken Agents adds durable Sessions, publication, protocol adapters,
Workers, Sandboxes, configuration, and recovery around that core.

Use [Framework vs Runtime vs Agent application infrastructure](./framework-runtime-infrastructure)
when choosing the layer you need. Then read [Runtime internals](/docs/agents/runtime/)
only when you need to extend execution behavior, or [Run your first Awaken
Session](/docs/agents/get-started/) when you want to integrate an application.
