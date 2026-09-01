---
title: "Optimize the Context Window"
description: "Trim the model request view or summarize an older prefix without rewriting committed Thread history."
evidence:
  - "crates/runtime/awaken-ext-compact/src/config.rs"
section: "Understand"
subsection: "Tune & Operate"
order: 47
---

Awaken has two independent, non-destructive controls for model context:

| Control | Owner | Effect |
|---|---|---|
| Request trimming | `ContextPolicy` in the executable snapshot | Keeps a fixed recent message suffix in each model request. |
| Compaction | the `compact` plugin | Replaces an older request prefix with a summary after the summary is available. |

Neither path deletes or rewrites committed Thread messages.

## Static structure

`ExecutableAgentSnapshot.resolved_spec.context_policy` owns simple trimming.
`CompactConfig` owns compaction policy. `CompactPlugin` contributes one
`BeforeInference` hook and writes request-only data through the shared
`ContextMessages` and `ContextWindow` state keys. The host supplies the actual
summary work through either an Agent-backed `RawTool` or `CompactBackend`; there
is no second compaction store or registry.

## Request trimming

The default is `ContextPolicy::KeepAll`. `KeepLast` preserves the leading system
prefix and only the last `keep_last` non-system messages in the model request.
`keep_last: 0` therefore leaves only the system prefix.

```rust
use awaken_runtime_contract::resolved::{ContextPolicy, ModelBinding};
use awaken_runtime_contract::snapshot::ExecutableAgentSnapshot;

let snapshot = ExecutableAgentSnapshot::builder("assistant")
    .instructions("You are a helpful assistant.")
    .model(ModelBinding::new("anthropic", "claude-sonnet", "anthropic"))
    .context_policy(ContextPolicy::KeepLast { keep_last: 12 })
    .build();
```

## Compaction policy

`CompactConfig` supports two trigger modes:

- When `max_tokens` is set, a deterministic estimate triggers at
  `max_tokens * trigger_ratio`.
- When no model window is known, `threshold` is the message-count fallback.

The recent `keep_last` messages remain verbatim. `prefetch_ratio` may start
best-effort background summarization before the hard trigger; a hard-trigger
cache miss still resolves the exact stable compactor Run.

```rust
use awaken_ext_compact::CompactConfig;

let compact = CompactConfig {
    agent_id: "team-compactor".into(),
    agent_instructions: None,
    threshold: 40,
    keep_last: 8,
    max_tokens: Some(200_000),
    trigger_ratio: 0.8,
    prefetch_ratio: 0.75,
    instructions: Some(
        "Preserve open tasks, decisions, paths, identifiers, and commands.".into(),
    ),
};
```

`agent_id` selects an ordinary published auxiliary Agent. `instructions` is the
per-compaction task prompt; `agent_instructions` optionally overrides the
selected compactor Agent's system instructions. Deserialization rejects an
empty `agent_id`, `threshold == 0`, `max_tokens == 0`, a `trigger_ratio` outside
`(0, 1]`, or a `prefetch_ratio` outside `(0, 1)`.

For a hosted composition, `SharedHost::with_compaction(threshold, keep_last)`
wires message-count compaction, while
`SharedHost::with_compaction_tokens(max_tokens, trigger_ratio, keep_last)` wires
the token-aware path. Both use the same `CompactPlugin` and ordinary compactor
Agent substrate.

## Dynamic behavior

```mermaid
sequenceDiagram
    participant R as Runtime
    participant P as CompactPlugin
    participant B as Agent tool / CompactBackend
    participant S as Run state
    R->>P: BeforeInference(committed conversation)
    P->>P: choose token or message trigger
    alt below trigger
        P->>S: record evaluated-without-fold for this Run
    else fold required
        P->>B: resolve exact older prefix + prompt
        B-->>P: summary and covered prefix
        P->>S: write ContextMessages + ContextWindow + marker
        S-->>R: summary + optional bridge + recent tail
    end
    R->>R: assemble model request; committed history remains unchanged
```

The hook evaluates at most once per Run. A completed background artifact is an
accelerator, not a second authority: it is accepted only when its covered prefix
fits the current fold point. Request-only summary state replays across later
steps and same-Run resume.

## Truncation recovery is separate

Compaction manages the input window. Output truncation is handled separately:
when inference stops at `MaxTokens` after partial text, the runtime can continue
the same step. `Runtime::with_max_continuation_retries` sets that retry budget
(default `2`).

```rust
let runtime = Runtime::new()
    .with_llm(llm)
    .with_max_continuation_retries(3);
```

## Verify

1. Use a low threshold and confirm the request contains `Summary of earlier conversation:` plus the recent tail.
2. Confirm the committed Thread still contains the original messages.
3. With token-aware compaction, test values immediately below and at the configured ratio.
4. Restart or resume the same Run and confirm the recorded summary is reused rather than recomputed.

## Key files

- `crates/runtime/awaken-runtime-contract/src/resolved.rs` — `ContextPolicy`
- `crates/runtime/awaken-ext-compact/src/config.rs` — `CompactConfig`
- `crates/runtime/awaken-ext-compact/src/plugin.rs` — `CompactPlugin`
- `crates/runtime/awaken-ext-compact/src/backend.rs` — `CompactBackend`
- `crates/server/awaken-runtime-host/src/host/build.rs` — host composition helpers
- `crates/runtime/awaken-runtime/src/runtime.rs` — output-continuation retry budget

## Related

- [Config Reference](/docs/agents/runtime/reference/config/)
- [Plugin Internals](/docs/agents/runtime/explanation/plugin-internals/)
- [Add a Plugin](/docs/agents/runtime/how-to/add-a-plugin/)
