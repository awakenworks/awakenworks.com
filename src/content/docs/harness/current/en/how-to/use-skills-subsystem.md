---
title: "Use Skills Subsystem"
description: "Use this when you want agents to discover and activate skill packages at runtime, loading instructions and resources on demand."
evidence:
  - "crates/runtime/awaken-ext-skills/src/lib.rs"
  - "crates/server/awaken-runtime-host/src/host/session/content_delivery.rs"
  - "crates/server/awaken-runtime-host/src/skills.rs"
  - "crates/server/awaken-runtime-host/src/session_slot.rs"
section: "Understand"
subsection: "Tune & Operate"
order: 45
---

Use this when you want agents to discover and activate skill packages at runtime, loading instructions and resources on demand.

## Prerequisites

- A working awaken agent runtime (see [First Agent](/docs/agents/runtime/tutorials/first-agent/))
- The `awaken-ext-skills` crate added to `Cargo.toml` (add `awaken-skill-store` for durable, versioned full bundles)

```toml
[dependencies]
awaken-runtime = { git = "https://github.com/AwakenWorks/awaken" }
awaken-ext-skills = { git = "https://github.com/AwakenWorks/awaken" }
tokio = { version = "1", features = ["full"] }
serde_json = "1"
```

## Two Skill delivery modes

A Skill is a specialized procedure the model can load on demand. Awaken derives
two mutually exclusive runtime projections from the same frozen Skill bindings
and the same `SkillRegistry`:

| Mode | Selection | Discovery | Body loading |
| --- | --- | --- | --- |
| `ManagedFilesystem` | The Agent allows at least one of `bash` / `read` / `write` / `edit` / `glob` / `grep` | Prompt injects name, description, and the exact `SKILL.md` path | The model uses ordinary file access, typically `read` on the compatible surface |
| `SemanticTools` | A Native Agent disables every filesystem tool and selected Skills do not require a filesystem | `list_skills` returns structured catalog data | `Skill` returns the body by id |

The Session freezes this choice at its first runtime projection. It cannot
switch later or expose both paths. A filesystem Skill, a bundle with support
files, or `context: fork` requires an environment. If the Agent also disables
every filesystem tool, the Session composition is rejected.

### ManagedFilesystem: prompt discovery

The prompt carries Skill metadata and paths, not full bodies. Once a Skill is
relevant, the model uses ordinary file access to load `SKILL.md`, then reads adjacent
references or scripts only if needed. This is the Anthropic Managed Agents
compatible filesystem Skill shape.

### SemanticTools: tool discovery

Exactly two tools front the whole catalog, never one tool per Skill:

| Tool | Id constant | Purpose |
| --- | --- | --- |
| `list_skills` | `SKILL_LIST_TOOL_ID` | Discover the catalog (id + description + when-to-use) as a tool result |
| `Skill` | `SKILL_TOOL_ID` | Activate a Skill by id; the instruction body is returned and injected into the transcript |

Discovery data comes from `list_skills`, not a descriptor, so catalog changes
do not perturb the fixed tool surface. This path fits instruction-only Skills
and does not need a filesystem or Sandbox merely to load a few instructions.

## One authority behind both projections

The portable unit remains the Skill's behavior and capability contract.
Open-source, hosted, and distributed Awaken Agents deployments may use different
storage and execution adapters, but a Session pins the same
`skill_id + version + bundle_sha256`. The Host derives the projection from the
effective tool surface instead of maintaining another catalog.

Tool calls in both modes cross the permission gate. In SemanticTools,
`allowed_tools` may only narrow the platform-approved surface; it cannot grant
or restore authority. A local `bash` implementation does not imply that a hosted
Run receives unrestricted shell access.

## Steps

1. Build a skill catalog.

Create `SkillSpec` values directly, or parse them from `SKILL.md` text.

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

`SkillSpec::new(id, name, description, body)` covers the required fields; the
builders add optional metadata (`with_when_to_use`, `with_allowed_tools`,
`with_paths`, `with_context`, `with_provenance`). `SkillContext::Fork` runs the
activation in a forked sub-agent; the default `SkillContext::Inline` returns the
body into the current transcript.

2. Parse skills from `SKILL.md` frontmatter (alternative).

Each skill can live as a `SKILL.md` file with YAML-ish frontmatter:

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

