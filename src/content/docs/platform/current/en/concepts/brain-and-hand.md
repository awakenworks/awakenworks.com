---
title: "Decide when a Session needs a local execution environment"
description: "Choose when local work needs a Session Environment, and understand how one Worker claim keeps reasoning and tool execution inside one boundary."
evidence:
  - "crates/server/awaken-runtime-host/src/session_environment.rs"
  - "crates/contract/awaken-provisioning-contract/src/spec.rs"
  - "crates/server/awaken-runtime-host/src/provisioning.rs"
  - "crates/worker/awaken-connection-plan/src/plan.rs"
section: "Understand"
subsection: "System model"
order: 13
---

A Session needs a local execution environment only when its work depends on a
filesystem, a local process, a mounted resource, or a local tool. Model
reasoning alone does not require one. This distinction lets an application avoid
creating a Sandbox for work that never uses it, without introducing a second
execution path.

## Start with the work that must run locally

| Session work | Environment decision |
| --- | --- |
| Native model work with no local input or tool | With `on_tool_use`, start without a Sandbox. |
| Native work that reaches a local tool | Realize the Session Environment before the first local tool executes. |
| Work with mounted files, repositories, executable Skills, or an `eager` policy | Realize the Environment before execution depends on those inputs. |
| ACP process | Run the process inside the realized Session Environment. Deferred provisioning is not accepted. |
| Outbound A2A call with no local dependency | Call the remote Agent without creating a local Environment. A Session that also requires local inputs is rejected instead of silently changing backend. |

The invariant is one Worker claim, one Session Environment, and one tool
executor. Brain and Hand name different responsibilities inside that path; they
are not independently scheduled services.

## Static structure

```mermaid
flowchart LR
    Client["Protocol adapter"] --> Coordinator["Coordinator<br/>Session · Run · durable dispatch"]
    Coordinator --> Worker["one eligible Worker claim<br/>lease + epoch"]
    Worker --> Backend{"published backend"}
    Backend --> Native["Native reasoning loop"]
    Backend --> ACP["ACP process"]
    Backend --> A2A["outbound A2A"]
    Native --> Environment["Session Environment<br/>workspace + Sandbox lifecycle"]
    ACP --> Environment
    Environment --> Hand["one Environment-owned Hand<br/>one ToolExecutor"]
    A2A --> Remote["remote Agent"]
    Native --> Commit["claim-fenced commit"]
    ACP --> Commit
    A2A --> Commit
    Hand --> Commit
    Commit --> Facts[(committed Thread facts)]
```

| Owner | Owns | Does not own |
| --- | --- | --- |
| Coordinator | Session and Run truth, dispatch, eligibility, claim epoch | a live Sandbox or tool process |
| Worker | one claimed attempt and the physical Environment it realizes | the Agent catalog or durable conversation history |
| Session Environment | workspace, Sandbox lifecycle, local processes, one Hand channel | model selection or commit authority |
| Native backend | the model loop; local calls route through the Environment | another tool placement decision |
| ACP backend | the external process inside the same Environment | a host-global work path |
| Outbound A2A backend | authenticated remote Agent I/O | local mounts, local tools, or a local Hand |

`ConnectionPlan` carries secret-free topology. It does not select another Hand
or create another execution owner. Agent publication and deployment
configuration also do not carry a separate Hand selector.

## Dynamic behavior

```mermaid
sequenceDiagram
    participant C as Coordinator
    participant W as Worker
    participant E as Session Environment
    participant B as Backend
    participant F as Commit authority

    C->>W: claim exact Session work with epoch
    W->>W: check frozen Sandbox requirements
    alt Native with deferred local demand
      W->>B: start reasoning without a Sandbox
      B->>E: first local tool call
      E->>E: realize Environment and bind one Hand
      E-->>B: typed ToolOutput
    else ACP or eager local demand
      W->>E: realize the frozen Environment
      E->>B: start process or expose local inputs
    else outbound A2A without local demand
      W->>B: call remote Agent
      Note over W,B: no local Environment is created
    end
    B->>F: commit result with claim fence
```

`sandbox_provisioning` is part of the published Environment policy. `eager`
realizes the Environment before the backend needs it. `on_tool_use` allows a
Native Run to begin without one, but local inputs can still make realization
necessary before the first model step.

Image preparation, capacity, mounts, networking, credential delivery, and
health checks remain separate realization stages. If the frozen requirements
cannot be met, placement fails closed. The system does not fall back to a weaker
Sandbox or another backend.

## What the system handles on its own

An idle Hand hibernates without changing Environment or workspace ownership.
The next undispatched local call recreates it through the same Environment; this
does not create a maintenance task. A Session created with `on_tool_use` may
therefore have no Sandbox until local demand appears.

After a tool has been dispatched, a lost channel is not silently replayed
because the external effect may already have happened. That Run result follows
the indeterminate-effect rules in [Production reliability](./production-reliability).
Terminal Environment release is irreversible.

Continue with [Execution modes](./execution-modes),
[Configure Sandbox tiers](/docs/agents/how-to/configure-sandbox-tiers/), and
[Production reliability](./production-reliability). Exact Managed Agents wire
differences belong to the [compatibility matrix](/docs/agents/compatibility/).
