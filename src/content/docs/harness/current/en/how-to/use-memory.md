---
title: "Use Memory"
description: "Use this when you want agents to carry knowledge across sessions — saving durable memories and recalling the relevant ones into a new conversation's context."
evidence:
  - "crates/runtime/awaken-ext-memory/src/lib.rs"
section: "Understand"
subsection: "Tune & Operate"
order: 46
---

Use this when you want agents to carry knowledge across sessions — saving durable memories and recalling the relevant ones into a new conversation's context.

## What memory is (and is not)

Memory is *cross-session persistence*: an agent saves durable facts about the
user and their work, and a later, unrelated conversation gets the relevant ones
injected before it starts thinking. It is distinct from context compaction
(`awaken-ext-compact`), which manages the window *within* one session — see
[Optimize the Context Window](/docs/agents/runtime/how-to/optimize-context-window/).

Memory in awaken splits cleanly into two halves you wire independently:

| Half | What it does | Where it lives |
|------|--------------|----------------|
| **Recall (read)** | `MemoryPlugin` injects saved memories as request-only context before each inference | `awaken-ext-memory` |
| **Save (write)** | The `write_memory` tool persists one memory to a local directory | `awaken-ext-memory` |

Both halves are shipped and usable end-to-end from public parts — the combined
recipe is exercised in
`crates/devtools/awaken-runtime-examples/tests/memory_skills_combo.rs`.

## Prerequisites

- A working awaken agent runtime (see [First Agent](/docs/agents/runtime/tutorials/first-agent/))
- The `awaken-ext-memory` crate added to `Cargo.toml` (add `awaken-memory-store`
  for a durable root that survives a restart)

```toml
[dependencies]
awaken-runtime = { git = "https://github.com/AwakenWorks/awaken" }
awaken-ext-memory = { git = "https://github.com/AwakenWorks/awaken" }
tokio = { version = "1", features = ["full"] }
serde_json = "1"
```

## How memories are stored

A memory is one `<slug>.md` file under a directory. `MemoryDir::new(root)` is the
handle: `write(name, content)` sanitizes `name` to a safe stem and writes the
file (a write can never escape `root`), and `entries()` reads them back
newest-first. That is the whole persistence surface the runtime touches — it
knows nothing about ids, databases, or restarts.

A bare `Runtime` example can keep using `MemoryDir` as an in-process adapter. The
The Awaken Agents Session path has one Workspace-scoped `MemoryRepository` data truth:
Memory mounts, recall, extraction, API, and version history all use the same
path-addressed CAS repository; there is no second Memory data track to synchronize.

