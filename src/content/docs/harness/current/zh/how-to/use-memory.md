---
title: "使用记忆"
description: "当你想让 agent 跨会话携带知识时使用它——保存持久的记忆，并把相关的记忆召回到一段新对话的上下文中。"
evidence:
  - "crates/runtime/awaken-ext-memory/src/lib.rs"
---

当你想让 agent 跨会话携带知识时使用它——保存持久的记忆，并把相关的记忆召回到一段新对话的上下文中。

## 记忆是什么（以及不是什么）

记忆是*跨会话持久化*：一个 agent 保存关于用户及其工作的持久事实，而一段稍后、互不相关的对话会在它开始思考之前注入其中相关的那些。它有别于上下文压缩
（`awaken-ext-compact`），后者管理*一个会话之内*的窗口——见
[优化上下文窗口](/zh/docs/agents/runtime/how-to/optimize-context-window/)。

awaken 中的记忆干净地拆成两半，你独立地把它们接线：

| 半边 | 它做什么 | 它在哪里 |
|------|--------------|----------------|
| **召回（读）** | `MemoryPlugin` 在每次推理之前把已保存的记忆作为仅请求上下文注入 | `awaken-ext-memory` |
| **保存（写）** | `write_memory` 工具把一条记忆持久化到一个本地目录 | `awaken-ext-memory` |

两半都已交付并可从公开部件端到端使用——组合起来的配方在
`crates/devtools/awaken-runtime-examples/tests/memory_skills_combo.rs` 中被演练。

## 前置条件

- 一个可用的 awaken agent 运行时（见[第一个 Agent](/zh/docs/agents/runtime/tutorials/first-agent/)）
- 在 `Cargo.toml` 中加入 `awaken-ext-memory` crate（加上 `awaken-memory-store`
  以获得一个能在重启后存活的持久根）

```toml
[dependencies]
awaken-runtime = { git = "https://github.com/AwakenWorks/awaken" }
awaken-ext-memory = { git = "https://github.com/AwakenWorks/awaken" }
tokio = { version = "1", features = ["full"] }
serde_json = "1"
```

## 记忆如何被存储

一条记忆是一个目录下的一个 `<slug>.md` 文件。`MemoryDir::new(root)` 是那个
句柄：`write(name, content)` 把 `name` 净化成一个安全的词干并写入
文件（一次写入永远无法逃出 `root`），而 `entries()` 以最新在前读回它们。这就是运行时所触及的全部持久化表面——它
对 id、数据库或重启一无所知。

裸 `Runtime` 示例可以继续用 `MemoryDir` 作为进程内适配器。Awaken Agents Session 路径则只以
Workspace-scoped `MemoryRepository` 为数据真相：Memory mount、召回、抽取、API 与版本
历史都读写同一个 path-addressed CAS repository，不存在需要同步的第二份 Memory 数据。

