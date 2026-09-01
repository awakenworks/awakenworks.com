---
title: "Glossary"
description: "Code-aligned Awaken Workforce terms for work, execution, Resources, governance, and Packs."
section: "Reference"
order: 15
---

**Subject** — Shared durable work family. Current kinds are Issue, Cycle, and Release.

**Issue** — A work Subject that pins an exact Workflow revision at creation, or uses a built-in lifecycle.

**Cycle** — Planning Subject with the built-in `upcoming → active → closed` lifecycle.

**Workflow / WorkflowRevision** — The user-facing work definition and its immutable exact revision. Its internal `ProcessSpec` specification carries the start state, states, transitions, slots, requirements, produced hand-off, and optional bounds.

**Actor** — User, Agent, or Team identity. A Team groups participation/selection; it is not automatically an authorization grant.

**AgentDef** — Current HTTP definition attached to an Agent Actor: `role_prompt` and optional `model`.

**Assignment** — Active link between a Subject state slot and an Actor.

**WorkUnit** — One execution attempt. Status is `queued`, `active`, `succeeded`, `failed`, or `cancelled`.

**RuntimeLease** — Live, expiring authority that fences one worker's execution and egress.

**AttentionSignal** — Machine-readable operational hold with a registered reason code; status is `open`, `acknowledged`, or `resolved`.

**Subject approval** — Approval for an Issue action. Separate from a tool-call approval.

**Inbox** — Current projection of open attention and pending subject approvals. It does not include comments, mentions, or notifications.

**ResourceType** — Revisioned typed declaration of properties/actions/events/lifecycle and related facets.

**Resource** — Named instance of a ResourceType revision.

**ResourceBinding** — Scope availability row that exposes a Resource under a handle.

**ResourceLink** — Role-named relation from one Resource to another.

**Managed credential** — Vault-held secret associated with a provider reference; APIs return metadata, not the secret value.

**Domain Pack** — Signed immutable V2 release containing exact ResourceType, Workflow, Automation, and Agent definitions. It does not contain instances, credentials, or runtime state.

**GitRef / `evidence_refs`** — Useful coding-domain output conventions only when your Workflow/Resource model declares them; not built-in Workforce types.
