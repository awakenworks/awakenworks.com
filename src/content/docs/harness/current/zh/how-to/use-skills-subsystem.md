---
title: "使用 Skills 子系统"
description: "当你希望 agent 在运行时发现并激活技能包，按需加载指令和资源时，使用本页。"
evidence:
  - "crates/runtime/awaken-ext-skills/src/lib.rs"
  - "crates/server/awaken-runtime-host/src/host/session/content_delivery.rs"
  - "crates/server/awaken-runtime-host/src/skills.rs"
  - "crates/server/awaken-runtime-host/src/session_slot.rs"
---

当你希望 agent 在运行时发现并激活技能包，按需加载指令和资源时，使用本页。

## 前置条件

- 一个可运行的 awaken agent 运行时（见[第一个 Agent](/zh/docs/agents/runtime/tutorials/first-agent/)）
- 在 `Cargo.toml` 中添加 `awaken-ext-skills` crate（若需要持久、版本化的完整 bundle，
  再添加 `awaken-skill-store`）

```toml
[dependencies]
awaken-runtime = { git = "https://github.com/AwakenWorks/awaken" }
awaken-ext-skills = { git = "https://github.com/AwakenWorks/awaken" }
tokio = { version = "1", features = ["full"] }
serde_json = "1"
```

## 两种 Skill 交付模式

一个 Skill 是模型可以按需加载的专门流程。Awaken 从同一份冻结 Skill binding 和同一个
`SkillRegistry` 派生两种互斥的运行时投影：

| 模式 | 选择条件 | 发现 | 加载正文 |
| --- | --- | --- | --- |
| `ManagedFilesystem` | Agent 至少允许 `bash` / `read` / `write` / `edit` / `glob` / `grep` 中的一个 | Prompt 注入 name、description 与精确 `SKILL.md` 路径 | 模型通过普通文件访问加载，兼容表面通常使用 `read` |
| `SemanticTools` | Native Agent 禁用全部文件系统工具，且选定 Skill 不要求文件系统 | `list_skills` 返回结构化目录数据 | `Skill` 按 id 返回正文 |

Session 在第一次运行投影时固定交付模式，之后不能切换，也不会同时暴露两条路径。
Filesystem Skill、带支持文件的 bundle 或 `context: fork` 需要环境；如果 Agent 又禁用了
全部文件系统工具，Session 组合会被拒绝。

### ManagedFilesystem：提示词发现

Prompt 只携带 Skill 元数据和路径，不携带完整正文。模型判断相关后，用普通文件访问加载
`SKILL.md`，再按需读取相邻的引用资料或脚本。这是 Anthropic Managed Agents 兼容的
filesystem Skill 形态。

### SemanticTools：工具发现

整个目录恰好由两个工具前置，绝不会有按 Skill 的工具：

| Tool | Id 常量 | 用途 |
| --- | --- | --- |
| `list_skills` | `SKILL_LIST_TOOL_ID` | 发现目录（id + description + when-to-use），作为一个 tool result |
| `Skill` | `SKILL_TOOL_ID` | 按 id 激活一个 Skill；指令正文被返回并注入 transcript |

发现数据由 `list_skills` 返回，而不是烘焙进 descriptor，因此目录变化不会扰动固定工具面。
这条路径适合 instruction-only Skill，无需为了加载几段指令创建文件系统或 Sandbox。

## 两种投影共用一份权威

可移植单元仍是 Skill 的行为与 capability contract。开源、托管和分布式 Awaken Agents 可以
使用不同的存储与执行适配器，但 Session 都固定相同的 `skill_id + version + bundle_sha256`。
Host 只根据有效工具面选择投影，不会维护第二份目录。

两种模式的工具调用都经过权限 gate。SemanticTools 中的 `allowed_tools` 只会继续收窄平台
已经允许的工具面，不能授予或恢复权限。本地存在 `bash` implementation，也不意味着托管
Run 自动获得无限制 shell access。

