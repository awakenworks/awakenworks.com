---
title: "Define an Agent"
description: "Create an Agent Actor, save an immutable Project revision, and activate its implemented execution target."
section: "Design"
subsection: "Design work"
order: 12
---

An Agent combines a stable Actor identity with one exact, Project-local Agent
revision. Activation then binds that revision to its executable target.

## 1. Create the Actor

```json
{ "target": "agent", "handle": "reviewer", "display_name": "Rust Reviewer" }
```

Post this body to `/api/actors` and retain the returned `id`.

## 2. Save an immutable Agent revision

```json
{
  "expected_override_version": 0,
  "idempotency_key": "reviewer-revision-1",
  "declaration": {
    "name": "Rust Reviewer",
    "description": "Reviews Rust changes and cites concrete evidence.",
    "icon": "lucide:bot",
    "implementation": {
      "kind": "direct",
      "config": {
        "instructions": "Review the assigned change and return the declared output.",
        "model_parameter": "runtime_model"
      }
    }
  }
}
```

Post to `/api/projects/{project}/agents/{definition}/revision`. The declaration
has exactly one implementation: `direct` with an `AgentConfigTemplate`, or
`workflow` with a symbolic Workflow reference that admission resolves to an exact
revision. It may also declare Resource access, Skills, MCP Connector requirements,
and workspace operations. Saving validates and lowers those references before the
immutable revision is persisted.

`expected_override_version` provides optimistic concurrency; `idempotency_key`
makes a retried save identifiable.

## 3. Activate the revision

For a direct Agent, post a secret-free execution selection to
`/api/projects/{project}/agents/{definition}/activations/{activation_id}`:

```json
{
  "expected_version": 0,
  "actor_id": "AGENT_ACTOR_ID",
  "execution": {
    "mode": "provider_model",
    "provider_identity_ref": "openai",
    "model_ref": "configured-model",
    "backend_ref": "native"
  }
}
```

The selected provider, model, and backend must resolve at activation. Concrete MCP
Connector Resource ids, when declared by the Agent revision, are supplied through
the optional `mcp_connectors` map at this same boundary.

A Workflow-backed Agent instead uses
`"implementation": { "kind": "workflow", "workflow": "..." }`. Activate it with
`expected_version` and `actor_id` only: it inherits execution from its Workflow
states, so direct `execution` and MCP Connector selections are rejected.
