---
title: "Use MCP Tools"
description: "Use this when you want to connect to external Model Context Protocol (MCP) servers and expose their tools to awaken agents."
evidence:
  - "crates/runtime/awaken-ext-mcp/src/lib.rs"
section: "Understand"
subsection: "Tune & Operate"
order: 44
---

Use this when you want to connect to external Model Context Protocol (MCP) servers and expose their tools to awaken agents.

## Prerequisites

- A working awaken agent runtime (see [First Agent](/docs/agents/runtime/tutorials/first-agent/))
- The `awaken-ext-mcp` crate added to `Cargo.toml`
- An MCP server to connect to (stdio or streaming-HTTP transport)

```toml
[dependencies]
awaken-runtime = { git = "https://github.com/AwakenWorks/awaken" }
awaken-ext-mcp = { git = "https://github.com/AwakenWorks/awaken" }
tokio = { version = "1", features = ["full"] }
serde_json = "1"
```

MCP tools are imported as ordinary `RawTool` instances, so they flow through the
same gate, executor, and context path as any built-in tool. Each imported tool
is given the id `mcp__{server}__{tool}` (`awaken_ext_mcp::to_tool_id`), and a
server's tools share the capability namespace `mcp__{server}__`.

## Steps

1. Open a transport to the server.

A transport is the wire to one MCP server. Use `StdioTransport` to launch a
child process, or `HttpTransport` for a running streaming-HTTP server.

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

2. Discover the server's tools.

`connect_tools` lists the server's tools once and wraps each as an awaken
tool. It returns an `McpConnection` holding both the executable `tools`
(`Arc<dyn RawTool>`) and their model-facing `descriptors` (`ToolDescriptor`).

```rust
use awaken_ext_mcp::connect_tools;

let conn = connect_tools("everything", transport)
    .await
    .expect("discover tools");

for tool in &conn.tools {
    println!("discovered: {}", tool.id()); // e.g. mcp__everything__echo
}
```

3. Register the tools with the runtime and the agent.

Install each executable tool on the `Runtime` with `with_tool`, and hand the
matching descriptors to the agent's `ExecutableAgentSnapshot` so the model sees them.

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

4. Track a changing tool set with a live plugin (optional).

`connect_tools` is a one-shot snapshot. When a server may add or drop tools at
runtime (`tools/list_changed`), use `McpServer` instead: it holds a live tool
registry that refreshes in the background, and projects it as a plugin.

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

`McpPlugin` re-projects the current registry each time the agent resolves.
Because the plugin advertises the `mcp__my-server__` capability namespace, its
dynamic tools are admitted under the plugin capability bound. A change to the
registry version signals the drive loop to re-resolve at the next step boundary;
in-flight runs keep the tool set they resolved with.

This dynamic tool surface has one owner: a plugin's `live_version` drives tool
recomputation at the next step boundary.

## Advanced development hooks

Use `StdioTransport` / `HttpTransport` and `connect_tools` / `McpServer` first.
Drop lower only when the host needs a custom wire or policy:

- implement `McpToolTransport` for a non-standard transport;
- provide a `SamplingHandler` (via `StdioTransport::connect_with_sampling`) when
  the MCP server asks the client to sample through the host model provider;
- declare `SensitiveFields` on `McpServer::start_with_sensitive` so sensitive
  argument paths are marked (and redacted) on each registry load;
- keep the registry snapshot explicit so in-flight runs do not see a changing
  tool catalog.

## Verify

1. Run the agent and ask it to use a tool provided by the MCP server.
2. Check the backend logs for MCP tool call events.
3. Confirm the tool returns a `ToolOutput` whose `content` carries the server's
   result and `is_error` is `false` on success.

## Common Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| `McpError::Transport(..)` | MCP server not running or unreachable | Verify the server process is running and the path/URL is correct |
| No tools discovered | Server returned empty tool list | Check the MCP server implements `tools/list` |
| `McpError::InvalidToolIdComponent` | Server or tool name sanitizes to empty | Rename the server/tool so `mcp__{server}__{tool}` is well-formed |
| `McpError::ToolIdConflict` | Two tools map to the same id | Ensure tool names are unique per server |
| `mcp__server__tool` not found | Live plugin not selected for the agent | Add `"mcp:{server}"` to the agent's `plugins([...])` and register `server.plugin()` |

## Related Example

- `crates/runtime/awaken-ext-mcp/tests/stdio_real_server.rs`
- `crates/runtime/awaken-ext-mcp/tests/http_real_server.rs`

## Key Files

| Path | Purpose |
|------|---------|
| `crates/runtime/awaken-ext-mcp/src/lib.rs` | Module root and public re-exports |
| `crates/runtime/awaken-ext-mcp/src/client.rs` | `connect_tools`, `McpConnection` |
| `crates/runtime/awaken-ext-mcp/src/plugin.rs` | `McpServer`, `McpPlugin` (live registry) |
| `crates/runtime/awaken-ext-mcp/src/transport.rs` | `McpToolTransport`, `ListChangedKind` |
| `crates/runtime/awaken-ext-mcp/src/stdio.rs` | `StdioTransport` |
| `crates/runtime/awaken-ext-mcp/src/http.rs` | `HttpTransport`, `HttpTransportBuilder` |
| `crates/runtime/awaken-ext-mcp/src/id_mapping.rs` | `to_tool_id`, `tool_namespace` |
| `crates/runtime/awaken-ext-mcp/src/sampling.rs` | `SamplingHandler` and defaults |

## Related

- [MCP Protocol](/docs/agents/protocols/mcp/)
- [Add a Tool](/docs/agents/runtime/how-to/add-a-tool/)
- [Add a Plugin](/docs/agents/runtime/how-to/add-a-plugin/)
- [Use Skills Subsystem](/docs/agents/runtime/how-to/use-skills-subsystem/)