## 步骤

1. 构建一个 skill 目录。

直接创建 `SkillSpec` 值，或从 `SKILL.md` 文本解析它们。

```rust
use std::sync::Arc;
use awaken_ext_skills::{FixedSkillRegistry, SkillSpec, SkillContext, SkillRegistry};

let registry: Arc<dyn SkillRegistry> = Arc::new(FixedSkillRegistry::from_specs([
    SkillSpec::new("commit", "Commit", "Make a git commit", "Use single-line commit messages.")
        .with_allowed_tools(vec!["read".into(), "bash".into()]),
    SkillSpec::new("rusty", "Rusty", "For rust files", "rust guidance")
        .with_paths(vec!["src/**/*.rs".into()]),
    SkillSpec::new("review", "Review", "Review a PR", "review $ARGUMENTS carefully")
        .with_context(SkillContext::Fork),
]));
```

`SkillSpec::new(id, name, description, body)` 覆盖必填字段；builder 添加可选元数据
（`with_when_to_use`、`with_allowed_tools`、`with_paths`、`with_context`、
`with_provenance`）。`SkillContext::Fork` 在一个 fork 出的子 agent 中运行激活；默认的
`SkillContext::Inline` 把正文返回进当前 transcript。

2. 从 `SKILL.md` frontmatter 解析 skills（替代方案）。

每个 skill 可以作为一个带类 YAML frontmatter 的 `SKILL.md` 文件存在：

```markdown
---
name: refund-flow
description: Process customer refunds against the billing system
when-to-use: When the user asks to refund an order
allowed-tools: billing_lookup, issue_refund, send_receipt
---
While this skill is active, process the refund end to end.
```

```rust
use awaken_ext_skills::parse_skill_md;

let spec = parse_skill_md("refund-flow", skill_md_text);
```

`parse_skill_md(id, content)` 读取 `name`、`description`、`when-to-use`、
`allowed-tools` 和 `disable-model-invocation`。注意 `allowed-tools` 是一个**逗号分隔**
的列表（或一个内联的 `[a, b]`），被解析进 `SkillSpec.allowed_tools: Vec<String>`。

3. 为 SemanticTools 模式接入两个 Skill 工具。

在 `Runtime` 上注册可执行的 `ListSkillsTool` 和 `SkillTool`，并把它们的描述符加进
agent 的 `ExecutableAgentSnapshot`，好让模型能看到它们。

```rust
use std::sync::Arc;
use awaken_ext_skills::{
    ListSkillsTool, SkillTool, list_skills_tool_descriptor, skill_tool_descriptor,
};
use awaken_runtime::Runtime;
use awaken_runtime_contract::snapshot::ExecutableAgentSnapshot;
use awaken_runtime_contract::resolved::ModelBinding;

let runtime = Runtime::new()
    .with_llm(llm)
    .with_tool(Arc::new(ListSkillsTool::new(registry.clone())))
    .with_tool(Arc::new(SkillTool::new(registry.clone())));

let config = ExecutableAgentSnapshot::builder("skills-agent")
    .instructions("Discover and activate skills when specialized help is useful.")
    .model(ModelBinding::new("anthropic", "claude-sonnet", "anthropic"))
    .tool(list_skills_tool_descriptor())
    .tool(skill_tool_descriptor())
    .build();
```

4. 使用持久、版本化的完整 bundle（可选）。

`awaken-skill-store` 的唯一权威是 Workspace-scoped `SkillStore` aggregate：
`SkillDefinition` 指向最新版本，每个不可变 `SkillVersion` 保存 binary-safe
`SkillBundleFile[]` 与完整 `bundle_sha256`。文件系统适配器是 `FsSkillStore::open`；
SQLite 与 Postgres 适配器实现同一个 port。旧的“每个 Skill 一份 `SKILL.md`”目录只能通过
显式 `migrate_legacy_files()` 一次性导入，不再作为并行 truth。

