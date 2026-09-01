---
title: "Designing for Awaken Workforce"
description: "Design Agents, Workflows, and Domain Packs as separate composable contracts with exact revisions."
section: "Design"
subsection: "Design work"
order: 10
---

Designers define how work runs without hard-coding a single model, credential, or
deployment. Three authoring surfaces compose but do not bundle into one document:

| Surface | What you declare | Current API/format |
| --- | --- | --- |
| Agent | Discoverability, one direct or Workflow implementation, and declared Resource/Skill/MCP/workspace access | `/api/projects/{project}/agents/{definition}/revision` |
| Workflow | Immutable revision whose specification declares states, slots, requirements, hand-off, transitions, and bounds | `/api/projects/{project}/workflows/{definition}/revision` |
| Domain objects | ResourceType facets and inline Lua | `PackDescriptor contract_version: 2` or Resource APIs |

## Design in this order

1. Read the [object model](/docs/objects/concepts/object-model) and [authorization,
   readiness, and Resources](/docs/objects/concepts/permissions-resources).
2. [Define the Agent](/docs/workforce/designing/define-an-agent): keep identity/prompt
   separate from authorization, model routing, credentials, and worker capacity.
3. [Design the Workflow](/docs/workforce/designing/design-a-workflow): route on
   declared events/structured output; name requirements and recovery paths.
4. [Develop the Domain Pack](/docs/workforce/designing/develop-a-domain-pack): model
   domain nouns and operations; adopt types, then create/bind instances.
5. Test invalid inputs and missing dependencies as seriously as the happy path.

Good Workforce design is portable because it avoids accidental ambient state. A Pack
does not contain runtime instances; a Workflow specification does not contain credentials;
an Agent revision does not by itself grant access. Scope binding and policy compose them at use
time, leaving provenance and failure evidence visible.

Keep [workflow configuration](/docs/workforce/reference/workflow-config), [structured
handoff](/docs/workforce/reference/output-contracts), and the generated [HTTP
routes](/docs/workforce/reference/routes) open while authoring.