资源绑定、配置版本和 Session activation 的整体生命周期由
[Session、资源与事件](/zh/docs/agents/concepts/sessions-and-events/#资源在-session-创建时解析一次)
统一解释；本页只保留 Runtime 的具体使用方式。

## 启用召回

`MemoryPlugin`（id `MEMORY_PLUGIN_ID` = `"memory"`）贡献一个
`BeforeInference` 阶段 hook。它读取记忆目录并注入一个有界的召回块作为**仅请求**上下文：模型看得见它，但它绝不会被提交到 thread。

```rust
use std::sync::Arc;
use awaken_ext_memory::{MEMORY_PLUGIN_ID, MemoryDir, MemoryPlugin, RecallBounds};
use awaken_runtime::Runtime;
use awaken_runtime_contract::resolved::ModelBinding;
use awaken_runtime_contract::snapshot::ExecutableAgentSnapshot;

let store = MemoryDir::new("/var/lib/awaken/memory");

let runtime = Runtime::new()
    .with_llm(llm)
    .with_plugin(Arc::new(MemoryPlugin::new(store.clone(), RecallBounds::default())));

let config = ExecutableAgentSnapshot::builder("assistant")
    .instructions("You are a helpful assistant.")
    .model(ModelBinding::new("demo", "stub", "stub"))
    .plugins([MEMORY_PLUGIN_ID.to_string()]) // activate recall for this run
    .build();
```

与任何插件一样，run 的 `plugins([...])` 列表才是激活它的东西——一个
已安装但未列出的 `MemoryPlugin` 什么也不贡献。见
[添加 Plugin](/zh/docs/agents/runtime/how-to/add-a-plugin/)。

### 限定召回

`RecallBounds` 防止一个不断增长的存储淹没窗口（展示的是默认值）：

| 字段 | 默认值 | 含义 |
|-------|---------|---------|
| `per_entry_chars` | 1500 | 把每条记忆截断到这么多字符（0 = 无界） |
| `total_chars` | 8000 | 限定整个召回块 |
| `max_entries` | 40 | 至多注入这么多条记忆，最新在前 |
| `select_over` | 12 | 超过这么多条记忆后，切换到相关性选择 |

召回是最新在前的，并会注明它丢弃了多少条更旧的记忆。你可以
通过 `memory` 配置节按 run 覆盖这些界限（一个部分节也可以——未设的字段保留其默认值）：

```rust
let section = serde_json::json!({ "max_entries": 10, "select_over": 20 });
let config = ExecutableAgentSnapshot::builder("assistant")
    .model(ModelBinding::new("demo", "stub", "stub"))
    .plugins([MEMORY_PLUGIN_ID.to_string()])
    .plugin_config([(MEMORY_PLUGIN_ID.to_string(), section)])
    .build();
```

一旦存储持有超过 `select_over` 条记忆，该 hook 就能挑出
相关的那些而非把最新的整批注入——但仅当你附上
一个 `RecallSelector`，用 `MemoryPlugin::new(..).with_selector(..)`。selector
每个 run 运行一次 `memory-selector` sub-agent 调用（按 run id 缓存）。没有
selector 时，一个大的存储只会回退到最新在前的有界块。

## 启用保存

保存是 `write_memory` 工具。把它的描述符加到 agent 上并在运行时注册
`WriteMemoryTool`（绑定到召回所读取的同一个 `MemoryDir`）。该工具接收一个 `name`（短 slug）与 `content`（记忆文本）。

```rust
use awaken_ext_builtin_tools::erase;
use awaken_ext_memory::{WriteMemoryTool, write_memory_descriptor};

let runtime = Runtime::new()
    .with_llm(llm)
    .with_tool(erase(WriteMemoryTool::new(store.clone())))
    .with_plugin(Arc::new(MemoryPlugin::new(store.clone(), RecallBounds::default())));

let config = ExecutableAgentSnapshot::builder("assistant")
    .model(ModelBinding::new("demo", "stub", "stub"))
    .tools([write_memory_descriptor()])       // expose write_memory to the model
    .plugins([MEMORY_PLUGIN_ID.to_string()])  // recall the saved memories next time
    .build();
```

现在 agent 可以在对话中途保存记忆，而任何稍后在同一个
`store` 上的 run 都会召回它们。

## 带外抽取（后台保存）

让*主* agent 决定何时调用 `write_memory` 是最简单的
配置。一个更干净的模式是在每一轮之后把抽取作为一个独立的后台 sub-agent 运行，于是记忆决策绝不与用户的任务竞争。
`awaken-ext-memory` crate 交付了实现这一点的构件：

- `MEMORY_AGENT_ID`（`"memory-extractor"`）、`default_memory_agent(model, instructions)`
  和 `DEFAULT_MEMORY_INSTRUCTIONS`——一个带记忆分类法提示词的单工具抽取器 agent 配置。
- `EXTRACT_PROMPT`——追加到被播种对话上的每-run 提示词。
- `SELECTOR_AGENT_ID` / `default_selector_agent` / `DEFAULT_SELECTOR_INSTRUCTIONS`
  用于相关性 selector。

后台抽取现在由 `awaken-ext-memory` 拥有完整生命周期：
`MemoryTerminalObserver` 只观察已经提交的 terminal Run，建立稳定的
`MemoryExtractionIntent`，再通过
`Pending → Claimed → Extracted → Stored → Completed` 收敛并提交 receipt。重复 terminal
通知、进程重启或 response loss 会重用同一 intent / idempotency key，而不会再次应用已经
落库的 mutation。

`awaken-runtime-host` 只是把普通 auxiliary Agent Run、`MemoryRepository` 与这个公开的
controller/driver 组合起来；它不拥有第二套 Memory state machine。裸 `Runtime` 可以使用
同一组公开端口自行组合，或先使用上面的 in-run `write_memory` 简化接入。

## 验证

1. 保存一条记忆，然后启动一个全新的 run。召回块（"Memories from
   earlier conversations…"）应当出现在新 run 第一次推理时模型所看到的东西中。
2. 确认召回是仅请求的：被召回的文本**不得**出现在
   已提交的 thread 消息中。
3. 检查磁盘上的存储——每条已保存的记忆是 `MemoryDir` 根下的一个
   `<slug>.md` 文件。

## 常见错误

| 症状 | 原因 | 修复 |
|---------|-------|-----|
| 没有召回被注入 | 插件 id 不在 run 的 `plugins([...])` 中 | 把 `MEMORY_PLUGIN_ID` 加入激活列表 |
| 模型不认识 `write_memory` | 描述符未暴露 | 把 `write_memory_descriptor()` 加入 agent 的 tools |
| 已保存的记忆未被召回 | `WriteMemoryTool` 与 `MemoryPlugin` 指向不同的根 | 把两者绑定到同一个 `MemoryDir` |
| `PluginConfigError` | 格式错误的 `memory` 节 | 匹配 `RecallBounds` 字段类型（整数） |
| 大存储仍把最新的整批注入 | 未附 selector | 添加 `MemoryPlugin::new(..).with_selector(..)` |
| 记忆在重启后消失 | 裸执行内核使用了临时 `MemoryDir`，或 Awaken Agents 未接入持久 `MemoryRepository` | embedded 使用稳定目录；Awaken Agents 选择 SQLite/Postgres `MemoryRepository` |

## 代码引用

- `crates/devtools/awaken-runtime-examples/tests/memory_skills_combo.rs` —— 裸 `Runtime` 配方：推理前注入召回、`write_memory` 持久化，以及无其 id 即惰性（G30）的情形
- `crates/runtime/awaken-ext-memory/src/plugin.rs` —— `BeforeInference` 召回 hook 与 `memory` 配置节
- `crates/server/awaken-runtime-host/src/memory.rs` —— host 的带外抽取编排（作为构建你自己实现的参考）

## 关键文件

| 路径 | 用途 |
|------|---------|
| `crates/runtime/awaken-ext-memory/src/lib.rs` | 模块根与公开再导出 |
| `crates/runtime/awaken-ext-memory/src/plugin.rs` | `MemoryPlugin`、`MEMORY_PLUGIN_ID`、召回 hook |
| `crates/runtime/awaken-ext-memory/src/recall.rs` | `RecallBounds`、有界召回渲染 |
| `crates/runtime/awaken-ext-memory/src/tool.rs` | `WriteMemoryTool`、`write_memory_descriptor` |
| `crates/runtime/awaken-ext-memory/src/localfs.rs` | `MemoryDir`、`sanitize_stem` |
| `crates/runtime/awaken-ext-memory/src/agent.rs` | `MEMORY_AGENT_ID`、`default_memory_agent`、抽取提示词 |
| `crates/resources/awaken-memory-store/src/lib.rs` | `MemoryRepository` 的 in-memory / SQLite / Postgres 适配器 |
| `crates/runtime/awaken-ext-memory/src/extraction.rs` | terminal observer、持久 extraction intent 与恢复状态机 |

## 相关

- [添加 Plugin](/zh/docs/agents/runtime/how-to/add-a-plugin/)
- [通过配置调优 Agent 行为](/zh/docs/agents/how-to/configure-agent-behavior/)
- [优化上下文窗口](/zh/docs/agents/runtime/how-to/optimize-context-window/)
- [Tool Trait](/zh/docs/agents/runtime/reference/tool-trait/)