Session 创建时把 `skill_id + version + bundle_sha256` 固定进
`ResolvedSessionResources.skills`。重试或重启加载同一版本，重新校验相对路径与 SHA-256，
并把完整目录树物化到 `.skills/<skill-id>`。更新 catalog 只影响新 Session；已存在的
Session 不会漂移到较新版本。整体资源关系见
[Session、资源与事件](/zh/docs/agents/concepts/sessions-and-events/#资源在-session-创建时解析一次)。

## 把一个 skill 约束到工具子集

一个 skill 不只是指令——它还能通过 `SkillSpec.allowed_tools`（`allowed-tools`
frontmatter 键）限定 skill 激活期间 **agent 能看到哪些工具**。当一个 skill 激活时，运
行时的 `RecordingGate` 记录该激活，并把模型的工具面约束到该 skill 的
`allowed_tools`，因此一个 agent 可以托管许多任务形态的 skill，而不会把不相关的工具
（例如 shell 访问）泄漏进一个敏感流程。

```rust
SkillSpec::new("refund-flow", "Refund flow", "Process refunds", "…")
    .with_allowed_tools(vec![
        "billing_lookup".into(),
        "issue_refund".into(),
        "send_receipt".into(),
    ]);
```

## 验证

1. 运行 agent 并问它能做什么。模型应该调用 `list_skills`，并看到目录作为 tool result
   返回。
2. 让它执行一个匹配某个 skill 的任务。它应该用该 skill id 调用 `Skill`，并收到指令正
   文。
3. 确认后续的工具调用保持在激活 skill 的 `allowed_tools` 之内。

## 常见错误

| 症状 | 原因 | 修复 |
|---------|-------|-----|
| 没有列出 skills | 注册表为空或未注册 | 注册 `ListSkillsTool::new(registry)`，并把 `list_skills_tool_descriptor()` 加进 agent |
| `Skill` 返回 "unknown skill" | 激活 id 不匹配任何目录 id | 使用 `list_skills` 里的 `id`，而不是显示名 |
| `allowed-tools` 被忽略 | 分隔符错误 | 使用逗号分隔的列表（或 `[a, b]`），而不是空格 |
| Skill 正文从未注入 | 只接了一个工具 | **两个**工具 `ListSkillsTool` 和 `SkillTool` 都要注册 |

## 相关示例

- `crates/devtools/awaken-runtime-examples/tests/memory_skills_combo.rs`

## 关键文件

| 路径 | 用途 |
|------|---------|
| `crates/runtime/awaken-ext-skills/src/lib.rs` | 模块根与公开的 re-export |
| `crates/runtime/awaken-ext-skills/src/registry.rs` | `SkillRegistry`、`FixedSkillRegistry`、`SourceSkillRegistry`、`CompositeSkillRegistry` |
| `crates/runtime/awaken-ext-skills/src/spec.rs` | `SkillSpec`、`SkillContext`、`SkillProvenance`、`parse_skill_md` |
| `crates/runtime/awaken-ext-skills/src/tool.rs` | `ListSkillsTool`、`SkillTool`、`RecordingGate`、工具描述符 |
| `crates/resources/awaken-skill-store/src/lib.rs` | `FsSkillStore` 与完整、版本化、binary-safe bundle repository |
| `crates/contract/awaken-resource-contract/src/lib.rs` | `SkillStore`、`SkillDefinition`、`SkillVersion`、`SkillBundleFile` |

## 相关

- [设计解读：Awaken 的两种 Skill 实现](/zh/blog/2026-08-skill-tool-or-prompt/)
- [添加 Tool](/zh/docs/agents/runtime/how-to/add-a-tool/)
- [添加 Plugin](/zh/docs/agents/runtime/how-to/add-a-plugin/)
- [使用 MCP Tools](/zh/docs/agents/runtime/how-to/use-mcp-tools/)
