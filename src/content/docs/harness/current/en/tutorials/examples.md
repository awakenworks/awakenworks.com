---
title: "Runnable Examples"
description: "Choose the smallest verified Awaken Agents example for config compilation, direct execution assembly, approvals, memory, skills, or in-process delegation."
evidence:
  - "crates/devtools/awaken-runtime-examples/tests/hello_agent.rs"
section: "Understand"
subsection: "Develop"
order: 25
---

Awaken Agents is the product; its execution core is an internal implementation boundary,
`awaken-runtime` is the core execution crate, and
`awaken-runtime-examples` is the teaching composition root that wires concrete
models, tools, gates, and commit coordinators around that runtime.

The examples are intentionally offline first. Their scripted model executors make
the execution path deterministic, so you can learn and verify Awaken Agents without an
API key before substituting a real provider.

## Choose your starting point

| If you want to… | Start with | What it proves |
| --- | --- | --- |
| Compile authored Agent config | `hello_agent` | `AgentConfig` compiles into a fingerprinted `ExecutableAgentSnapshot`; a model-only turn commits its reply |
| Embed and assemble the runtime directly | `direct_runtime` | Model, tool, permission gate, runtime context, and commit coordinator form one complete run |
| See a consequential tool approval | `coding_agent` | Reads are allowed; edit and shell actions wait for approval; deny leaves the file untouched |
| Combine memory and skills | `memory_skills_combo` test | Recall injection, skill discovery/activation, fork context, and memory writes coexist on bare `Runtime` |
| Delegate to another Agent | `delegation` test | The kernel routes `agent_run` through the delegation service and preserves resumable continuation and usage |

## 1. Smallest Agent

`hello_agent` declares an external `AgentConfig`, compiles it, runs a single
model-only turn, and prints the committed transcript. It needs no API key.

```sh
cargo run -p awaken-runtime-examples --example hello_agent
```

Expected shape:

```text
run finished: Ended(NaturalEnd)
[User] Say hi.
[Assistant] Hello! How can I help?
```

Use this example when config compilation and fingerprint consistency matter more
than tools.

## 2. Direct runtime assembly

`direct_runtime` builds `ExecutableAgentSnapshot` directly and wires the complete
model → tool proposal → permission gate → tool execution → commit path.

```sh
cargo run -p awaken-runtime-examples --example direct_runtime
```

The deterministic model calls `echo`, the ruleset allows it, and the committed
transcript contains the tool result. Replace only the model port to move from the
scripted executor to a configured provider.

## 3. Coding Agent with approval

The coding-agent example is the smallest product-shaped demonstration. It uses
the built-in `read`, `write`, `edit`, `glob`, `grep`, and `bash` tools. Reads can
proceed; mutations park the run with a resume ticket until the caller allows or
denies them.

First verify the behavior offline:

```sh
cargo test -p awaken-runtime-examples --features coding-agent --test coding_agent
```

Then run the interactive TUI with a configured provider:

```sh
cargo run -p awaken-runtime-examples \
  --example coding_agent \
  --features coding-agent-tui
```

The live path requires the provider environment described in the example's own
README. Keep the offline test in CI: it proves approval permits the edit and
denial leaves the real temporary file unchanged.

## Advanced executable recipes

These live under `crates/devtools/awaken-runtime-examples/tests/`. Treat them as
focused **in-process runtime** assembly references, not as a sequence every new
user must complete.

```sh
# Native delegation, waiting/resume, and delegated usage
cargo test -p awaken-runtime-examples --test delegation

# Memory recall + skill activation on bare Runtime
cargo test -p awaken-runtime-examples --test memory_skills_combo

```

Remote hands, relays, sandboxes, workers, and multi-node dispatch are Awaken Agents
deployment capabilities. Their executable verification currently lives beside
the composition tests in the monorepo, but they are documented under
[Awaken Agents execution modes](/docs/agents/concepts/execution-modes/), not as
embedded examples.

## Why examples and tests both exist

Files under `examples/` optimize for reading and running. Matching smoke tests
and the advanced recipes optimize for regression detection. This pairing makes
the examples useful as documentation without letting their API usage silently
rot.

Continue with [First Agent](/docs/agents/runtime/tutorials/first-agent/) for a
copy-into-your-own-crate tutorial, or [Build an Agent](/docs/agents/runtime/how-to/build-an-agent/)
for the complete composition checklist.
