---
title: "Extend Awaken Agents internals"
description: "Choose the Rust extension point you need, run one Agent, and preserve Awaken Agents capability, state, and step-commit boundaries."
evidence:
  - "crates/runtime/awaken-runtime/src/runtime.rs"
section: "Understand"
order: 0
---

Use this section only when you need to embed the Rust Runtime or implement a
Rust Tool, provider, Plugin, Sandbox backend, or kernel invariant. If you only
need to configure, publish, or operate an Agent, start with [Awaken Agents](/docs/agents/).
The execution core described here is part of Awaken Agents, not a second product.

Begin by running one immutable `ExecutableAgentSnapshot` with one model binding
and one Tool. The smallest shape is:

```rust
let runtime = Runtime::new()
    .with_llm(Arc::new(my_llm))
    .with_tool(Arc::new(search));

let config = ExecutableAgentSnapshot::builder("assistant")
    .instructions("Answer from cited sources.")
    .model(ModelBinding::new("demo", "model", "awaken"))
    .build();

let state = runtime
    .run(&config, "Find the release notes.", RuntimeRunContext::new())
    .await?;
```

When this returns, one Agent has completed a Runtime run in your Rust process.
Next, replace `my_llm` or `search` with the capability you are adding and keep
the same state and commit path.

Your Rust process owns invocation, IO, scheduling, capability implementations,
and deployment. The Awaken Agents execution core owns what happens *inside* a run: resolve the immutable
snapshot, discover and activate Skills, execute the model/tool loop, apply hooks
and gates, stage state changes, and commit the step.

## Choose the Runtime boundary you need to change

| Goal | Start here | Do not do this here |
| --- | --- | --- |
| Add product capability | [Add a Tool](/docs/agents/runtime/how-to/add-a-tool/) | Do not duplicate tool implementation in a frontend or prompt. |
| Add lifecycle constraints | [Add a Plugin](/docs/agents/runtime/how-to/add-a-plugin/) | Do not leave permission or state invariants as prompt text alone. |
| Add a model or external-Agent connection | [Configuration resolution and Agent delegation](/docs/agents/runtime/explanation/agent-resolution/) | Do not let an application protocol own runtime state. |
| Add an isolation or execution backend | [Runtime–service architecture](/docs/agents/runtime/explanation/architecture/) | Do not bypass Agents placement, permission, or commit boundaries. |
| Change the Runtime kernel | [Architecture invariants](/docs/agents/runtime/explanation/architecture-invariants/) | Do not create a second state or commit authority. |

Application teams usually configure and bind these capabilities in Awaken Agents. Enter
this path only to implement a new Rust capability or change Runtime semantics.

## One behavior, different capability bindings

Awaken Agents does not pretend local and hosted environments are identical. It makes
their differences explicit without forcing agent behavior to fork.

| Stable agent contract | Local binding | Governed binding |
| --- | --- | --- |
| `SKILL.md` discovery and activation | Live workspace Skill directory | Delivered catalog or workspace mounted into a sandbox |
| Neutral tool ids and schemas | In-process `read`, `write`, `edit`, `glob`, `grep`, `bash` | Scoped in-process, sandbox, MCP, or remote-hand executors |
| Permission and capability rules | Caller approval in a CLI or application | Central policy, approval, credential, and placement decisions |
| Staged state and step commit | Application-owned coordinator/store | Awaken Agents durable coordinator and recovery |

The promise is **portable behavior, not identical authority**. A Skill's
`allowed-tools` may narrow the capabilities its host granted, but can never grant
filesystem, shell, network, or credential access by itself.

## What happens inside one run

1. The Runtime resolves the immutable snapshot and the capabilities supplied by
   the host.
2. It discovers and activates eligible Skills, then calls the model with the
   current messages and typed state.
3. A requested Tool passes through capability checks, policy, and any approval
   gate before execution.
4. Tool output, messages, events, run state, and state commands remain staged
   until the step can commit together.
5. A rejection returns a typed waiting or failure outcome. A process crash leaves
   the previous commit as the recovery point.

This sequence is the reason to enter Runtime internals. It lets a new capability
join the existing loop without creating another state store, permission path, or
commit boundary.

| When this matters | Common SDK or graph-runtime baseline | Awaken Agents guarantee |
| --- | --- | --- |
| A plugin gains access | Application conventions constrain what it uses | Undeclared tool, state, hook, action, guard, or gate access fails closed |
| The run moves from a laptop to a governed host | Rewrite tool wrappers, Skill loading, and prompts for the new environment | Keep Skill and loop semantics; bind a different capability implementation at the host boundary |
| Parallel tools write state | A reducer or application code resolves conflicts | `Disjoint`, `Commutative`, and `Exclusive` merge policy is explicit before commit |
| A tool needs approval | Middleware or application state coordinates the pause | A permission verdict produces a typed, resumable waiting outcome on the same path |
| A process crashes | Checkpoints, messages, effects, and logs may use different boundaries | Messages, state commands, audit, run state, and disposition share one step commit boundary |

Choose a lightweight SDK for minimum setup, LangGraph for graph-centric
orchestration, or Rig for broad Rust provider integrations. Extend Awaken Agents when
a Tool call has consequences and these execution invariants must stay intact.

## The internal boundary

The execution core is not the HTTP service. Public protocols, managed configuration,
credentials, durable dispatch, workers, sandboxes, tenancy, and operational
endpoints belong to [Awaken Agents](/docs/agents/).
Awaken Agents connects these responsibilities through typed, data-only ports; the execution core never depends
back on the service plane.

The current durable Skill store persists `SKILL.md` content. Do not assume a
complete local Skill directory, including arbitrary scripts, references, and
assets, is automatically packaged and reproduced in every remote sandbox; full
bundle materialization is a separate deployment capability.

See the [Awaken Agents execution ownership diagram](/docs/agents/runtime/explanation/architecture/)
before choosing crates or deployment components.

## Continue with the change you need

- [Get started](/docs/agents/runtime/get-started/): verify and embed the runtime.
- [Runnable examples](/docs/agents/runtime/tutorials/examples/): choose an offline-first
  example from minimal config through approvals, memory, and delegation.
- [First Agent](/docs/agents/runtime/tutorials/first-agent/): assemble the smallest run.
- [First Tool](/docs/agents/runtime/tutorials/first-tool/): add typed work safely.
- [Architecture](/docs/agents/runtime/explanation/architecture/): understand ownership
  and one-way dependencies.
- [Runtime reference](/docs/agents/runtime/reference/overview/): choose runtime crates.
