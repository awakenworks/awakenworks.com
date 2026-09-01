---
title: "用 Fact 读取事实，用 Delta 展示实时进度"
description: "消费 Awaken 的中立 AgentEvent，不把实时片段或审计记录当成可恢复的 Thread 事实。"
evidence:
  - "crates/contract/awaken-agent-contract/src/event/agent.rs"
  - "crates/contract/awaken-agent-contract/src/event/fold.rs"
  - "crates/contract/awaken-agent-contract/src/event/classify.rs"
---

应用需要从已提交 Thread state 派生完整事件时，使用 `Fact`。只想在 model 或 Tool 仍在
产生内容时展示进度，使用 `Delta`。重连与恢复必须读取已提交 message 和 `RunState`，
不能重放某个客户端碰巧收到的片段。

```rust
pub enum AgentEvent {
    Fact(Fact),
    Delta(Delta),
}
```

## 静态所有权

```mermaid
flowchart LR
  Live[实时 model 与 Tool stream] --> Delta[AgentEvent::Delta]
  Commit[已提交 message 与 RunState] --> Fold[共享 fold]
  Fold --> Fact[AgentEvent::Fact]
  Delta --> Transcoder[协议 Transcoder]
  Fact --> Transcoder
  Transcoder --> Wire[协议 wire]
  Delta --> Classify[classify]
  Fact --> Classify[classify]
  Classify --> Audit[持久审计投影]
```

fold 是完整 `Fact` 的唯一生产者，实时 stream 是 `Delta` 的唯一生产者。一个协议只实现
一个 `Transcoder`：`fact` 必须穷举处理，`delta` 可以忽略该协议不展示的片段类型。

## 事件词汇

| 层级 | 变体 | 消费规则 |
|---|---|---|
| `Fact` | `RunStarted`、`AssistantMessage`、`AssistantThinking`、`ToolCall`、`ToolResult`、`Awaiting`、`Continuation`、`RunFinished`、`RunFailed` | 处理全部变体，把它视为完整投影 |
| `Delta` | `TextDelta`、`ReasoningDelta`、`ToolCallDelta` | 展示支持的片段；允许 transport 边界丢失或重复 |

`ToolCallDelta.args_delta` 始终是后缀片段。provider adapter 会在发送前统一处理 provider
返回的累计格式。完整 Tool input 随后出现在 `Fact::ToolCall.input` 中。

## 从实时进度到已提交事实

```mermaid
sequenceDiagram
  participant Provider
  participant Runtime
  participant Live as 实时订阅方
  participant Commit as ThreadCommit
  participant Fold
  participant Adapter as 协议 Transcoder

  Provider-->>Runtime: text、reasoning 或 Tool argument 片段
  Runtime-->>Adapter: AgentEvent::Delta（尽力而为）
  Adapter-->>Live: 协议 preview event
  Runtime->>Commit: message 与 RunState
  Commit-->>Runtime: 接受的 committed frontier
  Runtime->>Fold: 已提交 message 与 state
  Fold-->>Adapter: 完整 AgentEvent::Fact
  Adapter-->>Live: 协议事件
  Note over Commit,Fold: 重连时再次 fold 已提交事实
```

## 终态映射

| 已提交 `RunState` | 派生的 `Fact` |
|---|---|
| `Awaiting` | `Awaiting { pending_tool_use_id }` |
| `Ended(MaxSteps)` | `RunFinished { exhausted: true }` |
| `Ended(Error(failure))` | `RunFailed { code: failure.code(), message: failure.message() }` |
| `Ended(Indeterminate)` | `RunFailed { code: "indeterminate", ... }` |
| 其他所有 `Ended` 成因 | `RunFinished { exhausted: false }` |

`Indeterminate` 绝不会被投影为成功。断线后需要继续的调用方只需读取已提交 Thread fact，
不需要修复事件 stream。

## Audit 是投影，不是真相

`classify` 是唯一的路由决定。Delta 只进入实时通道。`RunStarted` 同时可实时发送和审计。
content fact 由权威 message 重建，不再复制进 audit log。Awaiting、continuation、finish 与
failure fact 可以进入 audit。

审计记录服务于观测与读侧视图。它不替代 message log，不重建 Run，也不是第二套公共
事件 API。

## 相关

- [线程模型](/zh/docs/agents/runtime/reference/thread-model/)
- [Run、Step 与 ToolBatch state](/zh/docs/agents/runtime/explanation/run-lifecycle-and-phases/)
- [取消](/zh/docs/agents/runtime/reference/cancellation/)
