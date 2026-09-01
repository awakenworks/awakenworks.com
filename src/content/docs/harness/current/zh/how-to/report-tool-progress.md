---
title: "上报 Tool 进度"
description: "当一个长时间运行的工具应当在执行过程中把进度更新流式发送给客户端时，使用本页。"
evidence:
  - "crates/runtime/awaken-runtime/src/engine/progress.rs"
---

当一个长时间运行的工具应当在执行过程中把进度更新流式发送给客户端时，使用本
页。

> **有什么，没有什么。** 一等公民的进度 API 面向的是你**通过 MCP 导出**的工具：
> 实现 `ProgressRawTool` 并流式发送 `McpProgressUpdate` 值，服务器会把它们转发为
> `notifications/progress`。进程内的运行时工具**没有按调用的进度回调**。对于进程内的工
> 具，实时的呈现面是运行时 stream sink 的 `ToolCall` 事件加上已提交的
> `ToolOutput`。本页记录的是真实存在的呈现面。

## 前置条件

- 一个通过 MCP 服务器（`awaken-protocol-mcp`）导出的工具，用于向 MCP 客户端流式发送进度
- 在 `Cargo.toml` 中添加了 `awaken-protocol-mcp` 和 `awaken-mcp-wire`

## 步骤

1. 为一个上报进度的工具实现 `ProgressRawTool`。

   一个有进度可上报的工具实现 `ProgressRawTool` 而不是普通的 `RawTool`。当客户端
   发送了 `progressToken` 时，服务器会为这次调用穿入一个通道；你发送的每个
   `McpProgressUpdate` 都会变成一条 `notifications/progress`。

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
            // ... 做一个工作单元 ...
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

   在通道上发送是尽力而为的：如果客户端没有请求进度，接收端会被丢弃，`send`
   直接返回错误——像上面那样忽略它即可。

2. 用 `McpExportedTool::with_progress` 导出工具。

   普通工具用 `McpExportedTool::plain` 导出；流式进度的工具用
   `McpExportedTool::with_progress`。两者都把一个固定的 `ToolDescriptor`（即
   `tools/list` 展示的内容）与可执行体配对。

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

3. 理解 `McpProgressUpdate` 的结构。

```rust
pub struct McpProgressUpdate {
    pub progress: f64,        // 当前进度；绝对值，未归一化
    pub total: Option<f64>,   // 用于计算比例的总量；不确定时为 None
    pub message: Option<String>,
}
```

   `progress` 是绝对计数（例如 `10` 中的 `3`），不是分数。消费方用 `total` 把它
   归一化到 `[0.0, 1.0]`。

4. 在消费侧归一化并限流（可选）。

   `awaken-mcp-wire` 为渲染进度的消费方提供了辅助函数：`normalize_progress` 把
   `(progress, total)` 映射到 `[0.0, 1.0]`，而带 `should_emit_progress` 的
   `ProgressEmitGate` 对发送做限流（`MCP_PROGRESS_MIN_INTERVAL` = 100 ms、
   `MCP_PROGRESS_MIN_DELTA` = 0.01），并且总是让终态的 `1.0` 通过。

```rust
use awaken_mcp_wire::progress::{normalize_progress, McpProgressUpdate};

let update = McpProgressUpdate { progress: 3.0, total: Some(10.0), message: None };
let fraction = normalize_progress(&update); // Some(0.3)
```

## 进程内工具：实时呈现面

一个进程内的运行时工具（普通的 `RawTool`，或用 `erase` 擦除的类型化 `Tool`）返
回单个 `ToolOutput`，得不到进度通道。取而代之的是两个真实呈现面承载活跃状态：

- **stream sink。** 当 assistant 轮次产生一个 tool call 时，运行时会在你用
  `RuntimeRunContext::with_stream_sink` 附加的 stream sink 上发出一个
  `Kind::ToolCall { call_id, tool_id, arguments }`。这在轮次提交之前实时呈现了
  *有一个工具被调用了*——它不是执行途中的进度流。
- **已提交的结果。** 工具的 `ToolOutput`（其 `content` 和 `is_error`）作为一条
  `Tool` 角色消息提交——这是该工具产生了什么的持久化真相。

```rust
use awaken_agent_contract::stream::event::Kind as StreamKind;

// 在一次 context 携带了 MemoryStreamSink `sink` 的 run 之后：
for event in sink.events() {
    if let StreamKind::ToolCall { tool_id, .. } = event.kind {
        println!("tool call surfaced: {tool_id}");
    }
}
```

如果你需要从一个长时间运行的进程内工具得到真正的执行途中进度，请通过 MCP 导出
它并使用 `ProgressRawTool`——那是唯一在单次 tool call *期间*流式发送更新的呈现
面。

## 验证

- **MCP 进度：** 在请求的 `_meta` 中带上 `progressToken` 调用工具；通过 HTTP，
  服务器以一个 SSE 流回应，每个更新携带一条 `notifications/progress`，以工具结果
  结束。
- **进程内：** 附加一个 stream sink，确认针对该调用出现了一个 `ToolCall` 事件，
  且已提交的 `Tool` 角色消息持有该工具的输出。

## 常见错误

| 症状 | 原因 | 修复 |
|---|---|---|
| 没有 `notifications/progress` | 客户端没有发送 `progressToken` | 在调用的 `_meta` 中带上 `progressToken` |
| 没有进度更新 | 工具实现的是普通 `RawTool`，不是 `ProgressRawTool` | 实现 `ProgressRawTool` 并用 `with_progress` 导出 |
| 进度跳变或淹没 UI | 消费方渲染的是原始更新 | 用 `normalize_progress` 归一化并用 `ProgressEmitGate` 限流 |
| 期望从进程内工具得到调用途中进度 | 进程内工具没有进度通道 | 通过 MCP 导出工具，或依赖 stream 的 `ToolCall` 事件与已提交结果 |

## 关键文件

- `crates/server/awaken-protocol-mcp/src/export.rs` —— `ProgressRawTool`、`McpExportedTool::with_progress`、`ToolExportSource`
- `crates/runtime/awaken-mcp-wire/src/progress.rs` —— `McpProgressUpdate`、`normalize_progress`、`should_emit_progress`、`ProgressEmitGate`
- `crates/server/awaken-protocol-mcp/src/bin/awaken-mcp-stdio-demo.rs` —— 一个通过 stdio 导出的可用 `count` 进度工具
- `crates/contract/awaken-agent-contract/src/stream/event.rs` —— stream 的 `Kind::ToolCall` 事件

## 相关

- [Tool Trait 参考](/zh/docs/agents/runtime/reference/tool-trait/)
- [事件参考](/zh/docs/agents/runtime/reference/events/)
- [添加 Tool](/zh/docs/agents/runtime/how-to/add-a-tool/)
