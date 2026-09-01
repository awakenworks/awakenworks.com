---
title: "在本地运行 Awaken Agents 执行内核"
description: "运行两个离线 Rust 示例，查看已提交 transcript，再选择嵌入或扩展 Awaken Agents 执行能力的后续路径。"
evidence:
  - "crates/devtools/awaken-runtime-examples/examples/direct_runtime.rs"
---

需要运行或嵌入 Awaken 的进程内 Rust Runtime 时，使用本页。如果任务需要 server、Console、
HTTP/SSE、托管配置或 Worker 运维，请改从
[运行第一个 Awaken Session](/zh/docs/agents/get-started/)开始。

下面两次 run 都可以离线完成。它们使用确定性的 model double，不需要供应商账号或 API key。

## 1. 运行最小 Agent

在 Awaken 仓库根目录运行：

```sh
cargo run -p awaken-runtime-examples --example hello_agent
```

该示例声明一份 `AgentConfig`，把它编译为 `ExecutableAgentSnapshot`，然后执行一个 turn。终端
最后应出现类似下面的内容，随后打印已提交 transcript：

```text
run finished: Ended(NaturalEnd)
--- committed transcript ---
```

此时你已经在没有 Tool、权限、存储、server 或真实模型的情况下运行了 Runtime。

## 2. 加入 Tool 和 permission gate

运行第二个示例：

```sh
cargo run -p awaken-runtime-examples --example direct_runtime
```

`direct_runtime` 直接构造 `ExecutableAgentSnapshot`，注册一个 `echo` Tool，并通过唯一的
`PermissionGate` 允许它执行。它和第一个示例调用相同的 `Runtime::run`。已提交 transcript
中应出现 Tool 结果，并以 `NaturalEnd` 结束。

按应用的起点选择示例：

- `hello_agent.rs` 适合由应用编写配置、再进行编译的路径；
- `direct_runtime.rs` 适合由应用自行组装 Runtime ports 的路径。

进入 `Runtime::run` 前，两条路径都会得到同一种 executable snapshot contract。选其中一条
作为起点即可，无须把两套 setup 叠在一起。

## 3. 检查两个示例

```sh
cargo test -p awaken-runtime-examples --test hello_agent --test direct_runtime
```

两项测试都应通过。第一项检查编译后的配置和已提交 assistant reply；第二项检查允许的 Tool
确实执行，并且结果已经提交。

## 每类值放在哪里

Runtime 按生命周期分开配置：

| 生命周期 | 所有者 | 放在这里的内容 |
| --- | --- | --- |
| 进程 | `Runtime` | model、Tool、permission、storage 等进程级 ports |
| Agent publication | `ExecutableAgentSnapshot` | instructions、model binding、Tool descriptors、Plugins 与 limits |
| 一次 run | `RuntimeRunContext` | commit coordinator、streaming sink，以及只供本次 run 使用的服务 |

调用 Runtime 前，先由应用解析自己的设置。执行内核不读取模型供应商特有的环境变量约定，也不在
这些值外面创建 HTTP 控制面。

## 选择下一项任务

| 你要做什么 | 继续阅读 | 第一个结果 |
| --- | --- | --- |
| 把最小 Runtime 放进自己的 binary | [第一个 Agent](/zh/docs/agents/runtime/tutorials/first-agent/) | 自己的 binary 完成一次 committed run |
| 加入 typed Tool | [第一个 Tool](/zh/docs/agents/runtime/tutorials/first-tool/) | 同一次 run 中出现 Tool schema、call、result 和 state write |
| 建立可复用工程 | [构建 Agent](/zh/docs/agents/runtime/how-to/build-an-agent/) | 工程明确分开 Runtime、snapshot 与 run |
| 调用真实模型 | [可运行示例](/zh/docs/agents/runtime/tutorials/examples/) | 同一 run 结构接入 provider executor 与 credential |
| 加入持久本地状态 | [状态与存储](/zh/docs/agents/runtime/state-and-storage/) | 由嵌入应用拥有的 committed state 路径 |

## 只对明确结果采取动作

| 现象 | 检查 | 处理 |
| --- | --- | --- |
| Cargo 找不到 `awaken-runtime-examples` | 当前目录 | 回到 Awaken workspace 根目录运行。 |
| 任一受检示例不再到达 `NaturalEnd` | 对应的 example test 与本地源码改动 | 运行第 3 步的测试；若失败，先检查示例及其 Runtime ports 的改动。 |
| 示例通过，但嵌入应用失败 | snapshot、Runtime ports 与 `RuntimeRunContext` | 每次只比较一种生命周期；不要把进程设置放进不可变 snapshot。 |

这两个示例不会访问 provider，也不需要 API key。Tool error 会成为模型可见的错误结果，
loop 可以在下一次调用中自行纠正。一次短暂的 Tool error 本身不是维护任务。

## 这些需求应离开 Runtime 路径

- 需要恢复、分布式 Worker 或 Sandbox：使用 [Awaken Agents 生产可靠性](/zh/docs/agents/concepts/production-reliability/)。
- 需要 HTTP、协议或前端集成：使用 [Awaken Agents](/zh/docs/agents/)。
- 准备部署：使用[部署与运营 Awaken](/zh/docs/agents/how-to/self-host#production-hardening)。
