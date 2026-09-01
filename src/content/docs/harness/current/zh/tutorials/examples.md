---
title: "可运行示例"
description: "根据 config 编译、执行内核直接组装、审批、memory、skills 或进程内 delegation，选择最小且经过验证的 Awaken Agents 示例。"
evidence:
  - "crates/devtools/awaken-runtime-examples/tests/hello_agent.rs"
---

Awaken Agents 是产品，执行内核是其内部实现边界，`awaken-runtime` 是核心执行 crate，
`awaken-runtime-examples` 则是教学用 composition root：把具体 model、tool、gate 与
commit coordinator 组装到 runtime 周围。

这些示例刻意采用 offline-first 设计。Scripted model executor 让执行路径保持确定，因此你
可以先在没有 API key 的情况下理解并验证 Awaken Agents，再替换为真实 provider。

## 选择起点

| 如果你想…… | 从这里开始 | 它证明什么 |
| --- | --- | --- |
| 编译外部编写的 Agent config | `hello_agent` | `AgentConfig` 编译为带 fingerprint 的 `ExecutableAgentSnapshot`，model-only turn 提交回复 |
| 直接嵌入并组装 runtime | `direct_runtime` | Model、tool、permission gate、runtime context 与 commit coordinator 构成一次完整运行 |
| 观察有真实后果的工具审批 | `coding_agent` | Read 自动允许；edit 与 shell 等待审批；拒绝不会改变文件 |
| 组合 memory 与 skills | `memory_skills_combo` 测试 | Recall injection、skill discovery/activation、fork context 与 memory write 在裸 `Runtime` 上共存 |
| 委派给另一个 Agent | `delegation` 测试 | Kernel 经 delegation service 路由 `agent_run`，保留可恢复 continuation 与 usage |

## 1. 最小 Agent

`hello_agent` 声明外部 `AgentConfig`，完成编译，运行一次 model-only turn，并打印已提交
transcript。无需 API key。

```sh
cargo run -p awaken-runtime-examples --example hello_agent
```

预期形状：

```text
run finished: Ended(NaturalEnd)
[User] Say hi.
[Assistant] Hello! How can I help?
```

如果你首先关心 config 编译与 fingerprint 一致性，而非工具，请从这里开始。

## 2. 直接组装 Runtime

`direct_runtime` 直接构建 `ExecutableAgentSnapshot`，并连接完整的
model → tool proposal → permission gate → tool execution → commit 路径。

```sh
cargo run -p awaken-runtime-examples --example direct_runtime
```

确定性模型调用 `echo`，ruleset 允许执行，已提交 transcript 包含工具结果。从 scripted
executor 切换到已配置 provider 时，只需要替换 model port。

## 3. 带审批的 Coding Agent

Coding Agent 是最小的产品形态示例。它使用内置 `read`、`write`、`edit`、`glob`、
`grep` 与 `bash` tools。读取可以继续；mutation 会通过 resume ticket 暂停 run，直到调用方
允许或拒绝。

先离线验证行为：

```sh
cargo test -p awaken-runtime-examples --features coding-agent --test coding_agent
```

再使用已配置 provider 运行交互式 TUI：

```sh
cargo run -p awaken-runtime-examples \
  --example coding_agent \
  --features coding-agent-tui
```

Live path 需要按示例自带 README 配置 provider 环境。建议把 offline test 保留在 CI 中：
它会证明批准后 edit 生效，而拒绝不会改变真实临时文件。

## 进阶可执行配方

以下配方位于 `crates/devtools/awaken-runtime-examples/tests/`。它们是聚焦的**进程内
runtime** 组装参考，不是每个新用户都必须完成的教程顺序。

```sh
# Native delegation、waiting/resume 与 delegated usage
cargo test -p awaken-runtime-examples --test delegation

# 裸 Runtime 上的 memory recall 与 skill activation
cargo test -p awaken-runtime-examples --test memory_skills_combo

```

Remote hand、relay、sandbox、worker 与多节点 dispatch 属于 Awaken Agents 部署能力。它们的
可执行验证目前与 composition tests 同处一个 monorepo，但应从
[Awaken Agents 执行模式](/zh/docs/agents/concepts/execution-modes/)理解，而不是作为嵌入式
示例介绍。

## 为什么同时保留 example 与 test

`examples/` 下的文件针对阅读与直接运行优化；对应 smoke tests 和进阶配方针对回归检测
优化。两者配对，让示例可以作为文档，同时避免 API 用法悄悄失效。

接下来可阅读[第一个 Agent](/zh/docs/agents/runtime/tutorials/first-agent/)，把代码复制到自己的
crate；或阅读[构建 Agent](/zh/docs/agents/runtime/how-to/build-an-agent/)，查看完整 composition
清单。