`parse_skill_md(id, content)` reads `name`, `description`, `when-to-use`,
`allowed-tools`, and `disable-model-invocation`. Note that `allowed-tools` is a
**comma-separated** list (or an inline `[a, b]`), parsed into
`SkillSpec.allowed_tools: Vec<String>`.

3. Wire the two Skill tools for SemanticTools delivery.

Register the executable `ListSkillsTool` and `SkillTool` on the `Runtime`, and
add their descriptors to the agent's `ExecutableAgentSnapshot` so the model can see them.

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

4. Use durable, versioned full bundles (optional).

The single `awaken-skill-store` authority is a Workspace-scoped `SkillStore`
aggregate. `SkillDefinition` points to the latest version, while each immutable
`SkillVersion` stores binary-safe `SkillBundleFile[]` plus the complete
`bundle_sha256`. The filesystem adapter is `FsSkillStore::open`; SQLite and
Postgres implement the same port. The former “one `SKILL.md` per Skill” directory
is accepted only by the explicit one-time `migrate_legacy_files()` import, not as
a parallel truth.

Session creation pins `skill_id + version + bundle_sha256` into
`ResolvedSessionResources.skills`. Retry or restart loads that same version,
revalidates relative paths and SHA-256, and materializes the full tree under
`.skills/<skill-id>`. Catalog updates affect new Sessions only. See
[Sessions, resources, and events](/docs/agents/concepts/sessions-and-events/#resources-resolve-once-when-the-session-is-created)
for the owning resource lifecycle.

## Constrain a skill to a tool subset

A skill is more than instructions — it can also scope **which tools the agent
sees** while the skill is active, via `SkillSpec.allowed_tools` (the
`allowed-tools` frontmatter key). When a skill activates, the runtime's
`RecordingGate` records the activation and constrains the model's tool surface to
the skill's `allowed_tools`, so one agent can host many task-shaped skills
without leaking unrelated tools (e.g. shell access) into a sensitive flow.

```rust
SkillSpec::new("refund-flow", "Refund flow", "Process refunds", "…")
    .with_allowed_tools(vec![
        "billing_lookup".into(),
        "issue_refund".into(),
        "send_receipt".into(),
    ]);
```

## Verify

1. Run the agent and ask it what it can do. The model should call `list_skills`
   and see the catalog returned as the tool result.
2. Ask it to perform a task that matches a skill. It should call `Skill` with the
   skill id and receive the instruction body.
3. Confirm subsequent tool calls stay within the active skill's `allowed_tools`.

## Common Errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| No skills listed | Registry empty or not registered | Register `ListSkillsTool::new(registry)` and add `list_skills_tool_descriptor()` to the agent |
| `Skill` returns "unknown skill" | Activation id does not match a catalog id | Use the `id` from `list_skills`, not the display name |
| `allowed-tools` ignored | Wrong delimiter | Use a comma-separated list (or `[a, b]`), not spaces |
| Skill body never injected | Only one tool wired | Register **both** `ListSkillsTool` and `SkillTool` |

## Related Example

- `crates/devtools/awaken-runtime-examples/tests/memory_skills_combo.rs`

## Key Files

| Path | Purpose |
|------|---------|
| `crates/runtime/awaken-ext-skills/src/lib.rs` | Module root and public re-exports |
| `crates/runtime/awaken-ext-skills/src/registry.rs` | `SkillRegistry`, `FixedSkillRegistry`, `SourceSkillRegistry`, `CompositeSkillRegistry` |
| `crates/runtime/awaken-ext-skills/src/spec.rs` | `SkillSpec`, `SkillContext`, `SkillProvenance`, `parse_skill_md` |
| `crates/runtime/awaken-ext-skills/src/tool.rs` | `ListSkillsTool`, `SkillTool`, `RecordingGate`, tool descriptors |
| `crates/resources/awaken-skill-store/src/lib.rs` | `FsSkillStore` and the complete, versioned, binary-safe bundle repository |
| `crates/contract/awaken-resource-contract/src/lib.rs` | `SkillStore`, `SkillDefinition`, `SkillVersion`, and `SkillBundleFile` |

## Related

- [Design note: Awaken's two Skill implementations](/blog/2026-08-skill-tool-or-prompt/)
- [Add a Tool](/docs/agents/runtime/how-to/add-a-tool/)
- [Add a Plugin](/docs/agents/runtime/how-to/add-a-plugin/)
- [Use MCP Tools](/docs/agents/runtime/how-to/use-mcp-tools/)
