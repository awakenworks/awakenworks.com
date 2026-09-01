---
title: "Awaken Workforce concepts"
description: "The code-backed model behind Issues, Workflows, typed Resources, automation, and execution."
section: "Understand"
subsection: "Core model"
order: 11
---

## How to read this section

Concept pages explain the user-facing model. They intentionally avoid internal ADR detail and focus on what operators and builders need to understand.

Start with [core concepts and relationships](/docs/workforce/concepts/core-concepts/),
then follow the implemented objects and contracts that make them reliable.

## The value chain: describe → model → derive

One thread runs through every page below. Awaken Workforce turns domain knowledge into a **typed substrate**, and the process, automation, and governance you build on top are consequences of it — not features wired up per workflow.

1. **Describe the domain.** Domain meaning lives in [domain packs](/docs/workforce/concepts/domain-packs) — declarative bundles of the objects, operations, and events your world has. The kernel itself is domain-neutral; a pack adds the semantics. *(Plain, near-natural declaration is the authoring direction; today a pack is declarative YAML plus scripts.)*
2. **It becomes an object model.** The system models each thing as a typed [`ResourceType`](/docs/objects/concepts/object-model) — properties (including computed getters), actions (`open_pr`), events, and lifecycle hooks. Agents act on **typed objects with operations**, not a flat bag of tools.
3. **Workflows and automation derive from it.** [Workflows](/docs/workforce/concepts/workflows) route on structured output and [reactions](/docs/workforce/concepts/reactions) fire on typed events — never on free text. “Done” requires a declared terminal transition and any configured verification, not merely a model's opinion.

One model, many uses: the same typed world drives workflows, automation, authorization, and audit — which is exactly why [the type system](/docs/objects/concepts/type-system) can call every promise a *consequence*, checked once and true everywhere.

## Four concept groups

| Group | Read in this order |
| --- | --- |
| Foundations | [Core concepts and relationships](/docs/workforce/concepts/core-concepts/) → [Issue-based workflows](/docs/workforce/concepts/issue-based-workflows/) → [object model](/docs/objects/concepts/object-model/) |
| Work model | [Issues](/docs/workforce/concepts/issues/) → [intake](/docs/workforce/concepts/intake-lifecycle/) → [Workflows](/docs/workforce/concepts/workflows/) → [parts](/docs/workforce/concepts/workflow-parts/) → [Reactions](/docs/workforce/concepts/reactions/) |
| Resources and governance | [Resource model](/docs/objects/concepts/resource-model/) → [authorization and readiness](/docs/objects/concepts/permissions-resources/) → [credentials](/docs/workforce/concepts/credential-custody/) → [Connectors](/docs/objects/concepts/connectors/) → [Environments](/docs/workforce/concepts/environments/) → [Domain Packs](/docs/workforce/concepts/domain-packs/) |
| Execution boundary | [Agents, WorkUnits, and Awaken Runs](/docs/workforce/concepts/agents-runs/) |

The [type-system page](/docs/objects/concepts/type-system/) is a cross-cutting
explanation, not a second object inventory. Exact fields and enums belong to
[Reference](/docs/workforce/reference/) and the generated OpenAPI contract.
