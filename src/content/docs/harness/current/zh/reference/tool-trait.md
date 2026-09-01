---
title: "工具 Trait"
description: "实现当前类型化 Tool 合约，并理解模式、授权、执行、状态和恢复边界。"
evidence:
  - "crates/runtime/awaken-runtime-contract/src/tool.rs"
  - "crates/runtime/awaken-runtime-contract/src/resolved.rs"
  - "crates/runtime/awaken-runtime-contract/src/plugin/phase.rs"
---

当模型需要一个类型化操作时，实现 `Tool`。实现负责稳定 id、简短用途、参数类型、
输出类型，以及其外部效果能够如实支持的最强恢复行为。

完整安装流程见[添加工具](/zh/docs/agents/runtime/how-to/add-a-tool/)；需要查精确合约时使用本页。

## `Tool`：类型化编写合约

```rust
#[async_trait]
pub trait Tool: Send + Sync {
    type Args: DeserializeOwned + JsonSchema + Send;
    type Output: Serialize + Send;

    const ID: &'static str;
    const DESCRIPTION: &'static str;

    fn recovery_capability(&self) -> ToolRecoveryCapability {
        ToolRecoveryCapability::NonRecoverable
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, ToolError>;
}
```

`Args` 是模型可见 JSON Schema 的唯一来源。`ToolDescriptor::for_tool::<T>(prefix)`
从实现中派生 id、描述和模式，再固定其内容标识。不要在 Rust 类型旁再维护一份手写模式。

## 最小实现

```rust
use async_trait::async_trait;
use awaken_runtime_contract::tool::{Tool, ToolError};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct GreetArgs {
    name: String,
}

#[derive(Serialize)]
struct GreetOutput {
    greeting: String,
}

struct Greet;

#[async_trait]
impl Tool for Greet {
    type Args = GreetArgs;
    type Output = GreetOutput;

    const ID: &'static str = "greet";
    const DESCRIPTION: &'static str = "Greet one person by name";

    async fn call(&self, args: GreetArgs) -> Result<GreetOutput, ToolError> {
        Ok(GreetOutput {
            greeting: format!("Hello, {}!", args.name),
        })
    }
}
```

描述应具体到足以帮助模型选择工具。输入约束放在参数类型及其模式中。不要把 Run id、
Thread id、Workspace 或效果 id 等运行时所有坐标作为模型可填写参数。

## 动态执行边界

类型化实现会在动态查找时抹除为 `RawTool`：

```rust
#[async_trait]
pub trait RawTool: Send + Sync {
    fn id(&self) -> &str;
    fn execution_target(&self) -> ToolExecutionTarget;
    fn recovery_capability(&self) -> ToolRecoveryCapability;
    async fn invoke(&self, call: ToolCall) -> Result<ToolOutput, ToolError>;
}
```

适配器应使用共享的 `parse_tool_args` 和 `render_tool_output`。`null` 参数只在这一个
解析边界转换为空对象。`RawToolRegistry` 中的重复 id 会变为歧义并失败关闭。

循环通过 `ToolExecutor` 调用已经授权的操作：

```rust
#[async_trait]
pub trait ToolExecutor: Send + Sync {
    fn recovery_capability(&self, tool_id: &str) -> ToolRecoveryCapability;
    async fn invoke(&self, call: &ToolCall) -> Result<ToolOutput, ToolError>;
}
```

`ToolExecutionTarget::Brain` 是默认位置。接触工作负载文件系统、进程或网络的工具，
必须在模式抹除实现中明确选择 `Sandbox`。实际执行位置不进入类型化工具合约。

## `ToolOutput`

```rust
pub struct ToolOutput {
    pub call_id: String,
    pub content: Vec<ContentBlock>,
    pub is_error: bool,
    pub state: Vec<StateCommand>,
}
```

- `ToolOutput::ok` 和 `ok_blocks` 产生模型可见成功结果。
- `ToolOutput::error` 和 `error_blocks` 产生模型可见失败，但不终止 Run。
- `with_state` 随结果暂存状态命令，不直接写入 Store。
- `text()` 是派生的纯文本视图，结构化内容仍是存储形式。

当调用本身无法产生有效工具结果时，使用 `ToolError`：

| 变体 | 含义 | 恢复边界 |
| --- | --- | --- |
| `Unknown` | 没有唯一实现 | 修正注册或 id |
| `InvalidArguments` | 参数无法通过类型解码 | 让模型修正调用 |
| `UnavailableBeforeDispatch` | 尚未发生外部分派 | 所有者可重新取得执行器并重试 |
| `Execution` | 配置失败或可能已经分派 | 不得假定重放安全 |

## 持久效果标识与恢复

执行期间，运行时提供 `current_tool_operation_context()` 和
`current_tool_operation_token()`。外部幂等账本应使用由此取得的操作标识。
`ToolCall::call_id` 只用于协议关联，作用域可能仅限一次响应。

选择不超过事实的恢复能力：

| 能力 | 所有者丢失后的安全声明 |
| --- | --- |
| `NonRecoverable` | 外部结果未知，不重放 |
| `ReplaySafe` | 重复执行与只执行一次在观察上等价 |
| `Idempotent` | 同一稳定操作标识可消除重复 |
| `DurableRequest` | 恢复时重新连接同一持久请求 |

可执行快照会固定 `ToolRecoveryPolicy`。任何工具都可选择 `NeverReplay`；更强模式只有
在实现声明匹配能力时才会通过校验。尝试次数预算在构造时保证非零。

## 授权与调用后行为

权限在执行前判断，插件 Gate 可以进一步收窄。只有所有权威都返回 `Allow` 时，调用
才会到达 `ToolExecutor::invoke`。工具正文不能自行授予权限。

执行后，`AfterTool` 阶段 Hook 会收到精确的调用和输出。其 `HookReaction` 可以暂存
状态和已提交提醒消息。仅用于请求的上下文应写入专用 `ContextMessages` 状态键。

## 相关文档

- [添加工具](/zh/docs/agents/runtime/how-to/add-a-tool/)
- [工具与插件边界](/zh/docs/agents/runtime/explanation/tool-and-plugin-boundary/)
- [状态键](/zh/docs/agents/runtime/reference/state-keys/)
- [能力与权限](/zh/docs/agents/runtime/explanation/capability-and-permissions/)
- [取消](/zh/docs/agents/runtime/reference/cancellation/)
