---
title: "使用 MCP Tools"
description: "当你想连接外部 Model Context Protocol（MCP）server，并把它们的工具暴露给 awaken agent 时，使用本页。"
evidence:
  - "crates/runtime/awaken-ext-mcp/src/lib.rs"
---

当你想连接外部 Model Context Protocol（MCP）server，并把它们的工具暴露给 awaken agent 时，使用本页。

## 前置条件

- 一个可运行的 awaken agent 运行时（见[第一个 Agent](/zh/docs/agents/runtime/tutorials/first-agent/)）
- 在 `Cargo.toml` 中添加 `awaken-ext-mcp` crate
- 一个可连接的 MCP server（stdio 或 streaming-HTTP 传输）

```toml
[dependencies]
awaken-runtime = { git = "https://github.com/AwakenWorks/awaken" }
awaken-ext-mcp = { git = "https://github.com/AwakenWorks/awaken" }
tokio = { version = "1", features = ["full"] }
serde_json = "1"
```

MCP 工具被作为普通的 `RawTool` 实例导入，因此它们与任何内置工具一样，流经同一条
gate、executor 和 context 路径。每个被导入的工具会得到一个 id `mcp__{server}__{tool}`
（`awaken_ext_mcp::to_tool_id`），而一个 server 的工具共享能力命名空间
`mcp__{server}__`。

## 步骤

1. 打开一个到 server 的传输。

一个传输是通往某个 MCP server 的连线。用 `StdioTransport` 派生一个子进程，或用
`HttpTransport` 连接一个运行中的 streaming-HTTP server。

```rust
use std::sync::Arc;
use awaken_ext_mcp::{StdioTransport, McpToolTransport, DEFAULT_TIMEOUT};

// Stdio transport: spawn `command args...` and complete the MCP handshake.
let stdio = StdioTransport::connect(
    "npx",
    &["-y".into(), "@modelcontextprotocol/server-everything".into()],
    DEFAULT_TIMEOUT,
)
.await
.expect("spawn + handshake");

let transport: Arc<dyn McpToolTransport> = Arc::new(stdio);
```

2. 发现 server 的工具。

`connect_tools` 把 server 的工具列出一次，并把每个包装成一个 awaken 工具。它返回一个
`McpConnection`，其中同时持有可执行的 `tools`（`Arc<dyn RawTool>`）和它们面向模型的
`descriptors`（`ToolDescriptor`）。

```rust
use awaken_ext_mcp::connect_tools;

let conn = connect_tools("everything", transport)
    .await
    .expect("discover tools");

for tool in &conn.tools {
    println!("discovered: {}", tool.id()); // e.g. mcp__everything__echo
}
```

3. 把工具注册进运行时和 agent。

用 `with_tool` 把每个可执行工具安装到 `Runtime` 上，并把匹配的描述符交给 agent 的
`ExecutableAgentSnapshot`，好让模型看到它们。

```rust
use awaken_runtime::Runtime;
use awaken_runtime_contract::snapshot::ExecutableAgentSnapshot;
use awaken_runtime_contract::resolved::ModelBinding;

// Build a runtime as in [Add a Plugin](/docs/agents/runtime/how-to/add-a-plugin/), then
// register the discovered tools:
let mut runtime = Runtime::new().with_llm(llm);
for tool in conn.tools {
    runtime = runtime.with_tool(tool);
}

let config = ExecutableAgentSnapshot::builder("mcp-agent")
    .instructions("Use MCP tools when they help answer the user.")
    .model(ModelBinding::new("anthropic", "claude-sonnet", "anthropic"))
    .tools(conn.descriptors)
    .build();
```

4. 用一个实时插件跟踪变化中的工具集（可选）。

`connect_tools` 是一次性的快照。当一个 server 可能在运行时增删工具
（`tools/list_changed`）时，改用 `McpServer`：它持有一个在后台刷新的实时工具注册表，
并把它投影为一个插件。

