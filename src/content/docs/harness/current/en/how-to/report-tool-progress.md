---
title: "Report Tool Progress"
description: "Use this when a long-running tool should stream progress updates to clients while it executes."
evidence:
  - "crates/runtime/awaken-runtime/src/engine/progress.rs"
section: "Understand"
subsection: "Tune & Operate"
order: 51
---

Use this when a long-running tool should stream progress updates to clients while
it executes.

> **What exists, and what does not.** The first-class progress API is for tools you
> **export over MCP**: implement `ProgressRawTool` and stream `McpProgressUpdate`
> values, which the server forwards as `notifications/progress`. In-process
> runtime tools have **no per-call progress callback**. For an in-process
> tool, the live surface is the runtime stream sink's `ToolCall` event plus the
> committed `ToolOutput`. This page documents the real surfaces.

## Prerequisites

- A tool exported through an MCP server (`awaken-protocol-mcp`), for streaming progress to MCP clients
- `awaken-protocol-mcp` and `awaken-mcp-wire` added to `Cargo.toml`

## Steps

1. Implement `ProgressRawTool` for a tool that reports progress.

   A tool that has progress to report implements `ProgressRawTool` instead of the
   plain `RawTool`. The server threads a per-call channel through when the client
   sent a `progressToken`; each `McpProgressUpdate` you send becomes one
   `notifications/progress`.

```rust
use std::time::Duration;

use async_trait::async_trait;
use awaken_mcp_wire::progress::McpProgressUpdate;
use awaken_protocol_mcp::export::ProgressRawTool;
use awaken_runtime_contract::tool::{ToolCall, ToolError, ToolOutput};
use tokio::sync::mpsc;

struct CountTool;

#[async_trait]
impl ProgressRawTool for CountTool {
    fn id(&self) -> &str {
        "count"
    }

    async fn invoke_with_progress(
        &self,
        call: ToolCall,
        progress: mpsc::Sender<McpProgressUpdate>,
    ) -> Result<ToolOutput, ToolError> {
        let steps = call.arguments["steps"].as_u64().unwrap_or(10).min(100);

        for step in 1..=steps {
            // ... do a unit of work ...
            let _ = progress
                .send(McpProgressUpdate {
                    progress: step as f64,
                    total: Some(steps as f64),
                    message: Some(format!("step {step} of {steps}")),
                })
                .await;
            tokio::time::sleep(Duration::from_millis(10)).await;
        }

        Ok(ToolOutput::ok(call.call_id, format!("counted to {steps}")))
    }
}
```

   Sending on the channel is best-effort: if the client did not request progress,
   the receiver is dropped and `send` simply errors — ignore it, as above.

2. Export the tool with `McpExportedTool::with_progress`.

   A plain tool is exported with `McpExportedTool::plain`; a progress-streaming
   tool with `McpExportedTool::with_progress`. Both pair a pinned
   `ToolDescriptor` (what `tools/list` shows) with the executable.

```rust
use std::sync::Arc;
use awaken_protocol_mcp::{McpExportedTool, StaticExports};
use awaken_runtime_contract::resolved::ToolDescriptor;
use serde_json::json;

let exports = StaticExports::new(vec![
    McpExportedTool::with_progress(
        ToolDescriptor::pinned(
            "demo",
            "count",
            "Count to `steps`, reporting progress for each step.",
            json!({
                "type": "object",
                "properties": { "steps": { "type": "integer", "minimum": 1 } },
            }),
        ),
        Arc::new(CountTool),
    ),
]);
```

3. Understand the `McpProgressUpdate` shape.

```rust
pub struct McpProgressUpdate {
    pub progress: f64,        // current progress; absolute, not normalized
    pub total: Option<f64>,   // total for a ratio; None when indeterminate
    pub message: Option<String>,
}
```

   `progress` is an absolute count (e.g. `3` of `10`), not a fraction. Consumers
   normalize it to `[0.0, 1.0]` with `total`.

4. Normalize and throttle on the consuming side (optional).

   `awaken-mcp-wire` ships helpers for a consumer that renders progress:
   `normalize_progress` maps `(progress, total)` into `[0.0, 1.0]`, and a
   `ProgressEmitGate` with `should_emit_progress` throttles emissions
   (`MCP_PROGRESS_MIN_INTERVAL` = 100 ms, `MCP_PROGRESS_MIN_DELTA` = 0.01), always
   letting a terminal `1.0` through.

```rust
use awaken_mcp_wire::progress::{normalize_progress, McpProgressUpdate};

let update = McpProgressUpdate { progress: 3.0, total: Some(10.0), message: None };
let fraction = normalize_progress(&update); // Some(0.3)
```

## In-process tools: the live surface

An in-process runtime tool (a plain `RawTool`, or a typed `Tool` erased with
`erase`) returns a single `ToolOutput` and gets no progress channel. Two real
surfaces carry liveness instead:

- **The stream sink.** When the assistant turn produces a tool call, the runtime
  emits a `Kind::ToolCall { call_id, tool_id, arguments }` on the stream sink you
  attach with `RuntimeRunContext::with_stream_sink`. This surfaces *that a tool was
  called* live, before the turn commits — it is not a mid-execution progress feed.
- **The committed result.** The tool's `ToolOutput` (its `content`, and
  `is_error`) is committed as a `Tool`-role message — the durable truth of what the
  tool produced.

```rust
use awaken_agent_contract::stream::event::Kind as StreamKind;

// After a run whose context carried a MemoryStreamSink `sink`:
for event in sink.events() {
    if let StreamKind::ToolCall { tool_id, .. } = event.kind {
        println!("tool call surfaced: {tool_id}");
    }
}
```

If you need genuine mid-execution progress from a long-running in-process tool,
export it over MCP and use `ProgressRawTool` — that is the only surface that
streams updates *during* a single tool call.

## Verify

- **MCP progress:** call the tool with a `progressToken` in the request `_meta`;
  over HTTP the server answers with an SSE stream carrying one
  `notifications/progress` per update, ending with the tool result.
- **In-process:** attach a stream sink and confirm a `ToolCall` event appears for
  the call, and that the committed `Tool`-role message holds the tool's output.

## Common Errors

| Symptom | Cause | Fix |
|---|---|---|
| No `notifications/progress` | Client did not send a `progressToken` | Include a `progressToken` in the call's `_meta` |
| No progress updates | Tool implements plain `RawTool`, not `ProgressRawTool` | Implement `ProgressRawTool` and export with `with_progress` |
| Progress jumps or floods the UI | Consumer renders raw updates | Normalize with `normalize_progress` and throttle with `ProgressEmitGate` |

## Key Files

- `crates/server/awaken-protocol-mcp/src/export.rs` -- `ProgressRawTool`, `McpExportedTool::with_progress`, `ToolExportSource`
- `crates/runtime/awaken-mcp-wire/src/progress.rs` -- `McpProgressUpdate`, `normalize_progress`, `should_emit_progress`, `ProgressEmitGate`
- `crates/server/awaken-protocol-mcp/src/bin/awaken-mcp-stdio-demo.rs` -- a working `count` progress tool exported over stdio
- `crates/contract/awaken-agent-contract/src/stream/event.rs` -- the stream `Kind::ToolCall` event

## Related

- [Tool Trait Reference](/docs/agents/runtime/reference/tool-trait/)
- [Events Reference](/docs/agents/runtime/reference/events/)
- [Add a Tool](/docs/agents/runtime/how-to/add-a-tool/)
