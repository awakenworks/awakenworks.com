---
title: "Develop a Domain Pack"
description: "Choose the composition boundary, exact component owners, and dependency direction before authoring one PackDescriptor."
section: "Design"
subsection: "Build Domain Packs"
order: 20
---

Use one `PackDescriptor contract_version: 2`; do not create a second manifest
model. First choose the Pack's composition tier and stable responsibility:

- Foundation defines reusable ResourceTypes and capability contracts.
- Integration owns external-system adapters and depends only downward.
- Domain composes reusable business ResourceTypes, Workflows, Automations,
  Agents, and Environments.
- Solution provides one end-to-end installation and bounded user choices; it
  cannot depend on another Solution.

Keep each definition with its authoritative owner. ResourceType owns object
schema and behavior; Workflow owns accountable state and typed hand-off;
Automation owns `on → when → then`; Agent owns executable composition and declared
Resource access; Environment owns portable execution configuration. Resource
instances, credentials, model routes, activations, and runtime state are not
portable components.

Draft validation must pass strict descriptor shape, exact dependency closure,
tier direction, all five owner admissions, atomic installation, Bootstrap plan,
and configured interaction evidence as applicable. Publication is a separate,
reviewed transition; import is complete but adoption selects explicit roots.

Continue with the single hands-on guide:
[Author and validate a Pack](/docs/workforce/how-to/author-a-domain-pack).
