---
title: "Run the Awaken Agents execution core locally"
description: "Run two offline Rust examples, inspect the committed transcript, and choose the right path for embedding or extending Awaken Agents execution."
evidence:
  - "crates/devtools/awaken-runtime-examples/examples/direct_runtime.rs"
section: "Understand"
order: 2
---

Use this page when you need to run or embed Awaken's in-process Rust Runtime.
If the task needs a server, Console, HTTP/SSE, managed configuration, or Worker
operations, start with [Run your first Awaken Session](/docs/agents/get-started/)
instead.

The first two runs below are offline. They use deterministic model doubles, so
you do not need a provider account or API key.

## 1. Run the smallest Agent

From the Awaken repository root:

```sh
cargo run -p awaken-runtime-examples --example hello_agent
```

This example declares an `AgentConfig`, compiles it into an
`ExecutableAgentSnapshot`, and runs one turn. The terminal should end with a
line like this, followed by the committed transcript:

```text
run finished: Ended(NaturalEnd)
--- committed transcript ---
```

At this point you have run the Runtime without tools, permissions, storage, a
server, or a real model.

## 2. Add a Tool and permission gate

Run the second example:

```sh
cargo run -p awaken-runtime-examples --example direct_runtime
```

`direct_runtime` builds the `ExecutableAgentSnapshot` directly, registers an
`echo` Tool, and allows that Tool through one `PermissionGate`. It uses the same
`Runtime::run` call as the first example. The committed transcript should
contain the Tool result and finish with `NaturalEnd`.

Choose the example that matches how your application starts:

- `hello_agent.rs` is the path for applications that author configuration and compile it;
- `direct_runtime.rs` is the path for applications that assemble Runtime ports themselves.

Both arrive at the same executable snapshot contract before `Runtime::run`
begins. Start from one path; there is no need to layer one setup over the other.

## 3. Check both examples

```sh
cargo test -p awaken-runtime-examples --test hello_agent --test direct_runtime
```

Both tests should pass. One checks the compiled configuration and committed
assistant reply. The other checks that the allowed Tool ran and its result was
committed.

## Where each value belongs

The Runtime separates configuration by lifetime:

| Lifetime | Owner | Put here |
| --- | --- | --- |
| Process | `Runtime` | model, Tool, permission, storage, and other process-wide ports |
| Agent publication | `ExecutableAgentSnapshot` | instructions, model binding, Tool descriptors, Plugins, and limits |
| One run | `RuntimeRunContext` | commit coordinator, streaming sink, and services used only by this run |

Resolve application settings before calling the Runtime. The execution core does not read
model-specific environment-variable conventions or create an HTTP control
plane around these values.

## Choose the next task

| You want to | Continue with | First result |
| --- | --- | --- |
| Put the minimal Runtime in your own binary | [First Agent](/docs/agents/runtime/tutorials/first-agent/) | Your binary completes one committed run |
| Add a typed Tool | [First Tool](/docs/agents/runtime/tutorials/first-tool/) | The Tool schema, call, result, and state write appear in one run |
| Start from a reusable project shape | [Build an Agent](/docs/agents/runtime/how-to/build-an-agent/) | A project with explicit Runtime, snapshot, and run boundaries |
| Use a real model | [Runnable Examples](/docs/agents/runtime/tutorials/examples/) | The same run shape uses a provider executor and credential |
| Add durable local state | [State & Storage](/docs/agents/runtime/state-and-storage/) | A committed state path owned by the embedding application |

## Act only on a reported result

| Symptom | Check | Action |
| --- | --- | --- |
| Cargo cannot find `awaken-runtime-examples` | Current directory | Run the command from the Awaken workspace root. |
| Either checked example no longer reaches `NaturalEnd` | The named example test and local source changes | Run the test in step 3. If it fails, inspect changes to that example and its Runtime ports before extending it. |
| The examples pass but an embedding binary fails | Snapshot, Runtime ports, and `RuntimeRunContext` | Compare one lifetime at a time. Keep process settings out of the immutable snapshot. |

The two named examples do not contact a provider and do not need an API key.
Tool errors become model-visible error results; the loop may correct its next
call. A short-lived Tool error is not a maintenance task by itself.

## Leave the Runtime path when

- You need recovery, distributed Workers, or Sandboxes: use [Awaken Agents production reliability](/docs/agents/concepts/production-reliability/).
- You need HTTP, protocol, or frontend integration: use [Awaken Agents](/docs/agents/).
- You are preparing a deployment: use [Deploy and operate Awaken](/docs/agents/how-to/self-host#production-hardening).
