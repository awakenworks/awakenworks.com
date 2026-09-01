---
title: "Tool Trait"
description: "Implement the current typed Tool contract and follow its schema, authorization, execution, state, and recovery boundaries."
evidence:
  - "crates/runtime/awaken-runtime-contract/src/tool.rs"
  - "crates/runtime/awaken-runtime-contract/src/resolved.rs"
  - "crates/runtime/awaken-runtime-contract/src/plugin/phase.rs"
section: "Reference"
order: 61
---

Implement `Tool` when the model needs one typed operation. The implementation
owns a stable id, a short purpose, its argument type, its output type, and the
strongest recovery behavior its effects can safely support.

Use [Add a Tool](/docs/agents/runtime/how-to/add-a-tool/) for the full installation
workflow. Use this page when you need the exact contract.

## `Tool`: typed authoring contract

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

`Args` is the sole source of the model-visible JSON Schema.
`ToolDescriptor::for_tool::<T>(prefix)` derives the id, description, and schema
from the implementation, then pins their content identity. Do not repeat a
hand-written schema beside the Rust type.

## Minimal implementation

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

Keep the description concrete enough for tool selection. Put input constraints in
the argument type and its schema. Do not accept runtime-owned coordinates such as
Run id, Thread id, Workspace, or effect id as model-authored arguments.

## Dynamic execution boundary

Typed implementations are erased behind `RawTool` for dynamic lookup:

```rust
#[async_trait]
pub trait RawTool: Send + Sync {
    fn id(&self) -> &str;
    fn execution_target(&self) -> ToolExecutionTarget;
    fn recovery_capability(&self) -> ToolRecoveryCapability;
    async fn invoke(&self, call: ToolCall) -> Result<ToolOutput, ToolError>;
}
```

The adapter should use the shared `parse_tool_args` and `render_tool_output`
functions. `null` arguments are normalized to an empty object at this one parse
boundary. Duplicate ids in `RawToolRegistry` become ambiguous and fail closed.

The loop calls an already-authorized operation through `ToolExecutor`:

```rust
#[async_trait]
pub trait ToolExecutor: Send + Sync {
    fn recovery_capability(&self, tool_id: &str) -> ToolRecoveryCapability;
    async fn invoke(&self, call: &ToolCall) -> Result<ToolOutput, ToolError>;
}
```

`ToolExecutionTarget::Brain` is the default. Tools that touch a workload
filesystem, process, or network must explicitly select `Sandbox` in their
schema-erased implementation. Physical placement stays outside the typed tool.

## `ToolOutput`

```rust
pub struct ToolOutput {
    pub call_id: String,
    pub content: Vec<ContentBlock>,
    pub is_error: bool,
    pub state: Vec<StateCommand>,
}
```

- `ToolOutput::ok` and `ToolOutput::ok_blocks` produce a model-visible success.
- `ToolOutput::error` and `ToolOutput::error_blocks` produce a model-visible
  failure without aborting the Run.
- `with_state` stages state commands beside the result. It never writes a store
  directly.
- `text()` is a derived plain-text view. Structured content remains stored.

Use `ToolError` when the invocation itself cannot produce a valid tool result:

| Variant | Meaning | Recovery boundary |
| --- | --- | --- |
| `Unknown` | no unique implementation exists | fix registration or id |
| `InvalidArguments` | arguments fail typed decoding | return a corrected model call |
| `UnavailableBeforeDispatch` | no external dispatch occurred | the owner may reacquire and retry |
| `Execution` | configuration failed or dispatch may have occurred | do not assume replay is safe |

## Durable effect identity and recovery

The runtime exposes `current_tool_operation_context()` and
`current_tool_operation_token()` during execution. Use the resulting operation
identity for an external idempotency ledger. `ToolCall::call_id` is only protocol
correlation and may have response-local scope.

Choose the narrowest truthful recovery capability:

| Capability | Safe claim after owner loss |
| --- | --- |
| `NonRecoverable` | the external outcome is unknown; do not replay |
| `ReplaySafe` | repeating is observationally equivalent to one execution |
| `Idempotent` | the same stable operation identity deduplicates repeats |
| `DurableRequest` | recovery reconnects to one durable request |

The executable snapshot pins a `ToolRecoveryPolicy`. A policy may select
`NeverReplay` for any tool, but a stronger mode is rejected unless the
implementation declares the matching capability. The attempt budget is nonzero
by construction.

## Authorization and post-call behavior

Permission is evaluated before execution. Plugin gates may narrow the decision.
Only an `Allow` from every authority reaches `ToolExecutor::invoke`. A tool body
does not grant itself permission.

After execution, `AfterTool` phase hooks receive the exact call and output. Their
`HookReaction` can stage state and committed reminder messages. Request-only
context uses the dedicated `ContextMessages` state key instead.

## Related

- [Add a Tool](/docs/agents/runtime/how-to/add-a-tool/)
- [Tool and Plugin Boundary](/docs/agents/runtime/explanation/tool-and-plugin-boundary/)
- [State Keys](/docs/agents/runtime/reference/state-keys/)
- [Capability and Permissions](/docs/agents/runtime/explanation/capability-and-permissions/)
- [Cancellation](/docs/agents/runtime/reference/cancellation/)
