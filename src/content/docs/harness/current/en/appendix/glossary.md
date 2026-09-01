---
title: "Glossary"
description: "Definitions of the core Awaken terms — runtime, thread, run, phase, typed state, plugins, tools, and serving — in English and Chinese."
evidence:
  - "crates/contract/awaken-agent-contract/src/lib.rs"
section: "Understand"
subsection: "Appendix"
order: 75
---

| Term | 中文 | Description |
|------|------|-------------|
| `Thread` | 会话线程 | Persisted conversation + state history. |
| `Run` | 运行 | One execution attempt over a thread. |
| `Phase` | 阶段 | The committed run status: `Phase { Running, Waiting, Ended(EndCause) }`. It is not a sequence of named lifecycle steps — the points a hook observes within a step are the separate `PhaseHookPoint` enum. |
| `PhaseHookPoint` | 阶段钩子点 | The five points a phase hook may observe within one step: `StepStart`, `BeforeInference`, `AfterInference`, `AfterTool`, `StepEnd`. |
| `EndCause` | 结束原因 | Why a run ended: `NaturalEnd`, `MaxSteps`, `Cancelled`, `Stopped(reason)`, or `Error(Failure)`. |
| `Runtime` | 智能体运行时 | The embeddable execution engine (`awaken-runtime`). `Runtime::run` consumes a `ExecutableAgentSnapshot`; it owns the model/tool loop, commit boundary, permission gate, and resolver. |
| `AgentConfig` | 智能体规约 | Serializable agent definition authored through config: `instructions`, `model_binding`, `tool_ids`, `plugin_ids`, per-plugin config, and context policy. |
| `ExecutableAgentSnapshot` | 快照 | The resolved, serializable agent snapshot the runtime installs and executes; carries a `CatalogFingerprint`. |
| `AgentEvent` | 智能体事件 | The neutral, post-commit projection of a run (seven variants); each protocol `Transcoder` maps it to a wire format. |
| `Key` | 状态地址 | The plain string newtype used by the persisted `Command`/`Store` core; it requires no registration. |
| `StateKey` | 类型化状态视图 | An optional typed whole-value view that fixes a key's address, scope, merge policy, and value shape while producing the same `Command`. `FoldStateKey` adds deterministic typed updates. |
| `Command` | 状态命令 | One staged state transition `{ key, scope, merge, action }`, where `action` is `Set(value)` or `Remove`. Producers stage commands; the commit boundary validates and applies them. |
| `Scope` | 键作用域 | The declaration scope of a key: `Run`, `Thread`, `Shared`, or `Profile`. Binding to a concrete run/thread happens at commit. |
| `MergePolicy` | 合并策略 | How concurrent writes to one `(scope, key)` reconcile in a commit batch: `Disjoint` (later write replaces), `Commutative` (object values shallow-merge, non-object replace), or `Exclusive` (a second write in one batch is a conflict → `Failure::StateConflict`). |
| `Store` | 状态映射 | The materialized read side — a `(scope, key) → value` map rebuilt from committed commands for replay. Hooks and gates receive a read-only `&Store`. |
| `Plugin` | 插件 | A unit of runtime extension: declares a `PluginManifest` + `CapabilityBound` and contributes tools, state keys, phase hooks, tool gates, and run-end guards through `Plugin::resolve`. |
| `Contributions` | 插件贡献 | The bundle a `Plugin::resolve` returns — tools, state keys, phase hooks, tool gates, tool observers, run-end guards, and dynamic tools — merged into `ResolvedExecutionEnv`. |
| `CapabilityBound` | 能力边界 | The declared upper bound of what a plugin may contribute (tool ids, state keys, phase hooks, gates, guards, …). Actual contributions must be a subset, or the run fails closed with `Failure::CapabilityBound`. |
| `PhaseHook` | 阶段钩子 | An async hook bound to one `PhaseHookPoint`; returns a `HookReaction` that stages `Command`s. It runs at five points including `AfterTool` (which reacts to a tool result). At `BeforeInference` it injects request-only context by writing the `ContextMessages` state key, which is never committed to the transcript. |
| `ToolGateHook` | 工具闸门钩子 | A pre-execution hook that decides whether a tool call is allowed, blocked, short-circuited, suspended, or scheduled. It can only restrict, never grant. |
| `RunEndGuard` | 运行结束守卫 | A guard consulted at the natural-end boundary; returns `RunEndDecision::{Complete, Steer}`. The first guard that steers wins, otherwise the run ends. |
| `Tool` | 工具 | A model-callable capability with an id, JSON-Schema parameters, and a `call`/`invoke` implementation returning a `ToolOutput`. |
| `ToolDescriptor` | 工具描述符 | Model-visible tool metadata: id, description, parameters schema, content hash. Carries no executable handle. |
| `ToolOutput` | 工具结果 | A tool call's result: `{ call_id, content, is_error, state: Vec<Command> }`. |
| `HookReaction` | 钩子反应 | What a phase hook returns: staged `Command`s plus committed messages. An `AfterTool` hook's messages reach the transcript; request-only context is not a message here — it is the `ContextMessages` state key written at `BeforeInference`. |
| `ResumeTicket` | 挂起票据 | The committed record of a parked run (correlation/run/thread/snapshot ids, catalog fingerprint, `AwaitReason`, pending tool, deadline). A resume is accepted only on an exact match. |
| `AwaitReason` | Await reason | Why a Run is `Awaiting`: `ToolPermission`, `UserInput`, `ExternalEvent`, `RateLimit`, `ManualPause`, `ScheduledAction`, or `Delegation`. |
| `RunDelegationService` | 智能体解析器 | The port the runtime routes the delegation tool (`agent_run`) to; it runs native (in-process) or remote (A2A) sub-agents chosen by agent id, returning an `DelegationStep`. |
| `RunActivation` | 运行激活 | The immutable, serializable input to start a run: run id, thread id, snapshot, input, and trace. |
| `RunIngress` | 运行入口 | The delivery port for run submission and control. `DirectRunIngress` is the in-process path; `DurableRunIngress` (in `awaken-run-ingress`) is single-node durable with queue, recovery, and scheduled wake. |
| `ContextPolicy` | 上下文策略 | How the model-visible context window is bounded: `KeepAll` or `KeepLast { keep_last }`. |
| `ModelSpec` | 模型规约 | A catalog entry for a model: stable `id`, optional context window / max output / modalities / knowledge cutoff, and pricing. Referenced by a stable id from an agent's model binding. |
| `Transcoder` | 流转码器 | A stateful per-protocol mapper from the `AgentEvent` stream to a protocol's wire format; there is no single fixed wire envelope. |
| `TokenUsage` | 令牌用量 | Token consumption report from LLM inference. |
| `CancellationToken` | 取消令牌 | Cooperative token threaded through a run to request cancellation (`EndCause::Cancelled`). |