The resource binding, configuration-version, and Session-activation lifecycle is
owned by [Sessions, resources, and events](/docs/agents/concepts/sessions-and-events/#resources-resolve-once-when-the-session-is-created).
This page retains only the concrete Runtime usage.

## Enable recall

`MemoryPlugin` (id `MEMORY_PLUGIN_ID` = `"memory"`) contributes one
`BeforeInference` phase hook. It reads the memory directory and injects a bounded
recall block as **request-only** context: the model sees it, but it is never
committed to the thread.

```rust
use std::sync::Arc;
use awaken_ext_memory::{MEMORY_PLUGIN_ID, MemoryDir, MemoryPlugin, RecallBounds};
use awaken_runtime::Runtime;
use awaken_runtime_contract::resolved::ModelBinding;
use awaken_runtime_contract::snapshot::ExecutableAgentSnapshot;

let store = MemoryDir::new("/var/lib/awaken/memory");

let runtime = Runtime::new()
    .with_llm(llm)
    .with_plugin(Arc::new(MemoryPlugin::new(store.clone(), RecallBounds::default())));

let config = ExecutableAgentSnapshot::builder("assistant")
    .instructions("You are a helpful assistant.")
    .model(ModelBinding::new("demo", "stub", "stub"))
    .plugins([MEMORY_PLUGIN_ID.to_string()]) // activate recall for this run
    .build();
```

As with any plugin, the run's `plugins([...])` list is what activates it — an
installed-but-unlisted `MemoryPlugin` contributes nothing. See
[Add a Plugin](/docs/agents/runtime/how-to/add-a-plugin/).

### Bounding recall

`RecallBounds` keeps a growing store from flooding the window (defaults shown):

| Field | Default | Meaning |
|-------|---------|---------|
| `per_entry_chars` | 1500 | Truncate each memory to this many chars (0 = unbounded) |
| `total_chars` | 8000 | Cap the whole recall block |
| `max_entries` | 40 | Inject at most this many memories, newest first |
| `select_over` | 12 | Above this many memories, switch to relevance selection |

Recall is newest-first and notes how many older memories it dropped. You can
override the bounds per run through the `memory` config section (a partial section
is fine — unset fields keep their defaults):

```rust
let section = serde_json::json!({ "max_entries": 10, "select_over": 20 });
let config = ExecutableAgentSnapshot::builder("assistant")
    .model(ModelBinding::new("demo", "stub", "stub"))
    .plugins([MEMORY_PLUGIN_ID.to_string()])
    .plugin_config([(MEMORY_PLUGIN_ID.to_string(), section)])
    .build();
```

Once the store holds more than `select_over` memories, the hook can pick the
relevant ones instead of injecting the newest wholesale — but only if you attach
a `RecallSelector` with `MemoryPlugin::new(..).with_selector(..)`. The selector
runs a single `memory-selector` sub-agent call per run (cached by run id). Without
a selector, a large store simply falls back to the newest-first bounded block.

## Enable saving

Saving is the `write_memory` tool. Add its descriptor to the agent and register
`WriteMemoryTool` (bound to the same `MemoryDir` recall reads from) on the
runtime. The tool takes a `name` (short slug) and `content` (the memory text).

```rust
use awaken_ext_builtin_tools::erase;
use awaken_ext_memory::{WriteMemoryTool, write_memory_descriptor};

let runtime = Runtime::new()
    .with_llm(llm)
    .with_tool(erase(WriteMemoryTool::new(store.clone())))
    .with_plugin(Arc::new(MemoryPlugin::new(store.clone(), RecallBounds::default())));

let config = ExecutableAgentSnapshot::builder("assistant")
    .model(ModelBinding::new("demo", "stub", "stub"))
    .tools([write_memory_descriptor()])       // expose write_memory to the model
    .plugins([MEMORY_PLUGIN_ID.to_string()])  // recall the saved memories next time
    .build();
```

Now the agent can save memories mid-conversation, and any later run over the same
`store` recalls them.

## Out-of-band extraction (background save)

Letting the *main* agent decide when to call `write_memory` is the simplest
setup. A cleaner pattern runs extraction as a separate background sub-agent after
each turn, so the memory decision never competes with the user's task. The
`awaken-ext-memory` crate ships the building blocks for this:

- `MEMORY_AGENT_ID` (`"memory-extractor"`), `default_memory_agent(model, instructions)`,
  and `DEFAULT_MEMORY_INSTRUCTIONS` — a single-tool extractor agent config with a
  memory taxonomy prompt.
- `EXTRACT_PROMPT` — the per-run prompt appended to the seeded conversation.
- `SELECTOR_AGENT_ID` / `default_selector_agent` / `DEFAULT_SELECTOR_INSTRUCTIONS`
  for the relevance selector.

Background extraction now has an extension-owned lifecycle. A
`MemoryTerminalObserver` observes only a committed terminal Run, creates a stable
`MemoryExtractionIntent`, and converges through
`Pending → Claimed → Extracted → Stored → Completed` with a receipt. Duplicate
terminal delivery, restart, or response loss reuses the same intent and
idempotency key rather than applying an already stored mutation again.

`awaken-runtime-host` only composes an ordinary auxiliary Agent Run,
`MemoryRepository`, and the public controller/driver. It does not own a second
Memory state machine. A bare `Runtime` may compose the same public ports, or start
with the simpler in-run `write_memory` path above.

## Verify

1. Save a memory, then start a fresh run. The recall block ("Memories from
   earlier conversations…") should appear in what the model sees on the first
   inference of the new run.
2. Confirm recall is request-only: the recalled text must **not** appear in the
   committed thread messages.
3. Check the store on disk — each saved memory is a `<slug>.md` file under the
   `MemoryDir` root.

## Common Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| No recall injected | Plugin id not in the run's `plugins([...])` | Add `MEMORY_PLUGIN_ID` to the activation |
| `write_memory` unknown to the model | Descriptor not exposed | Add `write_memory_descriptor()` to the agent's tools |
| Saved memories not recalled | `WriteMemoryTool` and `MemoryPlugin` point at different roots | Bind both to the same `MemoryDir` |
| `PluginConfigError` | Malformed `memory` section | Match `RecallBounds` field types (integers) |
| Large store still injects newest wholesale | No selector attached | Add `MemoryPlugin::new(..).with_selector(..)` |
| Memories vanish after restart | A bare execution core used a temporary `MemoryDir`, or Awaken Agents lacks a durable `MemoryRepository` | Use a stable embedded directory or a SQLite/Postgres `MemoryRepository` |

## Code References

- `crates/devtools/awaken-runtime-examples/tests/memory_skills_combo.rs` — the bare-`Runtime` recipe: recall injected before inference, `write_memory` persisting, and the inert-without-its-id (G30) case
- `crates/runtime/awaken-ext-memory/src/plugin.rs` — the `BeforeInference` recall hook and the `memory` config section
- `crates/server/awaken-runtime-host/src/memory.rs` — the host's out-of-band extraction orchestration (reference for building your own)

## Key Files

| Path | Purpose |
|------|---------|
| `crates/runtime/awaken-ext-memory/src/lib.rs` | Module root and public re-exports |
| `crates/runtime/awaken-ext-memory/src/plugin.rs` | `MemoryPlugin`, `MEMORY_PLUGIN_ID`, the recall hook |
| `crates/runtime/awaken-ext-memory/src/recall.rs` | `RecallBounds`, bounded recall rendering |
| `crates/runtime/awaken-ext-memory/src/tool.rs` | `WriteMemoryTool`, `write_memory_descriptor` |
| `crates/runtime/awaken-ext-memory/src/localfs.rs` | `MemoryDir`, `sanitize_stem` |
| `crates/runtime/awaken-ext-memory/src/agent.rs` | `MEMORY_AGENT_ID`, `default_memory_agent`, extraction prompts |
| `crates/resources/awaken-memory-store/src/lib.rs` | in-memory / SQLite / Postgres `MemoryRepository` adapters |
| `crates/runtime/awaken-ext-memory/src/extraction.rs` | terminal observer, durable extraction intent, and recovery state machine |

## Related

- [Add a Plugin](/docs/agents/runtime/how-to/add-a-plugin/)
- [Configure Agent Behavior](/docs/agents/how-to/configure-agent-behavior/)
- [Optimize the Context Window](/docs/agents/runtime/how-to/optimize-context-window/)
- [Tool Trait](/docs/agents/runtime/reference/tool-trait/)
