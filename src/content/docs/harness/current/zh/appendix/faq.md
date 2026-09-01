---
title: "常见问题"
description: "关于 Awaken 的常见问题：何时用 runtime、何时用 server、如何选协议、providers 与 models、state，以及运维。"
evidence:
  - "crates/runtime/awaken-runtime/src/lib.rs"
---

## 支持哪些 LLM provider？

任何兼容 `genai` 的 provider 都可以（经由 `awaken-provider-genai`）。包括 OpenAI、
Anthropic、DeepSeek、Google Gemini、Ollama 等。注册一个 provider executor，在 catalog
中注册一个携带稳定 `id` 加上可选 capability 字段（context window、最大输出 token、
modalities、knowledge cutoff）和定价的 `ModelSpec`，然后从 agent 的模型绑定引用那个
稳定 `id`。

## 如何添加新的存储后端？

实现你需要的边界：原子 thread commit 用 `Coordinator`，进程内已提交视图用
`CommittedThreadView`，持久化的已提交 event 读取用 `CheckpointReader`，可 resume
的流式用 `StreamCheckpointStore`，managed config 用 `ConfigRegistry`（在
`awaken-agent-config`）；该 config port 的 SQLite/Postgres 实现在 `awaken-config-store`。
内置后端是独立的 crate —— `awaken-store-inmem`、
`awaken-store-fs`、`awaken-store-sqlite` 和 `awaken-store-postgres` —— 且每个后端都应
通过共享的 `awaken-store-conformance` 套件。把这些 crate 作为参考实现来阅读。

## 不启用 server 能用 awaken 吗？

可以。`Runtime` 是一个独立的 library 类型。用
`Runtime::new().with_llm(...).with_tool(...).with_plugin(...)` 构建它，然后调用
`runtime.run(snapshot, input, ctx)` 执行一个 turn（它返回一个 `RunState`），或调用
`runtime.run_to_completion(...)` 通过内联回答审批把一个 parked run 推进到终态。本地
server（`awaken`）是叠加在其上的可选 HTTP/SSE 网关。

## 如何运行多个 agent？

委派是一个单一的工具。运行时把 id 匹配 `RunDelegationService::tool_id()` 的工具 —— `agent_run`
—— 路由到 `RunDelegationService` port，而不是 tool registry。原生（进程内）与远程（A2A）子
agent 是对等的，按 agent id 选择：

- **原生子 agent** 在同一进程中运行。
- **远程 / 托管子 agent** 通过 A2A（`awaken-protocol-a2a`）或 managed-agents 线
  （`awaken-protocol-managed` / `awaken-managed-bridge`）运行。

一个挂起的子 agent 返回 `DelegationStep::Awaiting`，在父 agent 上呈现为
`AwaitReason::Delegation` —— 与任何其它等待中的 run 相同的 park-and-resume 机制。

## Run scope 和 Thread scope 的区别是什么？

- **Run scope**：状态只在一次 run 期间存在。用于步骤计数、token 预算和 per-run 配置这
  类临时数据。
- **Thread scope**：状态在同一 thread 内跨 run 持续存在。用于会话记忆、用户偏好和累积
  的 context。

每条 persisted `Command` 都携带 `Scope`（`Run`、`Thread`、`Shared`、`Profile`）。
可选 `StateKey` typed view 固定 key 的 scope、merge policy 与 value shape，但仍产生同一
种 `Command`。同一个 `Key` 字符串在两个 scope 下是两个不同条目。

## 如何处理工具错误？

类型化的 `Tool::call` 返回 `Result<Output, ToolError>`。对于模型应该看到并能作出反应
的错误，返回一个设置了 `is_error` 的 `ToolOutput`（例如通过 `ToolOutput::error`）；
运行时把它作为 tool 响应写回对话，loop 继续。对于不应作为正常结果交给模型的硬失败，
返回 `ToolError`。

