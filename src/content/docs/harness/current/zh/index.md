---
title: "扩展 Awaken Agents 内部机制"
description: "选择需要修改的 Rust 扩展点，运行一个 Agent，并保留 Awaken Agents 的能力、状态与 step commit 边界。"
evidence:
  - "crates/runtime/awaken-runtime/src/runtime.rs"
---

只有需要嵌入 Rust Runtime，或实现 Rust Tool、provider、Plugin、Sandbox backend 与
内核不变量时，才进入本节。如果只是配置、发布或运营 Agent，请从
[Awaken Agents](/zh/docs/agents/)开始。本节描述的执行内核属于 Awaken Agents，
不是第二个产品。

先用一个 model binding 和一个 Tool 运行不可变 `ExecutableAgentSnapshot`。最小形态如下：

```rust
let runtime = Runtime::new()
    .with_llm(Arc::new(my_llm))
    .with_tool(Arc::new(search));

let config = ExecutableAgentSnapshot::builder("assistant")
    .instructions("Answer from cited sources.")
    .model(ModelBinding::new("demo", "model", "awaken"))
    .build();

let state = runtime
    .run(&config, "Find the release notes.", RuntimeRunContext::new())
    .await?;
```

代码返回时，一个 Agent 已经在你的 Rust 进程里完成一次 Runtime run。接下来把
`my_llm` 或 `search` 换成你要加入的能力，同时沿用同一条 state 与 commit 路径。

你的 Rust 进程拥有调用、IO、调度、能力实现与部署。Awaken Agents 执行内核负责 run **内部**发生的
事情：解析不可变 snapshot、发现并激活 Skills、执行 model/tool loop、应用 hooks 与
gates、暂存 state change，并提交整个 step。

## 选择需要修改的 Runtime 边界

| 目标 | 从这里开始 | 不要在这里做什么 |
| --- | --- | --- |
| 新增产品能力 | [添加 Tool](/zh/docs/agents/runtime/how-to/add-a-tool/) | 不要在前端或 prompt 中复制工具实现。 |
| 加入生命周期约束 | [添加 Plugin](/zh/docs/agents/runtime/how-to/add-a-plugin/) | 不要把权限或状态不变量只写成提示词。 |
| 新增模型或外部 Agent 接入 | [配置解析与 Agent 委派](/zh/docs/agents/runtime/explanation/agent-resolution/) | 不要让应用协议直接拥有运行状态。 |
| 新增隔离或执行后端 | [Runtime–服务架构](/zh/docs/agents/runtime/explanation/architecture/) | 不要绕过 Agents 的 placement、权限和提交边界。 |
| 修改运行时内核 | [架构不变量](/zh/docs/agents/runtime/explanation/architecture-invariants/) | 不要建立第二份 state 或 commit 权威。 |

应用团队通常只需在 Awaken Agents 配置和绑定这些能力；只有要实现新的 Rust 能力或修改运行
语义时，才进入这一条路径。

## 一套行为，不同的能力绑定

Awaken Agents 不会假装本地和托管环境完全相同。它显式表达这些差异，但不要求 Agent 行为分叉。

| 稳定的 Agent 契约 | 本地绑定 | 受治理绑定 |
| --- | --- | --- |
| `SKILL.md` 发现与激活 | 实时扫描 workspace Skill 目录 | Delivered catalog，或挂载进 Sandbox 的 workspace |
| 中立 tool id 与 schema | 进程内 `read`、`write`、`edit`、`glob`、`grep`、`bash` | Scoped in-process、Sandbox、MCP 或 Remote Hand executor |
| Permission 与 capability rules | CLI 或应用中的调用者审批 | 中央 policy、approval、credential 与 placement 决策 |
| Staged state 与 step commit | 应用拥有 coordinator/store | Awaken Agents 拥有 durable coordinator 与 recovery |

承诺的是**行为可移植，而不是权限完全相同**。Skill 的 `allowed-tools` 可以继续收窄 Host
授予的能力，但不能自行获得 filesystem、shell、network 或 credential access。

## 一次 run 内部会发生什么

1. Runtime 解析不可变 snapshot，以及 Host 提供的能力。
2. 它发现并激活可用 Skill，再用当前 messages 与 typed state 调用模型。
3. 模型请求的 Tool 在执行前经过 capability check、policy 与必要的 approval gate。
4. Tool output、messages、events、run state 与 state command 暂存到同一个 step 可以提交。
5. 拒绝会返回 typed waiting 或 failure outcome；进程崩溃后，上一份 commit 是恢复起点。

这条顺序说明了何时需要进入 Runtime 内部：让新能力加入已有 loop，同时不增加第二份
state store、permission path 或 commit boundary。

| 何时重要 | 常见 SDK 或 graph runtime 基线 | Awaken Agents 的保证 |
| --- | --- | --- |
| Plugin 获得访问权 | 由应用约定限制它如何使用 | 未声明的 tool、state、hook、action、guard 或 gate 访问 fail closed |
| Run 从开发机移动到受治理 Host | 为新环境重写 tool wrapper、Skill loading 与 prompt | 保持 Skill 与 loop 语义，在 Host 边界绑定另一种 capability implementation |
| 并行 tools 写状态 | Reducer 或应用代码处理冲突 | 提交前显式选择 `Disjoint`、`Commutative` 或 `Exclusive` merge policy |
| Tool 需要审批 | Middleware 或应用状态协调暂停 | Permission verdict 在同一执行路径上产出类型化、可恢复的 waiting outcome |
| 进程崩溃 | Checkpoint、message、副作用与日志可能采用不同边界 | Message、state command、audit、run state 与 disposition 共用一个 step commit 边界 |

追求最少配置请选择轻量 SDK；以图为中心的编排请选择 LangGraph；更广的 Rust provider
集成请选择 Rig。当 Tool call 会产生真实后果，而且这些执行不变量必须保持时，再扩展 Awaken Agents。

## 内部边界

执行内核不是 HTTP 服务。公共协议、托管配置、凭据、durable dispatch、workers、sandboxes、
tenancy 与运维端点都属于 [Awaken Agents](/zh/docs/agents/)。Awaken Agents 通过类型化、
纯数据端口连接这些责任；执行内核不反向依赖服务面。

当前 durable Skill store 持久化的是 `SKILL.md` 内容。不要假设一个包含任意 scripts、
references 与 assets 的完整本地 Skill 目录会自动打包，并在每个远程 Sandbox 中原样
重建；完整 bundle materialization 属于独立的部署能力。

选择 crate 或部署组件前，请先看 [Awaken Agents 执行责任图](/zh/docs/agents/runtime/explanation/architecture/)。

## 继续完成你需要的改动

- [快速上手](/zh/docs/agents/runtime/get-started/)：验证并嵌入 runtime。
- [可运行示例](/zh/docs/agents/runtime/tutorials/examples/)：从最小 config 到审批、memory 与 delegation，
  选择 offline-first 示例。
- [第一个 Agent](/zh/docs/agents/runtime/tutorials/first-agent/)：组装最小 run。
- [第一个 Tool](/zh/docs/agents/runtime/tutorials/first-tool/)：安全加入类型化工作。
- [架构](/zh/docs/agents/runtime/explanation/architecture/)：理解所有权与单向依赖。
- [Runtime 参考](/zh/docs/agents/runtime/reference/overview/)：选择 runtime crates。
