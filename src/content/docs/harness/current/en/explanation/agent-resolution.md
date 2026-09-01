---
title: "Resolve an Agent publication"
description: "Follow editable AgentConfig data through validation, compilation, publication, and the immutable snapshot pinned to a Run."
evidence:
  - "crates/control/awaken-agent-config/src/compile.rs"
  - "crates/control/awaken-agent-config/src/store.rs"
section: "Understand"
order: 19
---

Use this page when changing how authored Agent behavior becomes executable.
Configuration resolution ends at an immutable `ExecutableAgentSnapshot`; it
does not run inference, choose a Worker, or delegate to another Agent.

## Keep authored and executable data separate

| Form | Owner | Can change? | Used by an active Run? |
| --- | --- | --- | --- |
| `AgentConfig` | configuration authoring | yes | no |
| publication | configuration store | new versions may be added | only through its pinned snapshot |
| `ExecutableAgentSnapshot` | Runtime contract | no | yes |
| provider credential material | final execution boundary | may rotate under its own policy | never serialized into the snapshot |

```mermaid
flowchart LR
  A[AgentConfig] --> V[Validate references and fields]
  V --> C[compile_published or compile_resolved]
  C --> S[ExecutableAgentSnapshot]
  S --> P[Publication store and executable catalog]
  P --> R[RunActivation pins exact snapshot]
  R --> K[Runtime kernel]
  M[Later AgentConfig revision] --> N[New publication]
  N -. does not replace .-> R
```

The snapshot contains the behavior a Run may use: instructions, model
candidates, Tool descriptors, Plugins, context policy, limits, and a content
identity. It carries references and resolved choices, not plaintext secrets or
service-owned mutable records.

## Resolution sequence

```mermaid
sequenceDiagram
  participant Authoring as Config authoring
  participant Compiler as Agent compiler
  participant Catalog as Publication catalog
  participant Host as Run host
  participant Runtime
  Authoring->>Compiler: AgentConfig plus resolvable references
  Compiler->>Compiler: validate and derive immutable fields
  alt invalid or ambiguous input
    Compiler-->>Authoring: typed compile error, no publication
  else valid input
    Compiler->>Catalog: store snapshot and publication identity
    Host->>Catalog: read exact publication for Run
    Catalog-->>Host: immutable snapshot
    Host->>Runtime: RunActivation with pinned snapshot
  end
```

`awaken-config-resolver` supplies the management plane's read and resolution
face for model offerings and credentials. Its concrete `ResolvedInference`
type is for preview and probe operations. Production publication emits
secret-free model candidates; Runtime does not call the management resolver
during a Run.

## Failure and change behavior

- Missing, ambiguous, or incompatible references fail before publication.
- A Run that cannot obtain its exact snapshot is rejected before execution; it
  does not fall forward to the latest Agent version.
- Publishing a new version changes later Runs. Running, waiting, and retried
  Runs keep their original behavior identity.
- Credential materialization and Worker placement occur after publication and
  remain owned by their execution boundaries.

These are resolution outcomes, not troubleshooting procedures. Correct the
authored reference or restore the exact publication named by the reported
result; automatic retries must not select different behavior.

Delegation is a separate execution path. See [Invoke a sub-Agent from a
Tool](/docs/agents/runtime/how-to/invoke-sub-agent-from-tool/) and [Multi-Agent
patterns](/docs/agents/runtime/explanation/multi-agent-patterns/).
