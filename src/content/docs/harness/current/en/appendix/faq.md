---
title: "FAQ"
description: "Common questions about Awaken: when to use the runtime vs the server, choosing a protocol, providers and models, state, and operations."
evidence:
  - "crates/runtime/awaken-runtime/src/lib.rs"
section: "Understand"
subsection: "Appendix"
order: 76
---

## Which LLM providers are supported?

Any provider compatible with `genai` (via `awaken-provider-genai`). This includes
OpenAI, Anthropic, DeepSeek, Google Gemini, Ollama, and others. Register a
provider executor, register a `ModelSpec` in the catalog carrying a stable `id`
plus optional capability fields (context window, max output tokens, modalities,
knowledge cutoff) and pricing, and reference that stable `id` from the agent's
model binding.

## How do I add a new storage backend?

Implement the boundary you need: `Coordinator` for atomic thread commits,
`CommittedThreadView` for the process-local committed view, `CheckpointReader`
for durable committed-event reads, `StreamCheckpointStore` for resumable
streaming, and `ConfigRegistry` (in `awaken-agent-config`) for managed config.
SQLite/Postgres implementations of that config port live in `awaken-config-store`.
The built-in backends are separate crates — `awaken-store-inmem`,
`awaken-store-fs`, `awaken-store-sqlite`, and `awaken-store-postgres` — and every
backend is expected to pass the shared `awaken-store-conformance` suite. Read
those crates as reference implementations.

## Can I use awaken without the server?

Yes. `Runtime` is a standalone library type. Build it with
`Runtime::new().with_llm(...).with_tool(...).with_plugin(...)`, then call
`runtime.run(snapshot, input, ctx)` for one turn (it returns a `RunState`), or
`runtime.run_to_completion(...)` to drive a parked run to a terminal state by
answering approvals inline. The local server (`awaken`) is an
optional HTTP/SSE gateway layered on top.

## How do I run multiple agents?

Delegation is a single tool. The runtime routes the tool whose id matches
`RunDelegationService::tool_id()` — `agent_run` — to the `RunDelegationService` port instead of
the tool registry. Native (in-process) and remote (A2A) sub-agents are peers,
chosen by agent id:

- **Native sub-agents** run in the same process.
- **Remote / managed sub-agents** run over A2A (`awaken-protocol-a2a`) or the
  managed-agents wire (`awaken-protocol-managed` / `awaken-managed-bridge`).

A sub-agent that suspends returns `DelegationStep::Awaiting`, surfacing on the parent as
`AwaitReason::Delegation` — the same park-and-resume machinery as any other
waiting run.

## What is the difference between Run scope and Thread scope?

- **Run scope**: state exists only for the duration of a single run. Use it for
  transient data like step counters, token budgets, and per-run configuration.
- **Thread scope**: state persists across runs within the same thread. Use it
  for conversation memory, user preferences, and accumulated context.

`Scope` (`Run`, `Thread`, `Shared`, `Profile`) is carried by every persisted
`Command`. The optional `StateKey` typed view fixes a key's scope, merge policy,
and value shape while still producing the same `Command`. The same `Key` string
in two scopes is two distinct entries.

## How do I handle tool errors?

The typed `Tool::call` returns `Result<Output, ToolError>`. For an error the
model should see and can react to, return a `ToolOutput` with `is_error` set (for
example via `ToolOutput::error`); the runtime writes it back to the conversation
as a tool response and the loop continues. Return `ToolError` for a hard failure
that should not be handed to the model as a normal result.

## Can tools run in parallel?

Ordinary calls execute in model order. The current bounded parallel path applies
only when a batch consists entirely of delegation calls and that delegation
executor explicitly supports parallel completion; all gates must allow before
it starts. Results remain behind the durable batch publication barrier. Tools
stage `Command`s rather than mutating state, and the commit boundary validates
the combined state before publication.

## How do I debug a run that is stuck?

Look at the run's `RunState`. If it is `Awaiting`, inspect its `ResumeTicket` — the
`AwaitReason` tells you why (`ToolPermission`, `UserInput`,
`ExternalEvent`, `RateLimit`, `ManualPause`, `ScheduledAction`, or `Delegation`).
If it is `Running`, check whether it is approaching `MaxSteps`. Enable
observability for per-step, per-tool, per-LLM-call tracing.

## How do I test without a real LLM?

Implement `LlmExecutor` with canned responses and install it with
`Runtime::with_llm(...)`. See [Testing Strategy](/docs/agents/runtime/how-to/testing-strategy/)
for patterns.

## What happens when parallel tools write to the same state key?

It depends on the key's `MergePolicy`. `Exclusive` treats a second write to the
same `(scope, key)` in one commit batch as a conflict that ends the run with
`Failure::StateConflict`. `Commutative` shallow-merges object values (and
replaces non-object values). `Disjoint` expects at most one writer and lets a
later write replace. See [State and Snapshot Model](/docs/agents/runtime/explanation/state-and-snapshot-model/).

## How do I inject context before inference?

Register a plugin with a `PhaseHook` at `PhaseHookPoint::BeforeInference`. It
writes messages to the `ContextMessages` state key, which the kernel reads and
prepends to that one model request only — they are never committed to the
transcript. This is how the compaction and memory extensions add context. See [Plugin Internals](/docs/agents/runtime/explanation/plugin-internals/).

## Can I write a custom storage backend?

Yes — implement only the boundary you need: `Coordinator`,
`CommittedThreadView` / `CheckpointReader` for committed reads, `ConfigRegistry` for managed
config (implemented by adapters in `awaken-config-store`), and the
`awaken-run-ingress` dispatch contract for durable delivery and
HITL. The in-memory, file, SQLite, and Postgres backends serve as references, and
`awaken-store-conformance` is the shared contract test.

## How does context compaction work?

The compaction extension (`awaken-ext-compact`) runs as a `BeforeInference` hook.
It triggers by estimated token usage when a model window is known, otherwise by
message count. The configured compactor Agent summarizes the older prefix, while
the request-only context keeps the summary, any uncovered bridge, and the recent
tail. See [Optimize Context Window](/docs/agents/runtime/how-to/optimize-context-window/).

## How do I choose between AI SDK v6, AG-UI, A2A, MCP, and ACP protocols?

- **AI SDK v6**: best for React frontends using Vercel AI SDK. Supports text streaming and tool calls.
- **AG-UI**: best for CopilotKit frontends. Supports UI components and agent collaboration.
- **A2A**: best for agent-to-agent communication. Used for remote delegates and inter-service orchestration.
- **MCP HTTP**: best when external MCP clients need to call Awaken tools over JSON-RPC with an `MCP-Session-Id` lifecycle.
- **ACP stdio**: best when an Agent Client Protocol host launches Awaken as a local process and exchanges messages over stdin/stdout.

Each protocol is a `Transcoder` over the same `AgentEvent` stream, so the choice
is about the client ecosystem, not the agent implementation.
