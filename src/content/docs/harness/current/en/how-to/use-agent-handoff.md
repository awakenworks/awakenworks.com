---
title: "Choose a Delegation or Responsibility Handoff"
description: "Choose the shipped child-Run path for bounded work and a product control plane for lasting responsibility."
evidence:
  - "crates/runtime/awaken-runtime-contract/src/delegation.rs"
section: "Understand"
subsection: "Develop"
order: 35
---

Awaken Agents does not define an in-place `Handoff { target_agent_id }` that
replaces the active Agent inside one Run. Choose the mechanism by what must
remain after the current task ends.

| Need | Use | Result owner |
| --- | --- | --- |
| Another Agent returns one bounded result to the parent | `agent_run` child Run | parent Run commit |
| A child pauses and later continues | delegation wait and resume | child committed state |
| Work, evidence, gaps, and acceptance continue beyond this Run | Host or Awaken Workforce | product control plane |

## Static boundary

```mermaid
flowchart LR
    P["Parent Run"] -->|"bounded request"| C["Child Run"]
    C -->|"result"| P
    P -->|"lasting responsibility"| W["Issue / artifact / revision / gaps"]
    W --> N["Next actor or system"]
```

Delegation keeps the parent active and gives the child an independent Run
identity. A responsibility handoff preserves a product-level work object rather
than pretending that a Runtime Agent switch owns the business process.

## Prepare a responsibility handoff

Carry only information the next actor can use:

- the work or issue identifier;
- the current artifact and immutable revision;
- accepted results and unresolved gaps;
- the condition that will count as complete;
- the next actor or system that now owns progress.

Do not use Sandbox placement as the handoff record. A delegated child may share
the parent Session environment or receive another Sandbox; that choice does not
preserve responsibility after the Run ends.

## Dynamic behavior

```mermaid
sequenceDiagram
    participant P as Current Run
    participant C as Child Run
    participant F as Host or Workforce
    alt bounded subtask
        P->>C: agent_run(input)
        C-->>P: terminal result
        P->>P: continue current task
    else lasting responsibility
        P->>F: record issue, artifact, revision, gaps, acceptance
        F->>F: assign the next owner
        F-->>P: durable handoff reference
    end
```

## Next

- [Delegate a Bounded Task](/docs/agents/runtime/how-to/invoke-sub-agent-from-tool/)
- [Multi-Agent Patterns](/docs/agents/runtime/explanation/multi-agent-patterns/)
- [Awaken Workforce](/docs/workforce/)