```rust
use std::sync::Arc;
use awaken_ext_mcp::{McpServer, StdioTransport};
use awaken_runtime_contract::plugin::Plugin;

let stdio = StdioTransport::connect("node", &["server.js".into()], DEFAULT_TIMEOUT)
    .await
    .expect("spawn");
let server = McpServer::connect_stdio("my-server", stdio)
    .await
    .expect("start + subscribe list_changed");

// The plugin's id is `mcp:{server}` — list it in the agent's plugin ids.
let plugin = server.plugin();
let runtime = Runtime::new()
    .with_llm(llm)
    .with_plugin(Arc::new(plugin) as Arc<dyn Plugin>);

let config = ExecutableAgentSnapshot::builder("mcp-agent")
    .instructions("Use MCP tools when they help answer the user.")
    .model(ModelBinding::new("anthropic", "claude-sonnet", "anthropic"))
    .plugins(["mcp:my-server".into()])
    .build();
```

`McpPlugin` 在 agent 每次解析时重新投影当前的注册表。因为该插件公布了
`mcp__my-server__` 能力命名空间，它的动态工具在插件的能力 bound 下被准入。注册表版本
的一次变化向驱动循环发信号，让它在下一个步骤边界重新解析；进行中的 run 保持它们解析
时所用的工具集。

这套动态工具表面只有一个 owner：插件的 `live_version` 在下一个 step 边界驱动工具重算。

## 高级开发钩子

先使用 `StdioTransport` / `HttpTransport` 和 `connect_tools` / `McpServer`。只有当宿
主需要自定义的连线或策略时才下探到更低层：

- 为一个非标准传输实现 `McpToolTransport`；
- 当 MCP server 要求客户端通过宿主模型 provider 进行 sampling 时，提供一个
  `SamplingHandler`（通过 `StdioTransport::connect_with_sampling`）；
- 在 `McpServer::start_with_sensitive` 上声明 `SensitiveFields`，使敏感的参数路径在每
  次注册表加载时被标记（并脱敏）；
- 让注册表快照保持显式，使进行中的 run 不会看到变化中的工具目录。

## 验证

1. 运行 agent，并让它使用由 MCP server 提供的一个工具。
2. 检查后端日志里的 MCP 工具调用事件。
3. 确认工具返回一个 `ToolOutput`，其 `content` 携带 server 的结果，且成功时
   `is_error` 为 `false`。

## 常见错误

| 症状 | 原因 | 修复 |
|---------|-------|-----|
| `McpError::Transport(..)` | MCP server 未运行或不可达 | 验证 server 进程在运行，且路径/URL 正确 |
| 没有发现工具 | server 返回了空的工具列表 | 检查 MCP server 实现了 `tools/list` |
| `McpError::InvalidToolIdComponent` | server 或工具名净化后为空 | 重命名 server/工具，使 `mcp__{server}__{tool}` 形态良好 |
| `McpError::ToolIdConflict` | 两个工具映射到同一个 id | 确保每个 server 内工具名唯一 |
| 找不到 `mcp__server__tool` | agent 未选中实时插件 | 把 `"mcp:{server}"` 加进 agent 的 `plugins([...])`，并注册 `server.plugin()` |

## 相关示例

- `crates/runtime/awaken-ext-mcp/tests/stdio_real_server.rs`
- `crates/runtime/awaken-ext-mcp/tests/http_real_server.rs`

## 关键文件

| 路径 | 用途 |
|------|---------|
| `crates/runtime/awaken-ext-mcp/src/lib.rs` | 模块根与公开的 re-export |
| `crates/runtime/awaken-ext-mcp/src/client.rs` | `connect_tools`、`McpConnection` |
| `crates/runtime/awaken-ext-mcp/src/plugin.rs` | `McpServer`、`McpPlugin`（实时注册表） |
| `crates/runtime/awaken-ext-mcp/src/transport.rs` | `McpToolTransport`、`ListChangedKind` |
| `crates/runtime/awaken-ext-mcp/src/stdio.rs` | `StdioTransport` |
| `crates/runtime/awaken-ext-mcp/src/http.rs` | `HttpTransport`、`HttpTransportBuilder` |
| `crates/runtime/awaken-ext-mcp/src/id_mapping.rs` | `to_tool_id`、`tool_namespace` |
| `crates/runtime/awaken-ext-mcp/src/sampling.rs` | `SamplingHandler` 与默认值 |

## 相关

- [MCP 协议](/zh/docs/agents/protocols/mcp/)
- [添加 Tool](/zh/docs/agents/runtime/how-to/add-a-tool/)
- [添加 Plugin](/zh/docs/agents/runtime/how-to/add-a-plugin/)
- [使用 Skills 子系统](/zh/docs/agents/runtime/how-to/use-skills-subsystem/)
