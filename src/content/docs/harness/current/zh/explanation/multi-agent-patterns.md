---
title: "为多 Agent 协作选择一个边界"
description: "按照工作的生命周期，选择 child delegation、独立 Run 或持久 cross-Thread delivery。"
evidence:
  - "crates/runtime/awaken-runtime-contract/src/delegation.rs"
  - "crates/runtime/awaken-runtime-contract/src/tool_batch.rs"
  - "crates/runtime/awaken-runtime/src/engine/delegation.rs"
---

不要先设计 Agent role。先确认工作的生命周期，以及 caller 需要什么结果。Awaken Agents 提供三种
协作边界；它们都复用普通 Run，不建立第二个 execution engine。

## 选择机制

| 要协调的工作 | 使用 | Caller 得到什么 |
| --- | --- | --- |
| 一个有界子任务，结果要进入当前模型回合 | 通过 `RunDelegationService` 执行 `agent_run` | parent Run 的一个 Tool result |
| 可以独立运行、等待或结束的工作 | 由 host、Agents service 或 Workforce 组合多个普通 Run | composer 汇合 committed result |
| 发给另一个 Thread 的异步消息 | 持久 `send_message` 与 outbox delivery | target Thread 下一个安全边界的 input |

如果依赖是一次 Agent execution 之外的业务工作、责任、review 或 acceptance，使用
[Awaken Workforce](/zh/docs/workforce/)。

## 静态所有权

```mermaid
flowchart TB
  Parent[Parent publication 与 Run] --> Call[agent_run Tool call]
  Call --> Service[RunDelegationService]
  Service --> Registry[RunDelegations]
  Registry --> ChildA[普通 child Run A]
  Registry --> ChildB[普通 child Run B]
  Call --> Batch[ActiveToolBatch]
  ChildA --> Inbox[PendingChildRunResults]
  ChildB --> Inbox
  Inbox --> Batch
  Batch --> Result[有序 parent Tool result]
  Placement[Placement policy] -. shared environment 或 fresh Sandbox .-> ChildA
  Placement -. shared environment 或 fresh Sandbox .-> ChildB
```

三个持久 state cell 各有不同 owner：

| State | 拥有什么 | 不拥有什么 |
| --- | --- | --- |
| `RunDelegations` | 稳定 relationship identity、lineage、limit 与 cancellation intent | parent Tool result |
| `ActiveToolBatch` | parent call 的 Requested、Executing、Awaiting 与 terminal state | child relationship history |
| `PendingChildRunResults` | child 完成后、parent 消费前的幂等 delivery | 另一套 child store 或 executor |

child 拥有自己的 Agent publication 与 Run identity。placement 决定它共享 Session
environment，还是使用 fresh Sandbox；Sandbox 选择不定义 Agent identity。

## 一次 delegated result

```mermaid
sequenceDiagram
  participant Parent as Parent Run
  participant Runtime
  participant Relation as RunDelegations
  participant Commit as ThreadCommit
  participant Child as Child Run 或 A2A adapter
  participant Inbox as PendingChildRunResults
  Parent->>Runtime: agent_run target 与 input
  Runtime->>Relation: 推导稳定 DelegationId 与 child_run_id
  Runtime->>Relation: 检查 roster、lineage 与 budget
  Runtime->>Commit: 提交 relationship 与 Executing call
  Runtime->>Child: start 或 reconnect 同一 child identity
  alt child awaits
    Child-->>Runtime: Awaiting continuation
    Runtime->>Commit: 提交 parent ticket 与 delegation wait
    Parent->>Runtime: typed resume input
    Runtime->>Runtime: 校验 committed ticket
    Runtime->>Child: resume 同一个 child Run
  else child ends
    Child-->>Runtime: terminal result 与 usage
    Runtime->>Inbox: 按 DelegationId 只记录一次
    Runtime->>Commit: 提交 delivery envelope
    Runtime->>Inbox: 与 parent Tool result 一起消费
    Runtime->>Commit: finalize ToolBatch publication
    Commit-->>Parent: 模型可见 result
  end
```

重复 start 或 recovery 必须访问同一个 `DelegationId` 与 child Run，不能创建第二个 child。
parent 结束时，terminal commit 为 open relationship 记录 cancellation intent。commit 后的
delivery 可以重试；late result 不能重开 closed relationship。

## Parallel call 的契约更窄

```mermaid
flowchart LR
  Calls[一次模型响应包含多个 child call] --> Check{一个 service 拥有全部 call 且每个 call 都证明会 terminal completion}
  Check -->|是| Commit[提交全部 relationship 与 Executing state]
  Commit --> Parallel[并发运行 child call]
  Parallel --> Join[汇合 terminal result]
  Join --> Publish[按原始 call order 发布]
  Check -->|否| Sequential[使用普通 call handling]
```

只有同一个 `RunDelegationService` 拥有模型 batch 中全部 call，并且每个 target 都返回
`supports_parallel_completion` 时，Runtime 才并发执行 delegation。如果本应 terminal-only
的 child 进入 await，batch 会变成 `Indeterminate`；Runtime 不会把多个独立 correlation
压成一个 ticket。

可能独立 await 的长时间 child 应使用独立 Run。composer 拥有 join；执行内核不增加通用
background-work state，也不建立共享 chat buffer。

## 正常恢复行为

- retryable child failure 使用同一个 child identity reconnect。
- terminal delegation error 成为模型可见 Tool error，parent 可以选择其他动作。
- identity 与 result 相同的重复 child delivery 是幂等的；冲突 result 会失败关闭。
- parent terminal 会 seal 未完成 Tool call，late delivery 不能重开它。

这些路径由系统自动处理，不需要通用故障排查。只有选中的 local 或 A2A adapter 在自身 retry
policy 后仍返回明确配置或连接错误时，外部才需要修复。

实现请阅读[使用 `agent_run` 委托](/zh/docs/agents/runtime/how-to/invoke-sub-agent-from-tool/)。完整状态机
位于 [Run 生命周期](/zh/docs/agents/runtime/explanation/run-lifecycle-and-phases/)。