## 工具可以并行执行吗？

普通调用按模型顺序执行。当前有边界的 parallel path 只适用于 batch 全部是 delegation
call、且该 delegation executor 显式支持 parallel completion 的情况；启动前所有 gate
必须允许。结果仍留在 durable batch publication barrier 后。Tool 只暂存 `Command`，
commit 边界会在发布前校验组合后的 state。

## run 卡住时怎么排查？

看 run 的 `RunState`。如果是 `Awaiting`，检查它的 `ResumeTicket` —— `AwaitReason` 告诉你
原因（`ToolPermission`、`UserInput`、`ExternalEvent`、`RateLimit`、
`ManualPause`、`ScheduledAction` 或 `Delegation`）。如果是 `Running`，检查它是否接近
`MaxSteps`。启用 observability 以获得 per-step、per-tool、per-LLM-call 的 tracing。

## 不连真实 LLM 怎么测试？

实现一个带预设响应的 `LlmExecutor`，并用 `Runtime::with_llm(...)` 安装它。模式见
[测试策略](/zh/docs/agents/runtime/how-to/testing-strategy/)。

## 并行工具同时写同一个状态键会怎样？

取决于该 key 的 `MergePolicy`。`Exclusive` 把同一 commit batch 内对同一 `(scope, key)`
的第二次写入视为冲突，使 run 以 `Failure::StateConflict` 结束。`Commutative` 对对象值
做浅合并（对非对象值则替换）。`Disjoint` 期望至多一个写入者，并让后写替换。见
[状态与快照模型](/zh/docs/agents/runtime/explanation/state-and-snapshot-model/)。

## 如何在推理前注入 context？

注册一个在 `PhaseHookPoint::BeforeInference` 带 `PhaseHook` 的插件。它把消息写入
`ContextMessages` 状态键，内核读取它并只为这一次模型请求前置它们 —— 它们从不被提交进
transcript。这就是 compaction 和 memory 扩展添加 context 的方式。见
[插件内部机制](/zh/docs/agents/runtime/explanation/plugin-internals/)。

## 可以自定义存储后端吗？

可以 —— 只实现你需要的边界：commit 用 `Coordinator`，已提交读取用
`CommittedThreadView` / `CheckpointReader`，managed config 用 `ConfigRegistry`（adapter 位于
`awaken-config-store`），durable 投递和 HITL 用
`awaken-run-ingress` 的 dispatch 契约。in-memory、file、SQLite 和 Postgres 后端作为
参考，`awaken-store-conformance` 是共享的契约测试。

## context compaction 是怎么做的？

compaction 扩展（`awaken-ext-compact`）作为一个 `BeforeInference` hook 运行。已知模型
窗口时它按估算 token 用量触发，否则按消息条数触发。配置的 compactor Agent 总结较旧
前缀，请求专用 context 保留 summary、尚未被 summary 覆盖的 bridge，以及最近的 tail。见
[优化 Context Window](/zh/docs/agents/runtime/how-to/optimize-context-window/)。

## AI SDK v6、AG-UI、A2A、MCP、ACP 协议该怎么选？

- **AI SDK v6**：最适合使用 Vercel AI SDK 的 React 前端。支持文本流式和工具调用。
- **AG-UI**：最适合 CopilotKit 前端。支持 UI 组件和 agent 协作。
- **A2A**：最适合 agent 到 agent 的通信。用于远程 delegates 和服务间编排。
- **MCP HTTP**：最适合外部 MCP client 需要通过 JSON-RPC 调用 Awaken 工具，并带 `MCP-Session-Id` 生命周期时。
- **ACP stdio**：最适合 Agent Client Protocol host 把 Awaken 作为本地进程启动，并通过 stdin/stdout 交换消息时。

每个协议都是同一条 `AgentEvent` 流之上的一个 `Transcoder`，因此选择关乎客户端生态，
而非 agent 实现。
