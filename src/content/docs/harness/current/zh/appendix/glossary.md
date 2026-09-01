---
title: "术语表"
description: "Awaken 核心术语的定义 —— runtime、thread、run、phase、类型化 state、plugins、tools 与 serving —— 中英对照。"
evidence:
  - "crates/contract/awaken-agent-contract/src/lib.rs"
---

| 术语 | 中文 | 说明 |
|------|------|------|
| `Thread` | 会话线程 | 持久化的对话 + 状态历史。 |
| `Run` | 运行 | 针对某个 thread 的一次执行尝试。 |
| `Phase` | 阶段 | 已提交的 run 状态：`Phase { Running, Waiting, Ended(EndCause) }`。它不是一串命名的生命周期步骤 —— 一个 hook 在某个 step 内观察的点是单独的 `PhaseHookPoint` 枚举。 |
| `PhaseHookPoint` | 阶段钩子点 | 一个 phase hook 可在一个 step 内观察的五个点：`StepStart`、`BeforeInference`、`AfterInference`、`AfterTool`、`StepEnd`。 |
| `EndCause` | 结束原因 | run 结束的原因：`NaturalEnd`、`MaxSteps`、`Cancelled`、`Stopped(reason)` 或 `Error(Failure)`。 |
| `Runtime` | 智能体运行时 | 可嵌入的执行引擎（`awaken-runtime`）。`Runtime::run` 消费一个 `ExecutableAgentSnapshot`；它拥有 model/tool loop、commit 边界、permission gate 和 resolver。 |
| `AgentConfig` | 智能体规约 | 通过 config 编写的可序列化 agent 定义：`instructions`、`model_binding`、`tool_ids`、`plugin_ids`、per-plugin config 和 context policy。 |
| `ExecutableAgentSnapshot` | 快照 | 运行时装上并执行的、已解析且可序列化的 agent 快照；携带一个 `CatalogFingerprint`。 |
| `AgentEvent` | 智能体事件 | 一次 run 的中立、提交后投影（七个变体）；每个协议 `Transcoder` 把它映射到一种 wire 格式。 |
| `Key` | 状态地址 | persisted `Command`/`Store` core 使用的 plain string newtype；无需注册。 |
| `StateKey` | 类型化状态视图 | 可选 typed whole-value view，固定 key 的 address、scope、merge policy 与 value shape，同时仍产生同一种 `Command`；`FoldStateKey` 增加 deterministic typed update。 |
| `Command` | 状态命令 | 一个被暂存的状态转移 `{ key, scope, merge, action }`，其中 `action` 是 `Set(value)` 或 `Remove`。生产者暂存 command；commit 边界校验并应用它们。 |
| `Scope` | 键作用域 | 一个 key 的声明 scope：`Run`、`Thread`、`Shared` 或 `Profile`。绑定到具体的 run/thread 发生在 commit 时。 |
| `MergePolicy` | 合并策略 | 对某个 `(scope, key)` 的并发写入在一个 commit batch 内如何协调：`Disjoint`（后写替换）、`Commutative`（对象值浅合并，非对象替换）或 `Exclusive`（同一 batch 内的第二次写入是冲突 → `Failure::StateConflict`）。 |
| `Store` | 状态映射 | 物化的读侧 —— 一个从已提交 command 重建以供重放的 `(scope, key) → value` map。Hooks 和 gates 收到一个只读的 `&Store`。 |
| `Plugin` | 插件 | 一个运行时扩展单元：声明一个 `PluginManifest` + `CapabilityBound`，并通过 `Plugin::resolve` 贡献 tools、state keys、phase hooks、tool gates 和 run-end guards。 |
| `Contributions` | 插件贡献 | 一个 `Plugin::resolve` 返回的 bundle —— tools、state keys、phase hooks、tool gates、tool observers、run-end guards 和 dynamic tools —— 合并进 `ResolvedExecutionEnv`。 |
| `CapabilityBound` | 能力边界 | 一个插件可贡献内容的声明上界（tool ids、state keys、phase hooks、gates、guards……）。实际贡献必须是其子集，否则 run 以 `Failure::CapabilityBound` fail closed。 |
| `PhaseHook` | 阶段钩子 | 绑定到一个 `PhaseHookPoint` 的异步 hook；返回一个 `HookReaction`，它暂存 `Command`。它在五个点运行，包括 `AfterTool`（对工具结果作出反应）。在 `BeforeInference` 时，它通过写 `ContextMessages` 状态键注入仅限请求的上下文，该上下文从不提交进 transcript。 |
| `ToolGateHook` | 工具闸门钩子 | 一个执行前 hook，决定一个工具调用被允许、阻断、短路、挂起还是调度。它只能收紧，从不授予。 |
| `RunEndGuard` | 运行结束守卫 | 在 natural-end 边界被询问的 guard；返回 `RunEndDecision::{Complete, Steer}`。第一个 steer 的 guard 获胜，否则 run 结束。 |
| `Tool` | 工具 | 一个模型可调用能力，带一个 id、JSON-Schema 参数，以及一个返回 `ToolOutput` 的 `call`/`invoke` 实现。 |
| `ToolDescriptor` | 工具描述符 | 模型可见的工具元数据：id、描述、参数 schema、content hash。不携带可执行 handle。 |
| `ToolOutput` | 工具结果 | 一个工具调用的结果：`{ call_id, content, is_error, state: Vec<Command> }`。 |
| `HookReaction` | 钩子反应 | 一个 phase hook 返回的内容：暂存的 `Command` 加上已提交的消息。一个 `AfterTool` hook 的消息抵达 transcript；仅限请求的上下文在这里不是消息 —— 它是在 `BeforeInference` 写入的 `ContextMessages` 状态键。 |
| `ResumeTicket` | 挂起票据 | 一个 parked run 的已提交记录（correlation/run/thread/snapshot ids、catalog fingerprint、`AwaitReason`、pending tool、deadline）。只有完全匹配时 resume 才被接受。 |
| `AwaitReason` | 等待原因 | Run 处于 `Awaiting` 的原因：`ToolPermission`、`UserInput`、`ExternalEvent`、`RateLimit`、`ManualPause`、`ScheduledAction` 或 `Delegation`。 |
| `RunDelegationService` | 智能体解析器 | 运行时把委派工具（`agent_run`）路由到的 port；它运行按 agent id 选择的原生（进程内）或远程（A2A）子 agent，返回一个 `DelegationStep`。 |
| `RunActivation` | 运行激活 | 启动一次 run 的不可变、可序列化输入：run id、thread id、snapshot、input 和 trace。 |
| `RunIngress` | 运行入口 | run 提交与控制的投递 port。`DirectRunIngress` 是进程内路径；`DurableRunIngress`（在 `awaken-run-ingress`）是带队列、恢复和 scheduled wake 的单节点持久入口。 |
| `ContextPolicy` | 上下文策略 | 模型可见的 context window 如何被约束：`KeepAll` 或 `KeepLast { keep_last }`。 |
| `ModelSpec` | 模型规约 | 一个模型的 catalog 条目：稳定 `id`、可选的 context window / max output / modalities / knowledge cutoff，以及定价。由 agent 模型绑定通过稳定 id 引用。 |
| `Transcoder` | 流转码器 | 一个有状态的、按协议的映射器，把 `AgentEvent` 流映射到一种协议的 wire 格式；不存在单一固定的 wire envelope。 |
| `TokenUsage` | 令牌用量 | LLM 推理返回的 token 消耗报告。 |
| `CancellationToken` | 取消令牌 | 贯穿一次 run、用于请求取消（`EndCause::Cancelled`）的协作式 token。 |
