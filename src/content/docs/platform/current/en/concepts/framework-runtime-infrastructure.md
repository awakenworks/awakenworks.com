---
title: "Agent Framework vs Agent Runtime vs Agent Application Infrastructure"
description: "Distinguish authoring libraries, execution cores, and production application infrastructure by the responsibilities each layer owns."
evidence:
  - "crates/runtime/awaken-runtime/src/runtime.rs"
  - "crates/server/awaken-session-application/src/application.rs"
section: "Understand"
subsection: "System model"
order: 8
lastReviewed: 2026-09-03
---

An **Agent framework** helps developers define Agent behavior. An **Agent
runtime** executes that behavior. **Agent application infrastructure** keeps the
result usable across users, Sessions, deployments, failures, and operating
boundaries. A product may use all three layers, and one implementation may span
more than one layer.

## Compare ownership, not product labels

| Responsibility | Agent framework | Agent runtime | Agent application infrastructure |
| --- | --- | --- | --- |
| Define prompts, tools, and Agent composition | Primary concern | Consumes the definition | Publishes and versions the definition |
| Run the model-and-tool loop | May provide a local loop | Primary concern | Places and supervises execution |
| Enforce permissions and commit typed state | Implementation-dependent | Runtime concern | Supplies policy and durable authorities |
| Keep a user-facing Session across reconnects | Usually left to the application | Executes against a Thread or state input | Primary concern |
| Dispatch work to Workers and Sandboxes | Usually external | Consumes an execution environment | Primary concern |
| Recover, inspect, and operate deployed work | Usually external | Exposes execution facts | Primary concern |

The table describes responsibilities, not a compliance score. Before comparing
products, inspect which layer owns each durable fact and whether two layers are
silently keeping competing copies.

## Static structure

```mermaid
flowchart TB
    Product["Agent application<br/>UX · domain rules · acceptance"]
    Infrastructure["Agent application infrastructure<br/>publication · Sessions · dispatch · recovery · operations"]
    Runtime["Agent runtime<br/>loop · tools · state · permissions · commit"]
    Framework["Agent framework / SDK<br/>definitions · composition · client helpers"]
    Models["Models · tools · external systems"]

    Product --> Infrastructure
    Infrastructure --> Runtime
    Framework --> Runtime
    Runtime --> Models
    Runtime --> Infrastructure
```

The application remains the owner of its customer experience and business
outcome. Infrastructure owns the durable application lifecycle. Runtime owns one
execution path. A framework or SDK can help author behavior without becoming a
second Session or recovery authority.

## Dynamic behavior

```mermaid
sequenceDiagram
    participant D as Developer
    participant I as Application infrastructure
    participant R as Agent runtime
    participant M as Model / tool
    participant A as Application

    D->>I: publish a versioned Agent definition
    A->>I: create or continue a Session
    I->>R: dispatch one Run with frozen inputs
    R->>M: execute model and tool steps
    R->>I: commit messages, state, waits, or terminal facts
    I-->>A: project inspectable Session events
    alt process or connection fails
      A->>I: reopen the same Session
      I->>R: recover from committed facts when work remains
    end
```

## Where Awaken fits

Awaken Agents spans the **runtime** and **Agent application infrastructure**
layers. Awaken Runtime is its Rust execution core; Awaken Agents adds published
Agents, durable Sessions, protocol adapters, Workers, Sandboxes, configuration,
and recovery around that core. It does not replace the product interface,
domain model, or acceptance rules of the application built on top.

Continue with [What is an AI Agent Runtime?](./agent-runtime) for the runtime
boundary, [Sessions and events](./sessions-and-events) for durable identity, and
[system architecture](./architecture) for deployment ownership.
