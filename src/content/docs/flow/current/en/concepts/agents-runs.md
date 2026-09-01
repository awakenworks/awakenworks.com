---
title: "Agents, WorkUnits, and Awaken Runs"
description: "How Workforce business responsibility drives an Awaken technical Run through a durable execution link and performs independent acceptance."
section: "Understand"
subsection: "Execution boundary"
order: 30
---

Workforce separates three objects:

- **Agent**: the business execution role and portable configuration template.
- **WorkUnit**: one business execution responsibility for an Issue/Workflow state.
- **Awaken Run**: the technical authority for publication, protocol, placement,
  Sandbox, await/resume, and terminal execution facts.

Workforce does not keep a second Agent worker kernel. It freezes
an exact `AgentPublicationRef`, starts an Awaken Run through the neutral
`AgentExecutionPort`, and consumes only committed lifecycle facts.

## Current status

| Layer | Status | Current fact |
| --- | --- | --- |
| Agent publication/control ACL | Built | Workforce publishes and freezes an exact Awaken publication and does not construct provider clients |
| WorkUnit↔Run link | Built | `AgentExecutionPort`, the command outbox, execution link, and dual-stream event inbox pass in-memory, SQLite, PostgreSQL conformance, and server causal tests |
| Sole fleet/worker authority | Built | Awaken is the sole Agent Worker, claim, recovery, and ACP/A2A authority; Workforce retains only local System/Rule execution and a read-only fleet projection |

Built describes the integration path, not product maturity. It means the
guardrails, store conformance, causal behavior, and removal of replaced paths
have been checked. Workforce remains in early preview; Built does not
claim a production SLA, customer outcome, or hosted service.

## Static structure

```mermaid
flowchart LR
    subgraph F["Awaken Workforce · business authority"]
      I["Issue + WorkflowRevision"]
      W["WorkUnit + ExecutionSnapshot"]
      O["Agent command outbox"]
      L["AgentExecutionLink"]
      N["lifecycle event inbox"]
      A["business acceptance / write-back"]
      I --> W --> O
      L --> N --> A
    end

    subgraph P["Awaken · technical Run authority"]
      C["Agent publication catalog"]
      R["durable Run ingress"]
      X["Worker placement + Sandbox"]
      T["committed lifecycle facts"]
      C --> R --> X --> T
    end

    O -->|"start / resume / cancel"| R
    R -->|"stable Run ref"| L
    T -->|"events_after(sequence)"| N
    A -->|"accepted / rejected / attention"| I
```

Workforce and Awaken do not share one state enum. Workforce WorkUnit states describe a
business attempt; Awaken Run states describe technical execution. Technical
success in Awaken is not automatic business acceptance in Workforce.

## Dynamic behavior

```mermaid
sequenceDiagram
    participant F as Workforce WorkUnit
    participant O as Command outbox
    participant A as AgentExecutionPort
    participant R as Awaken durable Run
    participant I as Lifecycle inbox
    participant B as Workforce acceptance

    F->>O: commit Start(work_unit_id)
    O->>A: start(exact publication, idempotency key)
    A->>R: create or reconnect same Run
    R-->>A: AgentRunRef
    A-->>F: persist one execution link
    loop committed lifecycle pages
        R-->>A: events_after(sequence)
        A->>I: deduplicate + persist
        I->>F: pure WorkUnit transition
    end
    alt Awaken awaits
        F->>O: commit Resume(message_id, ticket, input)
        O->>A: resume same Run
    else Workforce cancels
        F->>O: commit Cancel
        O->>A: cancel same Run
        A-->>I: committed cancellation confirmation
    else Awaken completes
        I->>B: candidate output
        B-->>F: accepted / rejected / attention
    end
```

## Invariants

- `work_unit_id` is the start idempotency key; one WorkUnit links to one Awaken Run.
- Commands and lifecycle inbox events are durable and deduplicated.
- Only committed Awaken lifecycle events change Workforce execution state.
- Cancellation requires committed confirmation; Workforce cannot locally invent a
  terminal state.
- Awaken completion yields a candidate result. Workforce independently applies output
  contracts, revision checks, approval, and business acceptance.
- Workforce's local queue executes only System/Rule work. Restoring an Agent claimant,
  Worker registry, or ACP/A2A router in Workforce would restore the deleted second
  execution authority.
